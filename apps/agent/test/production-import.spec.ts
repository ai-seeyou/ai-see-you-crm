import { describe, expect, it } from "bun:test";
import type { ProductionBusiness } from "@crm/validation/production-business";
import type { ProductionReadClient } from "../agent/lib/production-client";
import { importProductionHotels } from "../agent/lib/production-import";

const hotel = (number: number): ProductionBusiness => ({
	productionPropertyId: `20000000-0000-4000-8000-${String(number).padStart(12, "0")}`,
	canonicalName: `Sydney Hotel ${number}`,
	destination: {
		id: "30000000-0000-4000-8000-000000000001",
		name: "Sydney",
		slug: "sydney",
	},
	country: { name: "Australia", code: "AU" },
	primaryDomain: number < 3 ? "shared.example" : null,
	chain: null,
	entityType: "HOTEL",
	vertical: "HOTEL",
	firstQualifiedAt: "2026-09-01T00:00:00.000Z",
	sourceUpdatedAt: "2026-09-05T00:00:00.000Z",
});

function sydneyClient() {
	const calls: Array<{ cursor?: string; snapshot?: string }> = [];
	const client = {
		async page(input: { cursor?: string; snapshot?: string }) {
			calls.push(input);
			const first = input.cursor === undefined;
			return {
				ok: true as const,
				contractVersion: "1" as const,
				snapshot: "2026-09-05T00:00:00.000Z",
				records: Array.from({ length: first ? 200 : 28 }, (_, index) =>
					hotel(index + (first ? 1 : 201)),
				),
				nextCursor: first ? "page-2" : null,
			};
		},
	} as ProductionReadClient;
	return { calls, client };
}

describe("Production hotel import proof", () => {
	it("proves the 228-hotel Sydney contract without CRM writes", async () => {
		const { calls, client } = sydneyClient();
		const result = await importProductionHotels(client, {
			destination: "sydney",
			dryRun: true,
			expectedCount: 228,
			audit: false,
		});
		expect(result).toEqual({
			qualifying: 228,
			created: 0,
			updated: 0,
			unchanged: 0,
			exceptions: 0,
			destinations: 1,
			countries: 1,
			withChainIdentifier: 0,
			withoutChainIdentifier: 228,
			requiringReview: 0,
			staleReferences: 0,
			snapshot: "2026-09-05T00:00:00.000Z",
			boundaryEvidence: {
				contractVersion: "1",
				httpMethod: "GET",
				readRequests: 2,
				clientEvidence: "GET_ONLY_HTTP_CLIENT",
			},
		});
		expect(calls[1]?.snapshot).toBe("2026-09-05T00:00:00.000Z");
		expect(calls[1]?.cursor).toBe("page-2");
	});

	it("rejects an unexpected count before applying the manifest", async () => {
		const { client } = sydneyClient();
		await expect(
			importProductionHotels(client, {
				destination: "sydney",
				dryRun: true,
				expectedCount: 227,
				audit: false,
			}),
		).rejects.toThrow("Expected 227 qualifying hotels, received 228");
	});
});
