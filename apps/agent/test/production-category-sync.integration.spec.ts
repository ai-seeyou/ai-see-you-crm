import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import {
	db,
	EntityType,
	ExternalRecordType,
	ExternalSystem,
	MatchActor,
	RecordSource,
} from "@crm/db";
import type { ProductionCategorySnapshot } from "@crm/validation/production-category";
import { syncProductionCategories } from "../agent/lib/production-category-sync";
import { ProductionReadClient } from "../agent/lib/production-client";

const propertyIds = [crypto.randomUUID(), crypto.randomUUID()];
const companyIds = [crypto.randomUUID(), crypto.randomUUID()];
const destinationId = crypto.randomUUID();
const pulseId = crypto.randomUUID();
const runId = crypto.randomUUID();

async function sha256(value: string) {
	const bytes = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(value),
	);
	return [...new Uint8Array(bytes)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

async function fixture() {
	const registry = Array.from({ length: 9 }, (_, index) => ({
		categoryId: `RE-${String(index + 1).padStart(4, "0")}`,
		name: `Category ${index + 1}`,
		evidenceTier: "Certified" as const,
		lifecycleStatus: "active" as const,
	}));
	const records = propertyIds
		.map((productionPropertyId) => ({
			productionPropertyId,
			categoryId: "RE-0001",
			destinationId,
			pulseId,
			runId,
		}))
		.sort((left, right) =>
			left.productionPropertyId.localeCompare(right.productionPropertyId),
		);
	const registryDigest = await sha256(
		registry
			.map(
				(row) =>
					`${row.categoryId}|${row.name}|${row.evidenceTier}|${row.lifecycleStatus}`,
			)
			.join("\n"),
	);
	const certifiedAt = "2026-09-07T00:00:00.000Z";
	const destinationRunDigest = await sha256(
		`${destinationId}|${pulseId}|${runId}|2026-09-01|${certifiedAt}`,
	);
	const membershipDigest = await sha256(
		records
			.map((row) => `${row.productionPropertyId}|${row.categoryId}`)
			.sort()
			.join("\n"),
	);
	const authorityDigest = "a".repeat(64);
	const snapshotId = await sha256(
		`crm-category-v1|${registryDigest}|${destinationRunDigest}|${membershipDigest}|${authorityDigest}`,
	);
	const snapshot: ProductionCategorySnapshot = {
		ok: true,
		contractVersion: "crm-category-v1",
		snapshotId,
		sourceCommit: "b".repeat(40),
		authorityDigest,
		registryDigest,
		destinationRunDigest,
		membershipDigest,
		categoryCount: registry.length,
		destinationCount: 1,
		propertyCount: propertyIds.length,
		membershipCount: records.length,
		registry,
		destinations: [
			{
				destinationId,
				pulseId,
				runId,
				periodStart: "2026-09-01",
				certifiedAt,
			},
		],
	};
	return { snapshot, records };
}

function clientFor(
	snapshot: ProductionCategorySnapshot,
	records: Awaited<ReturnType<typeof fixture>>["records"],
	onMembership = () => undefined,
) {
	return new ProductionReadClient(
		"https://production.example/internal/crm",
		"scoped-token",
		(async (input) => {
			const resource = new URL(String(input)).searchParams.get("resource");
			if (resource === "snapshot") return Response.json(snapshot);
			onMembership();
			return Response.json({
				ok: true,
				contractVersion: "crm-category-v1",
				snapshotId: snapshot.snapshotId,
				records,
				nextCursor: null,
			});
		}) as typeof fetch,
	);
}

async function createHotel(index: number) {
	await db.company.create({
		data: {
			id: companyIds[index],
			name: `Category Hotel ${index + 1}`,
			entityType: EntityType.HOTEL,
			source: RecordSource.IMPORT,
			productionProfile: {
				create: {
					productionPropertyId: propertyIds[index],
					ownershipStatus: "unresolved",
					destinationProductionId: destinationId,
					destinationName: "Test Destination",
					destinationSlug: "test-destination",
					destinationType: "city",
					commercialKnowledge: {},
					sourceUpdatedAt: new Date("2026-09-07T00:00:00.000Z"),
					fetchedAt: new Date("2026-09-07T00:00:00.000Z"),
				},
			},
		},
	});
	await db.externalRef.create({
		data: {
			recordType: ExternalRecordType.COMPANY,
			recordId: companyIds[index] ?? "",
			system: ExternalSystem.PRODUCTION,
			externalId: propertyIds[index] ?? "",
			matchMethod: "production-property-id",
			matchedBy: MatchActor.IMPORT,
			confirmedAt: new Date("2026-09-07T00:00:00.000Z"),
		},
	});
}

beforeAll(async () => {
	const state = await db.productionCategoryState.findUniqueOrThrow({
		where: { id: "core" },
	});
	if (state.snapshotId !== null || state.revision !== 0)
		throw new Error("Category integration database is not fresh");
	await createHotel(0);
});

afterAll(async () => {
	await db.productionCategoryState.update({
		where: { id: "core" },
		data: { snapshotId: null, revision: 0 },
	});
	await db.productionCategorySnapshot.deleteMany({});
	await db.externalRef.deleteMany({
		where: { externalId: { in: propertyIds } },
	});
	await db.company.deleteMany({ where: { id: { in: companyIds } } });
	await db.$disconnect();
});

describe("Production Category database synchronization", () => {
	it("proves, activates, reruns, and relinks one immutable snapshot", async () => {
		const { snapshot, records } = await fixture();
		const client = clientFor(snapshot, records);
		const dryRun = await syncProductionCategories(client, { dryRun: true });
		expect(dryRun).toMatchObject({
			snapshotId: snapshot.snapshotId,
			linkedProperties: 1,
			unresolvedProperties: 1,
			activated: false,
		});
		expect(await db.productionCategorySnapshot.count()).toBe(0);

		const committed = await syncProductionCategories(client, {
			expectedSnapshotId: snapshot.snapshotId,
		});
		expect(committed?.activated).toBe(true);
		expect(await db.productionCoreCategory.count()).toBe(9);
		expect(await db.productionCategoryMembership.count()).toBe(2);
		expect(
			await db.productionCategoryMembership.count({
				where: { companyId: null },
			}),
		).toBe(1);

		await createHotel(1);
		let membershipReads = 0;
		const rerun = await syncProductionCategories(
			clientFor(snapshot, records, () => {
				membershipReads += 1;
			}),
		);
		expect(rerun).toMatchObject({
			activated: false,
			relinkedProperties: 1,
			linkedProperties: 2,
			unresolvedProperties: 0,
		});
		expect(membershipReads).toBe(0);
		expect(
			await db.productionCategoryMembership.count({
				where: { companyId: null },
			}),
		).toBe(0);
		expect(
			await db.productionCategorySnapshot.count({
				where: { id: snapshot.snapshotId },
			}),
		).toBe(1);
	});
});
