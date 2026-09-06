import { describe, expect, it } from "bun:test";
import {
	productionCommercialKnowledgeSchema,
	productionRecommendationSummarySchema,
} from "@crm/validation/production-business";
import { ProductionReadClient } from "../agent/lib/production-client";

const record = {
	productionPropertyId: "20000000-0000-4000-8000-000000000001",
	canonicalName: "Harbour Hotel",
	propertySlug: "harbour-hotel",
	destination: {
		id: "30000000-0000-4000-8000-000000000001",
		name: "Sydney",
		slug: "sydney",
		type: "city",
	},
	country: { name: "Australia", code: "AU" },
	primaryDomain: "example.com",
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
} as const;

describe("ProductionReadClient", () => {
	it.each([
		"2026-09-05T00:00:00",
		"2026-02-30T00:00:00+00:00",
		"2026-09-05T00:00:00+25:00",
		"not-a-date",
	])("rejects invalid governed timestamps %s", (timestamp) => {
		expect(
			productionRecommendationSummarySchema.shape.certifiedAt.safeParse(
				timestamp,
			).success,
		).toBe(false);
		expect(
			productionCommercialKnowledgeSchema.shape.provenance.element.shape.evidenceSightedAt.safeParse(
				timestamp,
			).success,
		).toBe(false);
	});
	it("uses only GET with the scoped bearer token", async () => {
		let requested: Request | undefined;
		const request = async (input: URL | RequestInfo, init?: RequestInit) => {
			requested = new Request(input, init);
			return Response.json({
				ok: true,
				contractVersion: "2",
				snapshot: "2026-09-05T00:00:00.000Z",
				records: [record],
				nextCursor: null,
			});
		};
		const client = new ProductionReadClient(
			"https://production.example/internal/crm",
			"scoped-token",
			request as typeof fetch,
		);
		await client.page({ destination: "sydney", limit: 500 });
		expect(requested?.method).toBe("GET");
		expect(requested?.headers.get("authorization")).toBe("Bearer scoped-token");
		expect(await requested?.text()).toBe("");
		expect(new URL(requested?.url ?? "").searchParams.get("destination")).toBe(
			"sydney",
		);
	});

	it("rejects responses outside the narrow hotel contract", async () => {
		const client = new ProductionReadClient(
			"https://production.example/internal/crm",
			"scoped-token",
			(async () =>
				Response.json({
					ok: true,
					contractVersion: "2",
					snapshot: "2026-09-05T00:00:00.000Z",
					records: [{ ...record, entityType: "RESTAURANT" }],
					nextCursor: null,
				})) as typeof fetch,
		);
		expect(client.page({ limit: 500 })).rejects.toThrow();
	});

	it("reports only an allow-listed upstream failure code", async () => {
		const client = new ProductionReadClient(
			"https://production.example/internal/crm",
			"scoped-token",
			(async () =>
				new Response("private detail", {
					status: 502,
					headers: { "X-CRM-Failure-Code": "RPC_HTTP_400" },
				})) as typeof fetch,
		);
		expect(client.page({ limit: 500 })).rejects.toThrow(
			"Production read failed with RPC_HTTP_400",
		);
	});

	it("reports only a bounded PostgREST failure code", async () => {
		const client = new ProductionReadClient(
			"https://production.example/internal/crm",
			"scoped-token",
			(async () =>
				new Response("private detail", {
					status: 502,
					headers: { "X-CRM-Failure-Code": "RPC_PGRST202" },
				})) as typeof fetch,
		);
		expect(client.page({ limit: 500 })).rejects.toThrow(
			"Production read failed with RPC_PGRST202",
		);
	});

	it("rejects an unbounded upstream failure value", async () => {
		const client = new ProductionReadClient(
			"https://production.example/internal/crm",
			"scoped-token",
			(async () =>
				new Response("private detail", {
					status: 502,
					headers: { "X-CRM-Failure-Code": "RPC_PGRST202_private" },
				})) as typeof fetch,
		);
		expect(client.page({ limit: 500 })).rejects.toThrow(
			"Production read failed with HTTP 502",
		);
	});

	it("rejects provenance source references outside the governed contract", async () => {
		const client = new ProductionReadClient(
			"https://production.example/internal/crm",
			"scoped-token",
			(async () =>
				Response.json({
					ok: true,
					contractVersion: "2",
					snapshot: "2026-09-05T00:00:00.000Z",
					records: [
						{
							...record,
							commercialKnowledge: {
								...record.commercialKnowledge,
								provenance: [
									{
										attribute: "star_rating",
										value: "five-star",
										evidenceClass: "primary",
										evidenceSourceReference: "private-source",
										evidenceSightedAt: "2026-09-05T00:00:00.000Z",
										modelVersion: "governed-v1",
									},
								],
							},
						},
					],
					nextCursor: null,
				})) as typeof fetch,
		);
		expect(client.page({ limit: 500 })).rejects.toThrow();
	});

	it.each([
		"2026-09-05T00:00:00.000Z",
		"2026-09-05T00:00:00.123456+00:00",
		"2026-09-05T10:00:00+10:00",
	])("parses governed timestamps with timezone %s", async (timestamp) => {
		const expanded = {
			...record,
			commercialKnowledge: {
				...record.commercialKnowledge,
				starRating: "five-star",
				locationContexts: ["harbour"],
				provenance: [
					{
						attribute: "star_rating",
						value: "five-star",
						evidenceClass: "approved",
						evidenceSightedAt: timestamp,
						modelVersion: "governed-v1",
					},
				],
			},
			recommendationSummary: {
				pulseId: "40000000-0000-4000-8000-000000000001",
				pulseLabel: "August 2026",
				periodStart: "2026-08-01",
				periodEnd: "2026-08-31",
				generation: "Current",
				certifiedAt: timestamp,
				markets: [
					{
						market: "UK",
						recommendationCount: 12,
						totalPossible: 20,
						recommendationShare: 0.6,
						averageIntentShare: 0.5,
						weightedScore: 8.5,
						primaryCount: 4,
						intentsRecommended: 6,
						topIntentCount: 3,
						topIntentConcentration: 0.25,
						rank: 2,
					},
				],
			},
		};
		const client = new ProductionReadClient(
			"https://production.example/internal/crm",
			"scoped-token",
			(async () =>
				Response.json({
					ok: true,
					contractVersion: "2",
					snapshot: "2026-09-05T00:00:00.000Z",
					records: [expanded],
					nextCursor: null,
				})) as typeof fetch,
		);
		expect((await client.page({ limit: 500 })).records[0]).toEqual(expanded);
	});
});
