import { describe, expect, it } from "bun:test";
import {
	productionCategoryRequest,
	productionCategoryTaskPayload,
} from "../agent/lib/production-category-task";

describe("Production Category durable task", () => {
	it("parses an explicit dry-run request", () => {
		const requestId = "10000000-0000-4000-8000-000000000001";
		expect(productionCategoryRequest(`DRY_RUN:${requestId}`)).toEqual({
			mode: "DRY_RUN",
			requestId,
		});
	});

	it("parses an exact approved snapshot commit", () => {
		expect(productionCategoryRequest(`COMMIT:${"a".repeat(64)}`)).toEqual({
			mode: "COMMIT",
			expectedSnapshotId: "a".repeat(64),
		});
	});

	it("rejects unknown operations and extra payload fields", () => {
		expect(() => productionCategoryRequest("SYNC:value")).toThrow();
		expect(() =>
			productionCategoryTaskPayload({
				mode: "DRY_RUN",
				requestId: "10000000-0000-4000-8000-000000000001",
				token: "must-not-enter-task-payload",
			}),
		).toThrow();
	});

	it("does nothing without an operator request", () => {
		expect(productionCategoryRequest(undefined)).toBeNull();
	});
});
