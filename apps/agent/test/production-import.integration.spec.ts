import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import {
	db,
	ExternalRecordType,
	ExternalSystem,
	MatchActor,
	RecordSource,
} from "@crm/db";
import type { ProductionBusiness } from "@crm/validation/production-business";
import type { ProductionReadClient } from "../agent/lib/production-client";
import { importProductionHotels } from "../agent/lib/production-import";
import {
	approveSydneyProductionProving,
	productionRefreshPayload,
	queueProductionRefresh,
	queueProductionRefreshTask,
	runProductionRefresh,
} from "../agent/lib/production-refresh";

const suffix = (process.env.TEST_RUN_ID ?? crypto.randomUUID())
	.replace(/[^a-z0-9]/gi, "")
	.toLowerCase();
const destination = `import-${suffix}`;
const scope = `qualifying-hotels:${destination}`;
const ids = [
	crypto.randomUUID(),
	crypto.randomUUID(),
	crypto.randomUUID(),
	crypto.randomUUID(),
];
const record = (index: number): ProductionBusiness => ({
	productionPropertyId: ids[index] ?? crypto.randomUUID(),
	canonicalName: `Import Hotel ${suffix} ${index}`,
	destination: { id: crypto.randomUUID(), name: "Sydney", slug: destination },
	country: { name: "Australia", code: "AU" },
	primaryDomain: index < 2 ? `shared-${suffix}.test` : null,
	chain: null,
	entityType: "HOTEL",
	vertical: "HOTEL",
	firstQualifiedAt: "2026-09-01T00:00:00.000Z",
	sourceUpdatedAt: "2026-09-05T00:00:00.000Z",
});

function clientFor(pages: ProductionBusiness[][]): ProductionReadClient {
	return {
		async page(input: { cursor?: string }) {
			const index = input.cursor ? Number(input.cursor) : 0;
			return {
				ok: true as const,
				contractVersion: "1" as const,
				snapshot: "2026-09-05T01:00:00.000Z",
				records: pages[index] ?? [],
				nextCursor: index + 1 < pages.length ? String(index + 1) : null,
			};
		},
	} as ProductionReadClient;
}

async function cleanup() {
	await db.productionImportRun.deleteMany({
		where: {
			scope: { in: [scope, "qualifying-hotels", "qualifying-hotels:sydney"] },
		},
	});
	await db.productionImportState.deleteMany({
		where: { id: { in: [scope, "qualifying-hotels"] } },
	});
	await db.agentTask.deleteMany({ where: { kind: "production-refresh" } });
	await db.productionSnapshot.deleteMany({
		where: { productionId: { in: ids } },
	});
	const refs = await db.externalRef.findMany({
		where: { system: ExternalSystem.PRODUCTION, externalId: { in: ids } },
		select: { recordId: true },
	});
	await db.externalRef.deleteMany({
		where: { system: ExternalSystem.PRODUCTION, externalId: { in: ids } },
	});
	await db.company.deleteMany({
		where: { id: { in: refs.map((ref) => ref.recordId) } },
	});
}

beforeAll(async () => {
	await cleanup();
	await db.vertical.upsert({
		where: { key: "hotel" },
		create: { key: "hotel", label: "Hotel", position: 0 },
		update: {},
	});
});
afterAll(async () => {
	await cleanup();
	await db.$disconnect();
});

