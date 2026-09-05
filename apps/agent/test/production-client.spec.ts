import { describe, expect, it } from "bun:test";
import { ProductionReadClient } from "../agent/lib/production-client";

const record = {
	productionPropertyId: "20000000-0000-4000-8000-000000000001",
	canonicalName: "Harbour Hotel",
	destination: {
		id: "30000000-0000-4000-8000-000000000001",
		name: "Sydney",
		slug: "sydney",
	},
	country: { name: "Australia", code: "AU" },
	primaryDomain: "example.com",
	chain: null,
	entityType: "HOTEL",
	vertical: "HOTEL",
	firstQualifiedAt: "2026-09-01T00:00:00.000Z",
	sourceUpdatedAt: "2026-09-05T00:00:00.000Z",
} as const;

describe("ProductionReadClient", () => {
	it("uses only GET with the scoped bearer token", async () => {
		let requested: Request | undefined;
		const request = async (input: URL | RequestInfo, init?: RequestInit) => {
			requested = new Request(input, init);
			return Response.json({
				ok: true,
				contractVersion: "1",
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
					contractVersion: "1",
					snapshot: "2026-09-05T00:00:00.000Z",
					records: [{ ...record, entityType: "RESTAURANT" }],
					nextCursor: null,
				})) as typeof fetch,
		);
		expect(client.page({ limit: 500 })).rejects.toThrow();
	});
});
