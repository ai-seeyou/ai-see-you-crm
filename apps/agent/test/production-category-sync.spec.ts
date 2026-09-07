import { describe, expect, it } from "bun:test";
import type {
	ProductionCategoryMembership,
	ProductionCategorySnapshot,
} from "@crm/validation/production-category";
import {
	productionCategorySyncMode,
	verifyProductionCategoryPayload,
} from "../agent/lib/production-category-sync";
import { ProductionReadClient } from "../agent/lib/production-client";
import { shouldSyncProductionCategories } from "../agent/lib/production-refresh";

async function sha256(value: string) {
	const bytes = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(value),
	);
	return [...new Uint8Array(bytes)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

const membership: ProductionCategoryMembership = {
	productionPropertyId: "10000000-0000-4000-8000-000000000001",
	categoryId: "RE-0001",
	destinationId: "20000000-0000-4000-8000-000000000001",
	pulseId: "30000000-0000-4000-8000-000000000001",
	runId: "40000000-0000-4000-8000-000000000001",
};

async function snapshot(): Promise<ProductionCategorySnapshot> {
	const authorityDigest = "a".repeat(64);
	const registry = Array.from({ length: 9 }, (_, index) => ({
		categoryId: `RE-${String(index + 1).padStart(4, "0")}`,
		name: `Category ${index + 1}`,
		evidenceTier: "Certified" as const,
		lifecycleStatus: "active" as const,
	}));
	const registryDigest = await sha256(
		registry
			.map(
				(row) =>
					`${row.categoryId}|${row.name}|${row.evidenceTier}|${row.lifecycleStatus}`,
			)
			.join("\n"),
	);
	const destinationRunDigest = await sha256(
		"20000000-0000-4000-8000-000000000001|30000000-0000-4000-8000-000000000001|40000000-0000-4000-8000-000000000001|2026-09-01|2026-09-07T00:00:00.000Z",
	);
	const membershipDigest = await sha256(
		"10000000-0000-4000-8000-000000000001|RE-0001",
	);
	const snapshotId = await sha256(
		`crm-category-v1|${registryDigest}|${destinationRunDigest}|${membershipDigest}|${authorityDigest}`,
	);
	return {
		ok: true,
		contractVersion: "crm-category-v1",
		snapshotId,
		sourceCommit: "b".repeat(40),
		authorityDigest,
		registryDigest,
		destinationRunDigest,
		membershipDigest,
		categoryCount: 9,
		destinationCount: 1,
		propertyCount: 1,
		membershipCount: 1,
		registry,
		destinations: [
			{
				destinationId: membership.destinationId,
				pulseId: membership.pulseId,
				runId: membership.runId,
				periodStart: "2026-09-01",
				certifiedAt: "2026-09-07T00:00:00.000Z",
			},
		],
	};
}

describe("Production Category synchronization", () => {
	it("requires proof before the first active snapshot", () => {
		expect(productionCategorySyncMode(null, {})).toBe("SKIP");
		expect(productionCategorySyncMode(null, { dryRun: true })).toBe("DRY_RUN");
		expect(
			productionCategorySyncMode(null, { expectedSnapshotId: "a".repeat(64) }),
		).toBe("SYNC");
		expect(productionCategorySyncMode("a".repeat(64), {})).toBe("SYNC");
	});
	it("accepts an exact governed snapshot and membership digest", async () => {
		await expect(
			verifyProductionCategoryPayload(await snapshot(), [membership]),
		).resolves.toBeUndefined();
	});

	it("rejects duplicate membership pairs", async () => {
		const manifest = await snapshot();
		await expect(
			verifyProductionCategoryPayload({ ...manifest, membershipCount: 2 }, [
				membership,
				membership,
			]),
		).rejects.toThrow("ordered and unique");
	});

	it("rejects a registry outside the approved core count", async () => {
		const manifest = await snapshot();
		await expect(
			verifyProductionCategoryPayload({ ...manifest, categoryCount: 8 }, [
				membership,
			]),
		).rejects.toThrow("approved core count");
	});

	it("rejects conflicting destinations for one property", async () => {
		const manifest = await snapshot();
		const secondDestination = {
			destinationId: "20000000-0000-4000-8000-000000000002",
			pulseId: "30000000-0000-4000-8000-000000000002",
			runId: "40000000-0000-4000-8000-000000000002",
			periodStart: "2026-09-01",
			certifiedAt: "2026-09-07T00:00:00.000Z",
		};
		const secondMembership = {
			...membership,
			categoryId: "RE-0002",
			destinationId: secondDestination.destinationId,
			pulseId: secondDestination.pulseId,
			runId: secondDestination.runId,
		};
		const destinations = [...manifest.destinations, secondDestination];
		const destinationRunDigest = await sha256(
			destinations
				.map(
					(row) =>
						`${row.destinationId}|${row.pulseId}|${row.runId}|${row.periodStart}|${row.certifiedAt}`,
				)
				.join("\n"),
		);
		const membershipDigest = await sha256(
			[
				`${membership.productionPropertyId}|${membership.categoryId}`,
				`${secondMembership.productionPropertyId}|${secondMembership.categoryId}`,
			].join("\n"),
		);
		const snapshotId = await sha256(
			`crm-category-v1|${manifest.registryDigest}|${destinationRunDigest}|${membershipDigest}|${manifest.authorityDigest}`,
		);
		await expect(
			verifyProductionCategoryPayload(
				{
					...manifest,
					snapshotId,
					destinations,
					destinationRunDigest,
					destinationCount: 2,
					membershipDigest,
					membershipCount: 2,
				},
				[membership, secondMembership],
			),
		).rejects.toThrow("conflicting destinations");
	});

	it("uses only bounded GET requests on the existing endpoint", async () => {
		const manifest = await snapshot();
		const requests: Request[] = [];
		const client = new ProductionReadClient(
			"https://production.example/internal/crm",
			"scoped-token",
			(async (input, init) => {
				const request = new Request(input, init);
				requests.push(request);
				const resource = new URL(request.url).searchParams.get("resource");
				return Response.json(
					resource === "snapshot"
						? manifest
						: {
								ok: true,
								contractVersion: "crm-category-v1",
								snapshotId: manifest.snapshotId,
								records: [membership],
								nextCursor: null,
							},
				);
			}) as typeof fetch,
		);
		await client.categorySnapshot();
		await client.categoryMembershipPage({
			snapshotId: manifest.snapshotId,
			limit: 500,
		});
		expect(requests.map((request) => request.method)).toEqual(["GET", "GET"]);
		expect(requests.every((request) => request.body === null)).toBe(true);
		expect(new URL(requests[0]?.url ?? "").searchParams.get("resource")).toBe(
			"snapshot",
		);
		expect(new URL(requests[1]?.url ?? "").searchParams.get("resource")).toBe(
			"memberships",
		);
	});

	it("runs only after committed universe proving tasks", () => {
		expect(shouldSyncProductionCategories({ fullReconciliation: false })).toBe(
			true,
		);
		expect(
			shouldSyncProductionCategories({
				fullReconciliation: true,
				universeGate: "COMMIT",
				snapshot: "2026-09-07T00:00:00.000Z",
				expectedCount: 1,
				expectedProductionIdDigest: "a".repeat(64),
				expectedManifestDigest: "b".repeat(64),
			}),
		).toBe(false);
		expect(
			shouldSyncProductionCategories({
				fullReconciliation: false,
				dryRun: true,
			}),
		).toBe(false);
	});
});
