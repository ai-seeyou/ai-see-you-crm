import { describe, expect, it } from "bun:test";
import type { ProductionBusiness } from "@crm/validation/production-business";
import type { ProductionReadClient } from "../agent/lib/production-client";
import {
	importProductionHotels,
	productionManifestDigest,
} from "../agent/lib/production-import";

const hotel = (number: number): ProductionBusiness => ({
	productionPropertyId: `20000000-0000-4000-8000-${String(number).padStart(12, "0")}`,
	canonicalName: `Sydney Hotel ${number}`,
	propertySlug: `sydney-hotel-${number}`,
	destination: {
		id: "30000000-0000-4000-8000-000000000001",
		name: "Sydney",
		slug: "sydney",
		type: "city",
	},
	country: { name: "Australia", code: "AU" },
	primaryDomain: number < 3 ? "shared.example" : null,
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

function sydneyClient() {
	const calls: Array<{ cursor?: string; snapshot?: string }> = [];
	const client = {
		async page(input: { cursor?: string; snapshot?: string }) {
			calls.push(input);
			const first = input.cursor === undefined;
			return {
				ok: true as const,
				contractVersion: "2" as const,
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
	it("binds approval evidence to the complete canonical payload", async () => {
		const original = hotel(1);
		const changed = {
			...original,
			commercialKnowledge: {
				...original.commercialKnowledge,
				starRating: "five-star",
			},
		};
		expect(await productionManifestDigest([original])).not.toBe(
			await productionManifestDigest([changed]),
		);
		expect(await productionManifestDigest([hotel(2), original])).toBe(
			await productionManifestDigest([original, hotel(2)]),
		);
	});

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
				contractVersion: "2",
				httpMethod: "GET",
				readRequests: 2,
				clientEvidence: "GET_ONLY_HTTP_CLIENT",
				manifestSnapshot: "2026-09-05T00:00:00.000Z",
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