describe("Production hotel import database behavior", () => {
	it("creates separate properties sharing a domain and reruns unchanged", async () => {
		const client = clientFor([[record(0), record(1)]]);
		const first = await importProductionHotels(client, {
			destination,
			dryRun: false,
		});
		expect(first.created).toBe(2);
		const second = await importProductionHotels(client, {
			destination,
			dryRun: false,
		});
		expect(second.unchanged).toBe(2);
		const pinned = await importProductionHotels(client, {
			destination,
			dryRun: false,
			expectedCount: 2,
			snapshot: first.snapshot,
		});
		expect(pinned.unchanged).toBe(2);
		const refs = await db.externalRef.findMany({
			where: {
				system: ExternalSystem.PRODUCTION,
				externalId: { in: ids.slice(0, 2) },
			},
		});
		expect(refs).toHaveLength(2);
		expect(new Set(refs.map((ref) => ref.recordId)).size).toBe(2);
		const firstRun = await db.productionImportRun.findFirstOrThrow({
			where: { scope, createdCount: 2 },
			orderBy: { startedAt: "desc" },
		});
		expect(firstRun.fetchedCount).toBe(2);
		expect(
			firstRun.createdCount + firstRun.updatedCount + firstRun.unchangedCount,
		).toBe(2);

		const firstRef = refs.find((ref) => ref.externalId === ids[0]);
		await db.company.update({
			where: { id: firstRef?.recordId },
			data: { description: "CRM-owned note", source: RecordSource.MANUAL },
		});
		const changed = { ...record(0), canonicalName: "Production-renamed hotel" };
		await importProductionHotels(clientFor([[changed, record(1)]]), {
			destination,
			dryRun: false,
		});
		const preserved = await db.company.findUniqueOrThrow({
			where: { id: firstRef?.recordId },
		});
		expect(preserved.name).toBe("Production-renamed hotel");
		expect(preserved.description).toBe("CRM-owned note");
		expect(preserved.source).toBe(RecordSource.MANUAL);
		expect(preserved.city).toBeNull();
	});

	it("applies no records when the expected count fails", async () => {
		const before = await db.externalRef.count({
			where: { system: ExternalSystem.PRODUCTION },
		});
		await expect(
			importProductionHotels(clientFor([[record(2)]]), {
				destination,
				dryRun: false,
				expectedCount: 2,
			}),
		).rejects.toThrow();
		const after = await db.externalRef.count({
			where: { system: ExternalSystem.PRODUCTION },
		});
		expect(after).toBe(before);
	});

	it("prefers an explicitly pinned snapshot over saved state", async () => {
		const pinnedSnapshot = "2026-09-05T02:00:00.000Z";
		await db.productionImportState.upsert({
			where: { id: scope },
			create: {
				id: scope,
				destination,
				snapshot: "2026-09-05T01:00:00.000Z",
			},
			update: { snapshot: "2026-09-05T01:00:00.000Z" },
		});
		const snapshots: Array<string | undefined> = [];
		const client = {
			async page(input: { snapshot?: string }) {
				snapshots.push(input.snapshot);
				return {
					ok: true as const,
					contractVersion: "1" as const,
					snapshot: input.snapshot ?? pinnedSnapshot,
					records: [],
					nextCursor: null,
				};
			},
		} as ProductionReadClient;
		await importProductionHotels(client, {
			destination,
			dryRun: false,
			expectedCount: 0,
			snapshot: pinnedSnapshot,
		});
		expect(snapshots).toEqual([pinnedSnapshot]);
	});

	it("rejects a mixed destination manifest before any write", async () => {
		const before = await db.externalRef.count({
			where: {
				system: ExternalSystem.PRODUCTION,
				externalId: { in: ids.slice(2, 4) },
			},
		});
		const wrongDestination = {
			...record(3),
			destination: {
				...record(3).destination,
				slug: "melbourne",
			},
		};
		await expect(
			importProductionHotels(clientFor([[record(2), wrongDestination]]), {
				destination,
				dryRun: false,
				expectedCount: 2,
			}),
		).rejects.toThrow("unexpected destination");
		const after = await db.externalRef.count({
			where: {
				system: ExternalSystem.PRODUCTION,
				externalId: { in: ids.slice(2, 4) },
			},
		});
		expect(after).toBe(before);
	});

	it("blocks a concurrent run for the same scope", async () => {
		let release: (() => void) | undefined;
		const waiting = new Promise<void>((resolve) => {
			release = resolve;
		});
		const client = {
			async page() {
				await waiting;
				return clientFor([[]]).page({ limit: 500 });
			},
		} as ProductionReadClient;
		const first = importProductionHotels(client, {
			destination,
			dryRun: false,
		});
		await Bun.sleep(20);
		await expect(
			importProductionHotels(clientFor([[]]), { destination, dryRun: false }),
		).rejects.toThrow();
		release?.();
		await first;
	});

	it("rolls back a failed page and safely restarts", async () => {
		await db.externalRef.create({
			data: {
				recordType: ExternalRecordType.COMPANY,
				recordId: `missing-${suffix}`,
				system: ExternalSystem.PRODUCTION,
				externalId: ids[2] ?? "",
				matchMethod: "fixture",
				matchedBy: MatchActor.HUMAN,
				confirmedAt: new Date(),
			},
		});
		await expect(
			importProductionHotels(clientFor([[record(0)], [record(2)]]), {
				destination,
				dryRun: false,
			}),
		).rejects.toThrow();
		const state = await db.productionImportState.findUniqueOrThrow({
			where: { id: scope },
		});
		expect(state.cursor).toBeNull();
		await db.externalRef.delete({
			where: {
				system_recordType_externalId: {
					system: ExternalSystem.PRODUCTION,
					recordType: ExternalRecordType.COMPANY,
					externalId: ids[2] ?? "",
				},
			},
		});
		const restarted = await importProductionHotels(
			clientFor([[record(0)], [record(2)]]),
			{ destination, dryRun: false },
		);
		expect(restarted.unchanged).toBe(1);
		expect(restarted.created).toBe(1);
	});

	it("takes over an expired lease and records the expired run", async () => {
		const staleId = (
			await db.productionImportRun.create({
				data: {
					scope,
					leaseOwner: crypto.randomUUID(),
					heartbeatAt: new Date(0),
					destination,
					dryRun: false,
				},
			})
		).id;
		await importProductionHotels(clientFor([[]]), {
			destination,
			dryRun: false,
		});
		const stale = await db.productionImportRun.findUniqueOrThrow({
			where: { id: staleId },
		});
		expect(stale.status).toBe("FAILED");
		expect(stale.error).toBe("Import lease expired");
	});

	it("persists unconfirmed reference review details without advancing", async () => {
		const before = await db.productionImportState.findUnique({
			where: { id: scope },
		});
		const company = await db.company.create({
			data: { name: `Review ${suffix}` },
		});
		await db.externalRef.create({
			data: {
				recordType: ExternalRecordType.COMPANY,
				recordId: company.id,
				system: ExternalSystem.PRODUCTION,
				externalId: ids[3] ?? "",
				matchMethod: "human-review",
				matchedBy: MatchActor.HUMAN,
			},
		});
		await expect(
			importProductionHotels(clientFor([[record(3)]]), {
				destination,
				dryRun: false,
			}),
		).rejects.toThrow("require review");
		const run = await db.productionImportRun.findFirstOrThrow({
			where: { scope },
			orderBy: { startedAt: "desc" },
		});
		expect(run.exceptionCount).toBe(1);
		expect(JSON.stringify(run.reviewItems)).toContain(ids[3]);
		const state = await db.productionImportState.findUniqueOrThrow({
			where: { id: scope },
		});
		expect(state.sourceWatermark).toEqual(before?.sourceWatermark ?? null);
	});

	it("confirms absences twice before staling importer-owned property refs", async () => {
		await db.productionImportRun.create({
			data: {
				scope: "qualifying-hotels",
				leaseOwner: crypto.randomUUID(),
				heartbeatAt: new Date(),
				status: "COMPLETED",
				dryRun: false,
				fullReconciliation: false,
				qualifyingCount: 100,
				completedAt: new Date(),
			},
		});
		const result = await importProductionHotels(clientFor([[record(0)]]), {
			dryRun: false,
			fullReconciliation: true,
		});
		expect(result.staleReferences).toBeGreaterThan(0);
		const stale = await db.externalRef.findUniqueOrThrow({
			where: {
				system_recordType_externalId: {
					system: ExternalSystem.PRODUCTION,
					recordType: ExternalRecordType.COMPANY,
					externalId: ids[1] ?? "",
				},
			},
		});
		expect(stale.staleAt).not.toBeNull();
		expect(stale.reviewReason).toContain("absent");
	});

	it("deduplicates concurrent durable refresh requests", async () => {
		const queued = await Promise.all([
			queueProductionRefresh(false),
			queueProductionRefresh(false),
		]);
		expect(new Set(queued).size).toBe(1);
		expect(
			await db.agentTask.count({
				where: {
					kind: "production-refresh",
					subject: "production-hotel-universe-incremental",
					finishedAt: null,
				},
			}),
		).toBe(1);
		const fullTaskId = await queueProductionRefresh(true);
		const fullTask = await db.agentTask.findUniqueOrThrow({
			where: { id: fullTaskId },
			select: { subject: true, payload: true },
		});
		expect(fullTask.subject).toBe("production-hotel-universe-full");
		expect(productionRefreshPayload(fullTask.payload)).toEqual({
			fullReconciliation: true,
		});
	});

	it("queues a bounded Sydney proving task with its exact contract", async () => {
		const taskId = await queueProductionRefreshTask({
			fullReconciliation: false,
			destination: "sydney",
			expectedCount: 228,
			dryRun: true,
		});
		const task = await db.agentTask.findUniqueOrThrow({
			where: { id: taskId },
			select: { subject: true, payload: true },
		});
		expect(task.subject).toBe(
			"production-hotel-universe-proving:sydney:dry-run",
		);
		expect(productionRefreshPayload(task.payload)).toEqual({
			fullReconciliation: false,
			destination: "sydney",
			expectedCount: 228,
			dryRun: true,
		});
	});

	it("rejects destination commits without a proven snapshot", async () => {
		await expect(
			queueProductionRefreshTask({
				fullReconciliation: false,
				destination: "sydney",
				expectedCount: 228,
				dryRun: false,
			}),
		).rejects.toThrow("requires a pinned snapshot");
	});

	it("promotes an approved successful dry-run to a pinned commit task", async () => {
		const dryTaskId = await queueProductionRefreshTask({
			fullReconciliation: false,
			destination: "sydney",
			expectedCount: 228,
			dryRun: true,
		});
		const priorFetch = globalThis.fetch;
		const priorEndpoint = process.env.PRODUCTION_READ_URL;
		const priorToken = process.env.PRODUCTION_READ_TOKEN;
		process.env.PRODUCTION_READ_URL = "https://production-read.test/hotels";
		process.env.PRODUCTION_READ_TOKEN = "test-read-token";
		globalThis.fetch = async () =>
			Response.json({
				ok: true,
				contractVersion: "1",
				snapshot: "2026-09-05T01:00:00.000Z",
				records: Array.from({ length: 228 }, (_, index) => ({
					...record(index + 20),
					destination: {
						...record(index + 20).destination,
						slug: "sydney",
					},
				})),
				nextCursor: null,
			});
		try {
			const summary = await runProductionRefresh(dryTaskId, {
				fullReconciliation: false,
				destination: "sydney",
				expectedCount: 228,
				dryRun: true,
			});
			expect(summary).toContain("Validated 228 qualifying hotels");
			expect(summary).toContain("Snapshot 2026-09-05T01:00:00.000Z");
			expect(
				await db.agentTask.count({
					where: {
						kind: "production-refresh",
						subject: "production-hotel-universe-proving:sydney:commit",
						finishedAt: null,
					},
				}),
			).toBe(0);
			await approveSydneyProductionProving();
			const commit = await db.agentTask.findFirstOrThrow({
				where: {
					kind: "production-refresh",
					subject: "production-hotel-universe-proving:sydney:commit",
					finishedAt: null,
				},
				select: { payload: true },
			});
			expect(productionRefreshPayload(commit.payload)).toEqual({
				fullReconciliation: false,
				destination: "sydney",
				expectedCount: 228,
				dryRun: false,
				snapshot: "2026-09-05T01:00:00.000Z",
			});
		} finally {
			globalThis.fetch = priorFetch;
			if (priorEndpoint === undefined) delete process.env.PRODUCTION_READ_URL;
			else process.env.PRODUCTION_READ_URL = priorEndpoint;
			if (priorToken === undefined) delete process.env.PRODUCTION_READ_TOKEN;
			else process.env.PRODUCTION_READ_TOKEN = priorToken;
		}
	});
});
