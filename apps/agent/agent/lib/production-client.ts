import { productionBusinessPageSchema } from "@crm/validation/production-business";

export type ProductionPageRequest = {
	destination?: string;
	updatedSince?: string;
	cursor?: string;
	snapshot?: string;
	limit: number;
};

export class ProductionReadClient {
	constructor(
		private readonly endpoint: string,
		private readonly token: string,
		private readonly request: typeof fetch = fetch,
	) {
		const url = new URL(endpoint);
		if (url.protocol !== "https:" && url.hostname !== "127.0.0.1") {
			throw new Error("Production read endpoint must use HTTPS");
		}
		if (!token) throw new Error("Production read token is not configured");
	}

	async page(input: ProductionPageRequest) {
		const url = new URL(this.endpoint);
		url.searchParams.set("limit", String(input.limit));
		if (input.destination)
			url.searchParams.set("destination", input.destination);
		if (input.updatedSince)
			url.searchParams.set("updatedSince", input.updatedSince);
		if (input.cursor) url.searchParams.set("cursor", input.cursor);
		if (input.snapshot) url.searchParams.set("snapshot", input.snapshot);
		const response = await this.request(url, {
			method: "GET",
			headers: { authorization: `Bearer ${this.token}` },
		});
		if (!response.ok) {
			throw new Error(`Production read failed with HTTP ${response.status}`);
		}
		return productionBusinessPageSchema.parse(await response.json());
	}
}
