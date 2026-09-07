import { afterEach, describe, expect, it } from "bun:test";
import { db } from "@crm/db";
import {
	productionCategoryTaskPayload,
	queueProductionCategoryRequest,
	runProductionCategoryTask,
} from "../agent/lib/production-category-task";
import { ProductionReadClient } from "../agent/lib/production-client";

const prefix = "production-category-sync:";

afterEach(async () => {
	await db.agentTask.deleteMany({ where: { subject: { startsWith: prefix } } });
});

describe("Production Category task persistence", () => {
	it("queues each exact deployed request once without credentials", async () => {
		const request = `DRY_RUN:${crypto.randomUUID()}`;
		const first = await queueProductionCategoryRequest(request);
		const second = await queueProductionCategoryRequest(request);
		expect(first).toBe(second);
		const task = await db.agentTask.findUniqueOrThrow({
			where: { id: first ?? "" },
		});
		expect(task.kind).toBe("production-category-sync");
		expect(JSON.stringify(task.payload)).not.toContain("TOKEN");
		expect(JSON.stringify(task.payload)).not.toContain("URL");
	});

	it("stores bounded dry-run evidence and replays it without another read", async () => {
		const taskId = await queueProductionCategoryRequest(
			`DRY_RUN:${crypto.randomUUID()}`,
		);
		const task = await db.agentTask.findUniqueOrThrow({
			where: { id: taskId ?? "" },
		});
		let calls = 0;
		const result = {
			snapshotId: "a".repeat(64),
			categories: 9,
			properties: 4_272,
			memberships: 13_184,
			linkedProperties: 4_261,
			unresolvedProperties: 11,
			activated: false,
			relinkedProperties: 0,
			readRequests: 29,
			authorityDigest: "b".repeat(64),
			registryDigest: "c".repeat(64),
			destinationRunDigest: "d".repeat(64),
			membershipDigest: "e".repeat(64),
		};
		const sync = async () => {
			calls += 1;
			return result;
		};
		const client = new ProductionReadClient(
			"https://production.test/read",
			"token",
		);
		await runProductionCategoryTask(
			task.id,
			productionCategoryTaskPayload(task.payload),
			client,
			sync,
		);
		const saved = await db.agentTask.findUniqueOrThrow({
			where: { id: task.id },
		});
		await runProductionCategoryTask(
			task.id,
			productionCategoryTaskPayload(saved.payload),
			client,
			sync,
		);
		expect(calls).toBe(1);
		expect(saved.payload).toMatchObject({
			evidence: {
				snapshotId: result.snapshotId,
				categoryCount: result.categories,
				propertyCount: result.properties,
				membershipCount: result.memberships,
				linkedPropertyCount: result.linkedProperties,
				unresolvedPropertyCount: result.unresolvedProperties,
				activated: false,
			},
		});
	});

	it("rejects commit evidence that did not activate the approved snapshot", async () => {
		const approved = "a".repeat(64);
		const taskId = await queueProductionCategoryRequest(`COMMIT:${approved}`);
		const task = await db.agentTask.findUniqueOrThrow({
			where: { id: taskId ?? "" },
		});
		const client = new ProductionReadClient(
			"https://production.test/read",
			"token",
		);
		await expect(
			runProductionCategoryTask(
				task.id,
				productionCategoryTaskPayload(task.payload),
				client,
				async () => ({
					snapshotId: approved,
					categories: 9,
					properties: 4_272,
					memberships: 13_184,
					linkedProperties: 4_261,
					unresolvedProperties: 11,
					activated: false,
					relinkedProperties: 0,
					readRequests: 29,
					authorityDigest: "b".repeat(64),
					registryDigest: "c".repeat(64),
					destinationRunDigest: "d".repeat(64),
					membershipDigest: "e".repeat(64),
				}),
			),
		).rejects.toThrow("activation evidence does not match");
	});

	it("fails closed without the deployed read capability", async () => {
		const endpoint = process.env.PRODUCTION_READ_URL;
		const token = process.env.PRODUCTION_READ_TOKEN;
		delete process.env.PRODUCTION_READ_URL;
		delete process.env.PRODUCTION_READ_TOKEN;
		try {
			const taskId = await queueProductionCategoryRequest(
				`DRY_RUN:${crypto.randomUUID()}`,
			);
			const task = await db.agentTask.findUniqueOrThrow({
				where: { id: taskId ?? "" },
			});
			await expect(
				runProductionCategoryTask(
					task.id,
					productionCategoryTaskPayload(task.payload),
				),
			).rejects.toThrow("Production read capability is not configured");
		} finally {
			if (endpoint === undefined) delete process.env.PRODUCTION_READ_URL;
			else process.env.PRODUCTION_READ_URL = endpoint;
			if (token === undefined) delete process.env.PRODUCTION_READ_TOKEN;
			else process.env.PRODUCTION_READ_TOKEN = token;
		}
	});
});
