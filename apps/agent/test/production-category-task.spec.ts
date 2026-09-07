import { describe, expect, it } from "bun:test";
import {
	productionCategoryFailureOutcome,
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

	it("preserves only bounded Production read failures", () => {
		expect(
			productionCategoryFailureOutcome(
				new Error("Production read failed with RPC_HTTP_504"),
			),
		).toBe("Production Category attempt failed: RPC_HTTP_504.");
		expect(
			productionCategoryFailureOutcome(
				new Error("Production read failed with RPC_PGRST202"),
			),
		).toBe("Production Category attempt failed: RPC_PGRST202.");
		expect(
			productionCategoryFailureOutcome(
				new Error("Production read failed with HTTP 502"),
			),
		).toBe("Production Category attempt failed: HTTP 502.");
		expect(
			productionCategoryFailureOutcome(
				new Error("Production read failed with RPC_UNKNOWN"),
			),
		).toBe("Production Category attempt failed: RPC_UNKNOWN.");
	});

	it("drops malicious or extended Production read failures", () => {
		expect(
			productionCategoryFailureOutcome(
				new Error("Production read failed with RPC_HTTP_503 private-value"),
			),
		).toBe("Production Category attempt failed: PRODUCTION_READ.");
		expect(
			productionCategoryFailureOutcome(
				new Error("Production read failed with RPC_57014"),
			),
		).toBe("Production Category attempt failed: PRODUCTION_READ.");
	});
});
