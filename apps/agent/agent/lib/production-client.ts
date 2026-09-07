import { productionBusinessPageSchema } from "@crm/validation/production-business";
import {
	productionCategoryMembershipPageSchema,
	productionCategorySnapshotSchema,
} from "@crm/validation/production-category";

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
		const response = await this.get(url);
		return productionBusinessPageSchema.parse(await response.json());
	}

	async categorySnapshot() {
		const url = new URL(this.endpoint);
		url.searchParams.set("resource", "snapshot");
		const response = await this.get(url);
		return productionCategorySnapshotSchema.parse(await response.json());
	}

	async categoryMembershipPage(input: {
		snapshotId: string;
		cursor?: string;
		limit: number;
	}) {
		const url = new URL(this.endpoint);
		url.searchParams.set("resource", "memberships");
		url.searchParams.set("snapshotId", input.snapshotId);
		url.searchParams.set("limit", String(input.limit));
		if (input.cursor) url.searchParams.set("cursor", input.cursor);
		const response = await this.get(url);
		return productionCategoryMembershipPageSchema.parse(await response.json());
	}

	private async get(url: URL) {
		const response = await this.request(url, {
			method: "GET",
			headers: { authorization: `Bearer ${this.token}` },
		});
		if (!response.ok) {
			const failureCode = response.headers.get("x-crm-failure-code");
			if (
				failureCode &&
				/^RPC_(?:HTTP_\d{3}|PGRST\d{3}|UNKNOWN)$/.test(failureCode)
			)
				throw new Error(`Production read failed with ${failureCode}`);
			throw new Error(`Production read failed with HTTP ${response.status}`);
		}
		return response;
	}
}
