import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import {
	db,
	ExternalRecordType,
	ExternalSystem,
	MatchActor,
	RecordSource,
} from "@crm/db";
import type { ProductionBusiness } from "@crm/validation/production-business";
import {
	FULL_UNIVERSE,
	queueApprovedFullUniverseCommit,
	queueFullUniverseDryRun,
	queueProductionRefreshAfterFullImport,
	readFullUniverseProof,
	recoverStrandedFullUniverseDryRun,
} from "../agent/lib/full-production-gate";
import { ProductionReadClient } from "../agent/lib/production-client";
import {
	importProductionHotels,
	productionIdDigest,
} from "../agent/lib/production-import";
import { PRODUCTION_IMPORT } from "../agent/lib/production-import-config";
import {
	approveSydneyProductionProving,
	productionRefreshPayload,
	queueProductionRefresh,
	queueProductionRefreshTask,
	queueSydneyIdempotencyProof,
	queueSydneyProductionCommit,
	queueSydneyProductionDryRun,
	runProductionRefresh,
} from "../agent/lib/production-refresh";
import {
	readSydneyCommittedProof,
	readSydneyProductionProof,
} from "../agent/lib/sydney-production-proof";
import { claimDue } from "../agent/lib/tasks";

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
const committedPropertyIds = Array.from({ length: 228 }, () =>
	crypto.randomUUID(),
);
const committedCompanyIds = Array.from({ length: 228 }, () =>
	crypto.randomUUID(),
);
const contaminationPropertyId = crypto.randomUUID();
const contaminationCompanyId = crypto.randomUUID();
const chainId = crypto.randomUUID();
const parentChainId = crypto.randomUUID();
const structurePropertyId = crypto.randomUUID();
const chunkPropertyIds = Array.from({ length: 102 }, () => crypto.randomUUID());
const destinationId = crypto.randomUUID();
const proofBoundaryEvidence = {
	contractVersion: "1" as const,
	httpMethod: "GET" as const,
	readRequests: 1,
	clientEvidence: "GET_ONLY_HTTP_CLIENT" as const,
	manifestSnapshot: "2026-09-05T01:00:00.000Z",
	manifestProductionIds: committedPropertyIds,
};
const record = (index: number): ProductionBusiness => ({
	productionPropertyId: ids[index] ?? crypto.randomUUID(),
	canonicalName: `Import Hotel ${suffix} ${index}`,
	propertySlug: `import-hotel-${index}`,
	destination: {
		id: destinationId,
		name: "Sydney",
		slug: destination,
		type: "city",
	},
	country: { name: "Australia", code: "AU" },
	primaryDomain: index < 2 ? `shared-${suffix}.test` : null,
	brand: null,
	ownershipStatus: "independent_confirmed",
	chain: null,
	parentChain: null,
	locality: null,
	commercialKnowledge: {
		canonicalOwnership: null,
		chainScale: null,
		propertyPositioning: null,
		accommodationType: null,
		starRating: null,
		heritageStatus: null,
		locationContexts: [],
		facilityPresence: [],
		policyCharacteristics: [],
		provenance: [],
	},
	recommendationSummary: null,
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
				contractVersion: "2" as const,
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
			scope: {
				in: [
					scope,
					"qualifying-hotels",
					"qualifying-hotels:sydney",
					"qualifying-hotels:sydney:idempotency",
				],
			},
		},
	});
	await db.productionImportState.deleteMany({
		where: { id: { in: [scope, "qualifying-hotels"] } },
	});
	await db.agentTask.deleteMany({ where: { kind: "production-refresh" } });
	await db.productionSnapshot.deleteMany({
		where: {
			productionId: {
				in: [
					...ids,
					...committedPropertyIds,
					...chunkPropertyIds,
					contaminationPropertyId,
					structurePropertyId,
				],
			},
		},
	});
	await db.externalRelationshipRef.deleteMany({
		where: {
			system: ExternalSystem.PRODUCTION,
			externalId: {
				in: [
					...ids.map((id) => `property:${id}:belongs-to:chain:${chainId}`),
					`property:${structurePropertyId}:belongs-to:chain:${chainId}`,
					`chain:${chainId}:belongs-to:chain:${parentChainId}`,
				],
			},
		},
	});
	const refs = await db.externalRef.findMany({
		where: {
			system: ExternalSystem.PRODUCTION,
			externalId: {
				in: [
					...ids,
					...committedPropertyIds,
					...chunkPropertyIds,
					contaminationPropertyId,
					structurePropertyId,
					`chain:${chainId}`,
					`chain:${parentChainId}`,
				],
			},
		},
		select: { recordId: true },
	});
	await db.externalRef.deleteMany({
		where: {
			system: ExternalSystem.PRODUCTION,
			externalId: {
				in: [
					...ids,
					...committedPropertyIds,
					...chunkPropertyIds,
					contaminationPropertyId,
					structurePropertyId,
					`chain:${chainId}`,
					`chain:${parentChainId}`,
				],
			},
		},
	});
	await db.company.deleteMany({
		where: {
			id: {
				in: [
					...refs.map((ref) => ref.recordId),
					...committedCompanyIds,
					contaminationCompanyId,
				],
			},
		},
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
	it("uses bounded transaction limits for page and structure writes", () => {
		expect(PRODUCTION_IMPORT.writeChunkSize).toBe(100);
		expect(PRODUCTION_IMPORT.transaction).toEqual({
			maxWait: 10_000,
			timeout: 120_000,
		});
	});

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
		await db.productionBusinessProfile.delete({
			where: { companyId: firstRef?.recordId },
		});
		const enriched = await importProductionHotels(
			clientFor([[changed, record(1)]]),
			{ destination, dryRun: false },
		);
		expect(enriched.updated).toBe(1);
		expect(enriched.unchanged).toBe(1);
		const stableRef = await db.externalRef.findUniqueOrThrow({
			where: {
				system_recordType_externalId: {
					system: ExternalSystem.PRODUCTION,
					recordType: ExternalRecordType.COMPANY,
					externalId: ids[0] ?? "",
				},
			},
		});
		expect(stableRef.recordId).toBe(firstRef?.recordId);
		expect(
			await db.productionBusinessProfile.count({
				where: { companyId: firstRef?.recordId },
			}),
		).toBe(1);
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

	it("stores governed fields and maps chain structure by Production ID", async () => {
		const structured = {
			...record(3),
			productionPropertyId: structurePropertyId,
			brand: "Harbour Collection",
			ownershipStatus: "chained" as const,
			chain: { id: chainId, name: "Harbour Hotels" },
			parentChain: { id: parentChainId, name: "Global Lodging" },
			locality: {
				id: crypto.randomUUID(),
				name: "Circular Quay",
				slug: "circular-quay",
				type: "precinct" as const,
			},
			commercialKnowledge: {
				...record(3).commercialKnowledge,
				starRating: "five-star",
				locationContexts: ["harbour"],
			},
		};
		const first = await importProductionHotels(clientFor([[structured]]), {
			destination,
			dryRun: false,
		});
		expect(first.created).toBe(1);
		const propertyRef = await db.externalRef.findUniqueOrThrow({
			where: {
				system_recordType_externalId: {
					system: ExternalSystem.PRODUCTION,
					recordType: ExternalRecordType.COMPANY,
					externalId: structured.productionPropertyId,
				},
			},
		});
		const profile = await db.productionBusinessProfile.findUniqueOrThrow({
			where: { companyId: propertyRef.recordId },
		});
		expect(profile.brandText).toBe("Harbour Collection");
		expect(profile.ownershipStatus).toBe("chained");
		expect(profile.commercialKnowledge).toMatchObject({
			starRating: "five-star",
			locationContexts: ["harbour"],
		});
		const structureRefs = await db.externalRef.findMany({
			where: {
				system: ExternalSystem.PRODUCTION,
				externalId: { in: [`chain:${chainId}`, `chain:${parentChainId}`] },
			},
		});
		expect(structureRefs).toHaveLength(2);
		expect(new Set(structureRefs.map((ref) => ref.recordId)).size).toBe(2);
		const relationships = await db.externalRelationshipRef.findMany({
			where: {
				system: ExternalSystem.PRODUCTION,
				externalId: {
					in: [
						`property:${structured.productionPropertyId}:belongs-to:chain:${chainId}`,
						`chain:${chainId}:belongs-to:chain:${parentChainId}`,
					],
				},
			},
		});
		expect(relationships).toHaveLength(2);
		const replay = await importProductionHotels(clientFor([[structured]]), {
			destination,
			dryRun: false,
		});
		expect(replay.unchanged).toBe(1);
		expect(
			await db.productionBusinessProfile.count({
				where: { productionPropertyId: structured.productionPropertyId },
			}),
		).toBe(1);
		const localityChanged = {
			...structured,
			locality: { ...structured.locality, name: "The Rocks" },
			sourceUpdatedAt: "2026-09-05T00:05:00.000Z",
		};
		const refreshed = await importProductionHotels(
			clientFor([[localityChanged]]),
			{ destination, dryRun: false },
		);
		expect(refreshed.updated).toBe(1);
		expect(
			await db.productionBusinessProfile.findUniqueOrThrow({
				where: { productionPropertyId: structured.productionPropertyId },
				select: { localityName: true },
			}),
		).toEqual({ localityName: "The Rocks" });
		const independent = {
			...localityChanged,
			ownershipStatus: "independent_confirmed" as const,
			chain: null,
			parentChain: null,
			sourceUpdatedAt: "2026-09-05T00:10:00.000Z",
		};
		await importProductionHotels(clientFor([[independent]]), {
			destination,
			dryRun: false,
		});
		const staleRelationship =
			await db.externalRelationshipRef.findUniqueOrThrow({
				where: {
					system_externalId: {
						system: ExternalSystem.PRODUCTION,
						externalId: `property:${structured.productionPropertyId}:belongs-to:chain:${chainId}`,
					},
				},
				include: { relationship: true },
			});
		expect(staleRelationship.staleAt).not.toBeNull();
		expect(staleRelationship.relationship.validTo).not.toBeNull();
	});

	it("applies no records when the approved manifest differs", async () => {
		const before = await db.externalRef.count({
			where: { system: ExternalSystem.PRODUCTION },
		});
		await expect(
			importProductionHotels(clientFor([[record(2)]]), {
				destination,
				dryRun: false,
				expectedCount: 1,
				expectedProductionIds: [crypto.randomUUID()],
			}),
		).rejects.toThrow("Production manifest does not match the approved IDs");
		const after = await db.externalRef.count({
			where: { system: ExternalSystem.PRODUCTION },
		});
		expect(after).toBe(before);
	});

	it.each([
		["a", "a"],
		["a", "b", "a"],
	])("rejects cursor cycles before business writes: %j", async (...cursors) => {
		let requests = 0;
		const before = await db.externalRef.count({
			where: { system: ExternalSystem.PRODUCTION },
		});
		const client = {
			async page() {
				const nextCursor = cursors[requests++] ?? null;
				return {
					ok: true as const,
					contractVersion: "2" as const,
					snapshot: "2026-09-05T01:00:00.000Z",
					records: [record(2)],
					nextCursor,
				};
			},
		} as ProductionReadClient;
		await expect(
			importProductionHotels(client, { destination, dryRun: false }),
		).rejects.toThrow("Production pagination repeated a cursor");
		expect(requests).toBe(cursors.length);
		expect(
			await db.externalRef.count({
				where: { system: ExternalSystem.PRODUCTION },
			}),
		).toBe(before);
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
					contractVersion: "2" as const,
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

	it("checkpoints a page only after every bounded write chunk succeeds", async () => {
		const records = chunkPropertyIds.map((productionPropertyId, index) => ({
			...record(3),
			productionPropertyId,
			canonicalName: `Chunk Hotel ${suffix} ${index}`,
			propertySlug: `chunk-hotel-${suffix}-${index}`,
			primaryDomain: null,
			sourceUpdatedAt: new Date(
				Date.parse("2026-09-05T00:00:00.000Z") + index,
			).toISOString(),
		}));
		const failedId = chunkPropertyIds.at(-1) ?? "";
		await db.externalRef.create({
			data: {
				recordType: ExternalRecordType.COMPANY,
				recordId: `missing-chunk-${suffix}`,
				system: ExternalSystem.PRODUCTION,
				externalId: failedId,
				matchMethod: "fixture",
				matchedBy: MatchActor.HUMAN,
				confirmedAt: new Date(),
			},
		});
		const pagedClient = clientFor([records, []]);
		await expect(
			importProductionHotels(pagedClient, { destination, dryRun: false }),
		).rejects.toThrow();
		expect(
			await db.externalRef.count({
				where: {
					system: ExternalSystem.PRODUCTION,
					externalId: { in: chunkPropertyIds },
					confirmedAt: { not: null },
				},
			}),
		).toBe(PRODUCTION_IMPORT.writeChunkSize + 1);
		expect(
			await db.productionSnapshot.count({
				where: { productionId: { in: chunkPropertyIds } },
			}),
		).toBe(PRODUCTION_IMPORT.writeChunkSize);
		const state = await db.productionImportState.findUniqueOrThrow({
			where: { id: scope },
		});
		expect(state.cursor).toBeNull();
		await db.externalRef.delete({
			where: {
				system_recordType_externalId: {
					system: ExternalSystem.PRODUCTION,
					recordType: ExternalRecordType.COMPANY,
					externalId: failedId,
				},
			},
		});
		const restarted = await importProductionHotels(clientFor([records, []]), {
			destination,
			dryRun: false,
		});
		expect(restarted.unchanged).toBe(PRODUCTION_IMPORT.writeChunkSize);
		expect(restarted.created).toBe(2);
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

	it("releases a failed refresh lease for bounded retry", async () => {
		await db.agentTask.deleteMany({ where: { kind: "production-refresh" } });
		const task = await db.agentTask.create({
			data: {
				kind: "production-refresh",
				reason: "Test failed refresh lease release.",
				payload: { fullReconciliation: false },
				priority: 600,
				budget: 0,
				dueAt: new Date(),
				leasedUntil: new Date(Date.now() + 60_000),
				subject: `failed-refresh:${suffix}`,
			},
		});
		const failedClient = new ProductionReadClient(
			"https://production.test/read",
			"test-token",
			async () => new Response(null, { status: 500 }),
		);
		await expect(
			runProductionRefresh(
				task.id,
				{
					fullReconciliation: false,
					destination,
					expectedCount: 1,
					dryRun: true,
				},
				failedClient,
			),
		).rejects.toThrow("Production read failed with HTTP 500");
		const failed = await db.agentTask.findUniqueOrThrow({
			where: { id: task.id },
			select: { dueAt: true, finishedAt: true, leasedUntil: true },
		});
		expect(failed.finishedAt).toBeNull();
		expect(failed.leasedUntil?.getTime()).toBeLessThanOrEqual(Date.now());
		expect(failed.dueAt.getTime()).toBeGreaterThan(Date.now());
		expect(await claimDue(1, { only: ["production-refresh"] })).toEqual([]);
	});
});

describe("Production hotel import proving gates", () => {
	it("queues a bounded Sydney proving task with its exact contract", async () => {
		const [taskId, duplicateTaskId] = await Promise.all([
			queueSydneyProductionDryRun(),
			queueSydneyProductionDryRun(),
		]);
		expect(taskId).not.toBeNull();
		expect(duplicateTaskId).toBe(taskId);
		const task = await db.agentTask.findUniqueOrThrow({
			where: { id: taskId ?? "" },
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

	it("stops the one-shot queue after a completed 228 proof", async () => {
		await db.agentTask.deleteMany({
			where: {
				kind: "production-refresh",
				subject: "production-hotel-universe-proving:sydney:dry-run",
			},
		});
		await db.productionImportRun.create({
			data: {
				scope: "qualifying-hotels:sydney",
				leaseOwner: crypto.randomUUID(),
				heartbeatAt: new Date(),
				status: "COMPLETED",
				destination: "sydney",
				dryRun: true,
				qualifyingCount: 228,
				boundaryEvidence: {
					contractVersion: "1",
					httpMethod: "GET",
					readRequests: 1,
					clientEvidence: "GET_ONLY_HTTP_CLIENT",
					manifestSnapshot: "2026-09-05T01:00:00.000Z",
				},
				completedAt: new Date(),
			},
		});
		expect(await queueSydneyProductionDryRun()).toBeNull();
		expect(
			await db.agentTask.count({
				where: {
					kind: "production-refresh",
					subject: "production-hotel-universe-proving:sydney:dry-run",
					finishedAt: null,
				},
			}),
		).toBe(0);
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
				contractVersion: "2",
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
			const auditedDryRun = await db.productionImportRun.findFirstOrThrow({
				where: {
					scope: "qualifying-hotels:sydney",
					dryRun: true,
					status: "COMPLETED",
				},
				orderBy: { startedAt: "desc" },
				select: { id: true, startedAt: true },
			});
			await db.productionImportRun.update({
				where: { id: auditedDryRun.id },
				data: {
					completedAt: new Date(auditedDryRun.startedAt.getTime() + 3129),
				},
			});
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

	it("reports only sanitized Sydney proof aggregates", async () => {
		await db.agentTask.deleteMany({ where: { kind: "production-refresh" } });
		await db.productionImportRun.deleteMany({
			where: {
				scope: {
					in: [
						"qualifying-hotels:sydney",
						"qualifying-hotels:sydney:idempotency",
					],
				},
			},
		});
		const startedAt = new Date("2026-09-05T01:00:00.000Z");
		const completedAt = new Date("2026-09-05T01:00:02.500Z");
		await db.productionImportRun.create({
			data: {
				scope: "qualifying-hotels:sydney",
				leaseOwner: crypto.randomUUID(),
				heartbeatAt: completedAt,
				status: "COMPLETED",
				destination: "sydney",
				dryRun: true,
				qualifyingCount: 228,
				createdCount: 0,
				updatedCount: 0,
				boundaryEvidence: {
					contractVersion: "1",
					httpMethod: "GET",
					readRequests: 1,
					clientEvidence: "GET_ONLY_HTTP_CLIENT",
					manifestSnapshot: "2026-09-05T01:00:00.000Z",
				},
				startedAt,
				completedAt,
			},
		});
		await db.agentTask.create({
			data: {
				kind: "production-refresh",
				reason: "Sydney proof",
				payload: {
					fullReconciliation: false,
					destination: "sydney",
					expectedCount: 228,
					dryRun: true,
				},
				priority: 600,
				budget: 0,
				dueAt: startedAt,
				startedAt,
				finishedAt: completedAt,
				subject: "production-hotel-universe-proving:sydney:dry-run",
			},
		});
		expect(await readSydneyProductionProof()).toEqual({
			runStatus: "COMPLETED",
			qualifyingCount: 228,
			destination: "sydney",
			dryRun: true,
			manifestValid: true,
			businessWriteCountEvidence: 0,
			taskState: "FINISHED",
			runtimeMs: 2500,
		});
	});

	it("queues one pinned Sydney commit and stops after completion", async () => {
		await db.agentTask.deleteMany({ where: { kind: "production-refresh" } });
		await db.productionImportRun.deleteMany({
			where: {
				scope: {
					in: [
						"qualifying-hotels:sydney",
						"qualifying-hotels:sydney:idempotency",
					],
				},
			},
		});
		const approvedStartedAt = new Date("2026-09-05T01:00:00.000Z");
		const approvedDryRun = await db.productionImportRun.create({
			data: {
				scope: "qualifying-hotels:sydney",
				leaseOwner: crypto.randomUUID(),
				heartbeatAt: new Date(),
				status: "COMPLETED",
				destination: "sydney",
				dryRun: true,
				qualifyingCount: 228,
				createdCount: 0,
				updatedCount: 0,
				boundaryEvidence: proofBoundaryEvidence,
				startedAt: approvedStartedAt,
				completedAt: new Date(approvedStartedAt.getTime() + 3000),
			},
		});
		await expect(queueSydneyProductionCommit()).rejects.toThrow(
			"completed 228-hotel Sydney dry-run",
		);
		await db.productionImportRun.update({
			where: { id: approvedDryRun.id },
			data: { completedAt: new Date(approvedStartedAt.getTime() + 3129) },
		});
		const [firstTaskId, secondTaskId] = await Promise.all([
			queueSydneyProductionCommit(),
			queueSydneyProductionCommit(),
		]);
		expect(firstTaskId).not.toBeNull();
		expect(secondTaskId).toBe(firstTaskId);
		const task = await db.agentTask.findUniqueOrThrow({
			where: { id: firstTaskId ?? "" },
			select: { payload: true },
		});
		expect(productionRefreshPayload(task.payload)).toEqual({
			fullReconciliation: false,
			destination: "sydney",
			expectedCount: 228,
			dryRun: false,
			snapshot: proofBoundaryEvidence.manifestSnapshot,
		});
		await db.agentTask.deleteMany({ where: { kind: "production-refresh" } });
		await db.productionImportRun.create({
			data: {
				scope: "qualifying-hotels:sydney",
				leaseOwner: crypto.randomUUID(),
				heartbeatAt: new Date(),
				status: "COMPLETED",
				destination: "sydney",
				dryRun: false,
				qualifyingCount: 228,
				fetchedCount: 228,
				createdCount: 228,
				exceptionCount: 0,
				boundaryEvidence: proofBoundaryEvidence,
				completedAt: new Date(),
			},
		});
		expect(await queueSydneyProductionCommit()).toBeNull();
		const [rerunTaskId, duplicateRerunTaskId] = await Promise.all([
			queueSydneyIdempotencyProof(),
			queueSydneyIdempotencyProof(),
		]);
		expect(rerunTaskId).not.toBeNull();
		expect(duplicateRerunTaskId).toBe(rerunTaskId);
		const rerunTask = await db.agentTask.findUniqueOrThrow({
			where: { id: rerunTaskId ?? "" },
			select: { payload: true },
		});
		expect(productionRefreshPayload(rerunTask.payload)).toEqual({
			fullReconciliation: false,
			destination: "sydney",
			expectedCount: 228,
			dryRun: false,
			snapshot: proofBoundaryEvidence.manifestSnapshot,
			auditScope: "qualifying-hotels:sydney:idempotency",
			expectedProductionIds: proofBoundaryEvidence.manifestProductionIds,
		});
		await db.agentTask.update({
			where: { id: rerunTaskId ?? "" },
			data: { startedAt: new Date(), finishedAt: new Date() },
		});
		const rerun = await db.productionImportRun.create({
			data: {
				scope: "qualifying-hotels:sydney:idempotency",
				leaseOwner: crypto.randomUUID(),
				heartbeatAt: new Date(),
				status: "FAILED",
				destination: "sydney",
				dryRun: false,
				qualifyingCount: 228,
				fetchedCount: 228,
				createdCount: 1,
				unchangedCount: 227,
				exceptionCount: 1,
				boundaryEvidence: proofBoundaryEvidence,
				completedAt: new Date(),
			},
		});
		expect(await queueSydneyIdempotencyProof()).toBeNull();
		await db.productionImportRun.update({
			where: { id: rerun.id },
			data: {
				status: "COMPLETED",
				createdCount: 0,
				unchangedCount: 228,
				exceptionCount: 0,
			},
		});
		expect(await queueSydneyIdempotencyProof()).toBeNull();
		expect(
			await db.agentTask.count({
				where: {
					subject: {
						in: [
							"production-hotel-universe-incremental",
							"production-hotel-universe-full",
						],
					},
					finishedAt: null,
				},
			}),
		).toBe(0);
	});

	it("reports the committed Sydney acceptance evidence without identifiers", async () => {
		await db.agentTask.deleteMany({ where: { kind: "production-refresh" } });
		await db.productionImportRun.deleteMany({
			where: { scope: "qualifying-hotels:sydney" },
		});
		await db.externalRef.deleteMany({
			where: {
				system: ExternalSystem.PRODUCTION,
				externalId: {
					in: [...committedPropertyIds, contaminationPropertyId],
				},
			},
		});
		await db.productionSnapshot.deleteMany({
			where: {
				productionId: {
					in: [...committedPropertyIds, contaminationPropertyId],
				},
			},
		});
		await db.company.deleteMany({
			where: {
				id: { in: [...committedCompanyIds, contaminationCompanyId] },
			},
		});
		const vertical = await db.vertical.findUniqueOrThrow({
			where: { key: "hotel" },
			select: { id: true },
		});
		const startedAt = new Date("2026-09-05T02:00:00.000Z");
		const completedAt = new Date("2026-09-05T02:00:04.250Z");
		await db.$transaction(async (tx) => {
			await tx.company.createMany({
				data: committedCompanyIds.map((id, index) => ({
					id,
					name: `Sydney committed hotel ${index + 1}`,
					domain: index < 2 ? "shared-sydney.test" : `sydney-${index}.test`,
					verticalId: vertical.id,
					entityType: "HOTEL",
					source: RecordSource.IMPORT,
				})),
			});
			await tx.externalRef.createMany({
				data: committedPropertyIds.map((externalId, index) => ({
					recordType: ExternalRecordType.COMPANY,
					recordId: committedCompanyIds[index] ?? "",
					system: ExternalSystem.PRODUCTION,
					externalId,
					matchMethod: "production-property-id",
					matchedBy: MatchActor.IMPORT,
					confirmedAt: completedAt,
				})),
			});
			await tx.productionSnapshot.createMany({
				data: committedPropertyIds.map((productionId, index) => ({
					productionId,
					entityKind: "property",
					name: `Sydney committed hotel ${index + 1}`,
					destination: "Sydney",
					destinationSlug: "sydney",
					payload: { productionPropertyId: productionId },
					fetchedAt: completedAt,
					staleAfter: new Date("2026-09-06T02:00:04.250Z"),
				})),
			});
			await tx.company.create({
				data: {
					id: contaminationCompanyId,
					name: "Later Sydney hotel",
					domain: "shared-sydney.test",
					verticalId: vertical.id,
					entityType: "HOTEL",
					source: RecordSource.IMPORT,
				},
			});
			await tx.externalRef.create({
				data: {
					recordType: ExternalRecordType.COMPANY,
					recordId: contaminationCompanyId,
					system: ExternalSystem.PRODUCTION,
					externalId: contaminationPropertyId,
					matchMethod: "production-property-id",
					matchedBy: MatchActor.IMPORT,
					confirmedAt: completedAt,
				},
			});
			await tx.productionSnapshot.create({
				data: {
					productionId: contaminationPropertyId,
					entityKind: "property",
					name: "Later Sydney hotel",
					destination: "Sydney",
					destinationSlug: "sydney",
					payload: { productionPropertyId: contaminationPropertyId },
					fetchedAt: completedAt,
					staleAfter: new Date("2026-09-06T02:00:04.250Z"),
				},
			});
		});
		await db.productionImportRun.create({
			data: {
				scope: "qualifying-hotels:sydney",
				leaseOwner: crypto.randomUUID(),
				heartbeatAt: completedAt,
				status: "COMPLETED",
				destination: "sydney",
				dryRun: false,
				qualifyingCount: 228,
				fetchedCount: 228,
				createdCount: 228,
				exceptionCount: 0,
				reviewCount: 3,
				reviewItems: committedPropertyIds
					.slice(0, 3)
					.map((productionPropertyId) => ({
						productionPropertyId,
						reason: "Production country identity is incomplete",
					})),
				chainIdCount: 40,
				missingChainCount: 188,
				boundaryEvidence: proofBoundaryEvidence,
				startedAt,
				completedAt,
			},
		});
		await db.agentTask.create({
			data: {
				kind: "production-refresh",
				reason: "Sydney committed proof",
				payload: { fullReconciliation: false },
				priority: 600,
				budget: 0,
				dueAt: startedAt,
				startedAt,
				finishedAt: completedAt,
				subject: "production-hotel-universe-proving:sydney:commit",
			},
		});
		expect(await readSydneyCommittedProof()).toEqual({
			runStatus: "COMPLETED",
			qualifyingCount: 228,
			destination: "sydney",
			dryRun: false,
			manifestValid: true,
			crmBusinessCount: 228,
			confirmedProductionExternalRefCount: 228,
			duplicateProductionRefCount: 0,
			hotelEntityTypeCount: 228,
			hotelVerticalCount: 228,
			destinationCount: 1,
			sharedDomainGroupCount: 1,
			sharedDomainBusinessCount: 2,
			sharedDomainCollapsedPropertyCount: 0,
			exceptionCount: 0,
			reviewCount: 3,
			reviewItemCount: 3,
			withChainIdentifierCount: 40,
			withoutChainIdentifierCount: 188,
			taskState: "FINISHED",
			runtimeMs: 4250,
		});
	});

	it("rejects incomplete Sydney boundary evidence", async () => {
		await db.productionImportRun.deleteMany({
			where: { scope: "qualifying-hotels:sydney" },
		});
		await db.productionImportRun.create({
			data: {
				scope: "qualifying-hotels:sydney",
				leaseOwner: crypto.randomUUID(),
				heartbeatAt: new Date(),
				status: "COMPLETED",
				destination: "sydney",
				dryRun: true,
				qualifyingCount: 228,
				boundaryEvidence: {
					manifestSnapshot: "2026-09-05T01:00:00.000Z",
				},
				completedAt: new Date(),
			},
		});
		expect((await readSydneyProductionProof()).manifestValid).toBe(false);
	});
});

describe("Full Production universe stranded lease recovery", () => {
	it("releases only the stranded first full-universe dry-run lease", async () => {
		await db.agentTask.deleteMany({ where: { kind: "production-refresh" } });
		await db.productionImportRun.deleteMany({
			where: { scope: FULL_UNIVERSE.scope },
		});
		const now = new Date();
		const stale = new Date(now.getTime() - 2 * PRODUCTION_IMPORT.retryMs);
		const task = await db.agentTask.create({
			data: {
				kind: "production-refresh",
				reason: "Stranded full-universe proof",
				payload: {
					fullReconciliation: false,
					dryRun: true,
					universeGate: "DRY_RUN",
				},
				priority: 600,
				budget: 0,
				attempts: 1,
				dueAt: stale,
				startedAt: stale,
				leasedUntil: new Date(now.getTime() + PRODUCTION_IMPORT.leaseMs),
				subject: FULL_UNIVERSE.drySubject,
			},
		});
		await db.productionImportRun.create({
			data: {
				scope: FULL_UNIVERSE.scope,
				leaseOwner: crypto.randomUUID(),
				heartbeatAt: stale,
				status: "FAILED",
				dryRun: true,
				startedAt: stale,
				completedAt: stale,
			},
		});
		expect(await recoverStrandedFullUniverseDryRun()).toBe(true);
		const recovered = await db.agentTask.findUniqueOrThrow({
			where: { id: task.id },
			select: { dueAt: true, leasedUntil: true },
		});
		expect(recovered.dueAt.getTime()).toBeGreaterThanOrEqual(now.getTime());
		expect(recovered.leasedUntil?.getTime()).toBeGreaterThanOrEqual(
			now.getTime(),
		);
		const claimed = await claimDue(1, { only: ["production-refresh"] });
		expect(claimed).toHaveLength(1);
		expect(claimed[0]?.id).toBe(task.id);
		expect(claimed[0]?.attempts).toBe(2);
		expect(await recoverStrandedFullUniverseDryRun()).toBe(false);
	});

	it("rejects recovery evidence from a committed full-universe run", async () => {
		await db.agentTask.deleteMany({ where: { kind: "production-refresh" } });
		await db.productionImportRun.deleteMany({
			where: { scope: FULL_UNIVERSE.scope },
		});
		const stale = new Date(Date.now() - 2 * PRODUCTION_IMPORT.retryMs);
		await db.agentTask.create({
			data: {
				kind: "production-refresh",
				reason: "Stranded full-universe proof",
				payload: {
					fullReconciliation: false,
					dryRun: true,
					universeGate: "DRY_RUN",
				},
				priority: 600,
				budget: 0,
				attempts: 1,
				dueAt: stale,
				startedAt: stale,
				leasedUntil: new Date(Date.now() + PRODUCTION_IMPORT.leaseMs),
				subject: FULL_UNIVERSE.drySubject,
			},
		});
		await db.productionImportRun.create({
			data: {
				scope: FULL_UNIVERSE.scope,
				leaseOwner: crypto.randomUUID(),
				heartbeatAt: stale,
				status: "FAILED",
				dryRun: false,
				startedAt: stale,
				completedAt: stale,
			},
		});
		expect(await recoverStrandedFullUniverseDryRun()).toBe(false);
	});

	it("rejects unsafe stranded lease recovery states", async () => {
		await db.agentTask.deleteMany({ where: { kind: "production-refresh" } });
		await db.productionImportRun.deleteMany({
			where: { scope: FULL_UNIVERSE.scope },
		});
		const now = new Date();
		const stale = new Date(now.getTime() - 2 * PRODUCTION_IMPORT.retryMs);
		const task = await db.agentTask.create({
			data: {
				kind: "production-refresh",
				reason: "Unsafe stranded full-universe proof",
				payload: { fullReconciliation: false, dryRun: true },
				priority: 600,
				budget: 0,
				attempts: 1,
				dueAt: stale,
				startedAt: stale,
				leasedUntil: new Date(now.getTime() + PRODUCTION_IMPORT.leaseMs),
				subject: FULL_UNIVERSE.drySubject,
			},
		});
		const run = await db.productionImportRun.create({
			data: {
				scope: FULL_UNIVERSE.scope,
				leaseOwner: crypto.randomUUID(),
				heartbeatAt: stale,
				status: "FAILED",
				dryRun: true,
				startedAt: stale,
				completedAt: stale,
			},
		});
		expect(await recoverStrandedFullUniverseDryRun()).toBe(false);
		await db.agentTask.update({
			where: { id: task.id },
			data: {
				payload: {
					fullReconciliation: false,
					dryRun: true,
					universeGate: "DRY_RUN",
				},
				leasedUntil: new Date(now.getTime() + PRODUCTION_IMPORT.retryMs),
			},
		});
		expect(await recoverStrandedFullUniverseDryRun()).toBe(false);
		await db.agentTask.update({
			where: { id: task.id },
			data: {
				leasedUntil: new Date(now.getTime() + PRODUCTION_IMPORT.leaseMs),
			},
		});
		await db.productionImportRun.update({
			where: { id: run.id },
			data: { heartbeatAt: new Date(), completedAt: new Date() },
		});
		expect(await recoverStrandedFullUniverseDryRun()).toBe(false);
		await db.productionImportRun.update({
			where: { id: run.id },
			data: { heartbeatAt: stale, completedAt: stale },
		});
		await db.agentTask.update({
			where: { id: task.id },
			data: { attempts: 2 },
		});
		expect(await recoverStrandedFullUniverseDryRun()).toBe(false);
		await db.agentTask.update({
			where: { id: task.id },
			data: { attempts: 1 },
		});
		await db.productionImportRun.create({
			data: {
				scope: FULL_UNIVERSE.scope,
				leaseOwner: crypto.randomUUID(),
				heartbeatAt: new Date(),
				status: "RUNNING",
				dryRun: true,
			},
		});
		expect(await recoverStrandedFullUniverseDryRun()).toBe(false);
	});
});

describe("Production hotel import full universe gate", () => {
	it("gates the full universe through exact durable dry-run evidence", async () => {
		await db.agentTask.deleteMany({ where: { kind: "production-refresh" } });
		await db.productionImportRun.deleteMany({
			where: {
				scope: {
					in: [FULL_UNIVERSE.scope, "qualifying-hotels:sydney:idempotency"],
				},
			},
		});
		await db.productionImportRun.create({
			data: {
				scope: "qualifying-hotels:sydney:idempotency",
				leaseOwner: crypto.randomUUID(),
				heartbeatAt: new Date(),
				status: "COMPLETED",
				destination: "sydney",
				dryRun: false,
				qualifyingCount: 228,
				fetchedCount: 228,
				unchangedCount: 228,
				exceptionCount: 0,
				completedAt: new Date(),
			},
		});
		expect(await queueProductionRefreshAfterFullImport(false)).toBeNull();
		expect(await queueProductionRefreshAfterFullImport(true)).toBeNull();
		const activeRun = await db.productionImportRun.create({
			data: {
				scope: FULL_UNIVERSE.scope,
				leaseOwner: crypto.randomUUID(),
				heartbeatAt: new Date(),
				status: "RUNNING",
				dryRun: true,
			},
		});
		expect(await queueFullUniverseDryRun()).toBeNull();
		await db.productionImportRun.delete({ where: { id: activeRun.id } });
		await db.agentTask.create({
			data: {
				kind: "production-refresh",
				reason: "Sydney task still active",
				payload: { fullReconciliation: false },
				priority: 600,
				budget: 0,
				dueAt: new Date(),
				subject: "production-hotel-universe-proving:sydney:commit",
			},
		});
		expect(await queueFullUniverseDryRun()).toBeNull();
		await db.agentTask.deleteMany({ where: { kind: "production-refresh" } });
		const queued = await Promise.all([
			queueFullUniverseDryRun(),
			queueFullUniverseDryRun(),
		]);
		expect(queued.filter(Boolean)).toHaveLength(1);
		const dryTask = await db.agentTask.findFirstOrThrow({
			where: { subject: FULL_UNIVERSE.drySubject },
			select: { payload: true },
		});
		expect(productionRefreshPayload(dryTask.payload)).toEqual({
			fullReconciliation: false,
			dryRun: true,
			universeGate: "DRY_RUN",
		});
		await db.agentTask.deleteMany({ where: { kind: "production-refresh" } });
		const snapshot = "2026-09-06T01:00:00.000Z";
		const fullIds = [crypto.randomUUID(), crypto.randomUUID()];
		const digest = await productionIdDigest(fullIds);
		const manifestDigest = "a".repeat(64);
		await db.productionImportRun.create({
			data: {
				scope: FULL_UNIVERSE.scope,
				leaseOwner: crypto.randomUUID(),
				heartbeatAt: new Date(),
				status: "COMPLETED",
				dryRun: true,
				qualifyingCount: 2,
				fetchedCount: 2,
				readRequestCount: 1,
				boundaryEvidence: {
					contractVersion: "2",
					httpMethod: "GET",
					readRequests: 1,
					clientEvidence: "GET_ONLY_HTTP_CLIENT",
					manifestSnapshot: snapshot,
					manifestProductionIds: fullIds,
					manifestProductionIdDigest: digest,
					manifestPayloadDigest: manifestDigest,
				},
				completedAt: new Date(),
			},
		});
		await expect(
			queueApprovedFullUniverseCommit({
				expectedCount: 2,
				snapshot,
				productionIdDigest: "b".repeat(64),
				manifestDigest,
			}),
		).rejects.toThrow("does not match dry-run evidence");
		const commitId = await queueApprovedFullUniverseCommit({
			expectedCount: 2,
			snapshot,
			productionIdDigest: digest,
			manifestDigest,
		});
		expect(commitId).not.toBeNull();
		const commit = await db.agentTask.findUniqueOrThrow({
			where: { id: commitId ?? "" },
			select: { payload: true },
		});
		expect(productionRefreshPayload(commit.payload)).toEqual({
			fullReconciliation: false,
			dryRun: false,
			universeGate: "COMMIT",
			expectedCount: 2,
			snapshot,
			expectedProductionIdDigest: digest,
			expectedManifestDigest: manifestDigest,
		});
		expect(await readFullUniverseProof(true)).toMatchObject({
			runStatus: "COMPLETED",
			dryRun: true,
			qualifyingCount: 2,
			readRequestCount: 1,
			manifestSnapshot: snapshot,
			productionIdDigest: digest,
			manifestDigest,
			manifestValid: true,
		});
		expect(await queueFullUniverseDryRun()).toBeNull();
		await db.agentTask.deleteMany({ where: { kind: "production-refresh" } });
		await db.productionImportRun.create({
			data: {
				scope: FULL_UNIVERSE.scope,
				leaseOwner: crypto.randomUUID(),
				heartbeatAt: new Date(),
				status: "COMPLETED",
				dryRun: false,
				qualifyingCount: 2,
				fetchedCount: 2,
				createdCount: 2,
				exceptionCount: 0,
				boundaryEvidence: {
					contractVersion: "2",
					httpMethod: "GET",
					readRequests: 1,
					clientEvidence: "GET_ONLY_HTTP_CLIENT",
					manifestSnapshot: snapshot,
					manifestProductionIds: fullIds,
					manifestProductionIdDigest: digest,
					manifestPayloadDigest: manifestDigest,
				},
				completedAt: new Date(),
			},
		});
		expect(await queueFullUniverseDryRun()).toBeNull();
		expect(
			await queueApprovedFullUniverseCommit({
				expectedCount: 2,
				snapshot,
				productionIdDigest: digest,
				manifestDigest,
			}),
		).toBeNull();
		const incrementalTaskId =
			await queueProductionRefreshAfterFullImport(false);
		expect(incrementalTaskId).not.toBeNull();
		const reconciliationTaskId =
			await queueProductionRefreshAfterFullImport(true);
		expect(reconciliationTaskId).not.toBeNull();
		const scheduledTasks = await db.agentTask.findMany({
			where: {
				id: { in: [incrementalTaskId ?? "", reconciliationTaskId ?? ""] },
			},
			orderBy: { subject: "asc" },
			select: { payload: true, subject: true },
		});
		expect(scheduledTasks).toEqual([
			{
				payload: { fullReconciliation: true },
				subject: "production-hotel-universe-full",
			},
			{
				payload: { fullReconciliation: false },
				subject: "production-hotel-universe-incremental",
			},
		]);
	});
});
