import { db, type Prisma } from "@crm/db";
import { PRIORITY } from "@crm/db/agent-tasks";
import { z } from "zod";
import { PRODUCTION_CATEGORY } from "./production-category-config";
import {
	type ProductionCategorySyncResult,
	syncProductionCategories,
} from "./production-category-sync";
import { ProductionReadClient } from "./production-client";

const digest = z.string().regex(/^[a-f0-9]{64}$/);
const requestSchema = z.discriminatedUnion("mode", [
	z
		.object({ mode: z.literal("DRY_RUN"), requestId: z.string().uuid() })
		.strict(),
	z.object({ mode: z.literal("COMMIT"), expectedSnapshotId: digest }).strict(),
]);
const evidenceSchema = z
	.object({
		snapshotId: digest,
		categoryCount: z.number().int().nonnegative(),
		propertyCount: z.number().int().nonnegative(),
		membershipCount: z.number().int().nonnegative(),
		linkedPropertyCount: z.number().int().nonnegative(),
		unresolvedPropertyCount: z.number().int().nonnegative(),
		authorityDigest: digest,
		registryDigest: digest,
		destinationRunDigest: digest,
		membershipDigest: digest,
		activated: z.boolean(),
		readRequests: z.number().int().positive(),
	})
	.strict();
const payloadSchema = z.discriminatedUnion("mode", [
	z
		.object({
			mode: z.literal("DRY_RUN"),
			requestId: z.string().uuid(),
			evidence: evidenceSchema.optional(),
		})
		.strict(),
	z
		.object({
			mode: z.literal("COMMIT"),
			expectedSnapshotId: digest,
			evidence: evidenceSchema.optional(),
		})
		.strict(),
]);

export type ProductionCategoryTaskPayload = z.infer<typeof payloadSchema>;

export function productionCategoryTaskPayload(value: Prisma.JsonValue | null) {
	return payloadSchema.parse(value);
}

export function productionCategoryRequest(value: string | undefined) {
	if (!value) return null;
	const separator = value.indexOf(":");
	if (separator < 0) throw new Error("Production Category request is invalid");
	const mode = value.slice(0, separator);
	const identity = value.slice(separator + 1);
	return mode === "DRY_RUN"
		? requestSchema.parse({ mode, requestId: identity })
		: requestSchema.parse({ mode, expectedSnapshotId: identity });
}

function subjectFor(payload: ProductionCategoryTaskPayload) {
	return payload.mode === "DRY_RUN"
		? `production-category-sync:dry-run:${payload.requestId}`
		: `production-category-sync:commit:${payload.expectedSnapshotId}`;
}

export async function queueProductionCategoryRequest(
	value: string | undefined = process.env.PRODUCTION_CATEGORY_SYNC_REQUEST,
) {
	const payload = productionCategoryRequest(value);
	if (!payload) return null;
	const subject = subjectFor(payload);
	return db.$transaction(async (tx) => {
		await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${subject}))`;
		const existing = await tx.agentTask.findFirst({
			where: { kind: "production-category-sync", subject },
			select: { id: true },
		});
		if (existing) return existing.id;
		return (
			await tx.agentTask.create({
				data: {
					kind: "production-category-sync",
					reason:
						payload.mode === "DRY_RUN"
							? "Validate the governed Production Category snapshot."
							: "Activate the approved governed Production Category snapshot.",
					payload,
					priority: PRIORITY.productionCategorySync,
					budget: 0,
					dueAt: new Date(),
					subject,
				},
				select: { id: true },
			})
		).id;
	});
}

function taskEvidence(result: ProductionCategorySyncResult) {
	return {
		snapshotId: result.snapshotId,
		categoryCount: result.categories,
		propertyCount: result.properties,
		membershipCount: result.memberships,
		linkedPropertyCount: result.linkedProperties,
		unresolvedPropertyCount: result.unresolvedProperties,
		authorityDigest: result.authorityDigest,
		registryDigest: result.registryDigest,
		destinationRunDigest: result.destinationRunDigest,
		membershipDigest: result.membershipDigest,
		activated: result.activated,
		readRequests: result.readRequests,
	};
}

const BOUNDED_PRODUCTION_READ_FAILURE =
	/^Production read failed with (RPC_(?:HTTP_\d{3}|PGRST\d{3}|UNKNOWN)|HTTP \d{3})$/;

export function productionCategoryFailureOutcome(error: Error | null) {
	if (
		error instanceof DOMException &&
		(error.name === "TimeoutError" || error.name === "AbortError")
	)
		return "Production Category attempt failed: REQUEST_TIMEOUT.";
	if (error instanceof Error) {
		const boundedReadFailure = BOUNDED_PRODUCTION_READ_FAILURE.exec(
			error.message,
		);
		if (boundedReadFailure)
			return `Production Category attempt failed: ${boundedReadFailure[1]}.`;
		if (error.message.startsWith("Production read failed"))
			return "Production Category attempt failed: PRODUCTION_READ.";
		if (error.message.startsWith("Production Category"))
			return "Production Category attempt failed: CONTRACT_VALIDATION.";
	}
	return "Production Category attempt failed: UNKNOWN.";
}

async function saveFailure(taskId: string, error: Error | null) {
	await db.agentTask.updateMany({
		where: { id: taskId, finishedAt: null },
		data: { outcome: productionCategoryFailureOutcome(error) },
	});
}

export async function runProductionCategoryTask(
	taskId: string,
	payload: ProductionCategoryTaskPayload,
	client?: ProductionReadClient,
	sync: typeof syncProductionCategories = syncProductionCategories,
) {
	try {
		return await runProductionCategoryTaskAttempt(
			taskId,
			payload,
			client,
			sync,
		);
	} catch (error) {
		await saveFailure(taskId, error instanceof Error ? error : null).catch(
			() => {},
		);
		throw error;
	}
}

async function runProductionCategoryTaskAttempt(
	taskId: string,
	payload: ProductionCategoryTaskPayload,
	client?: ProductionReadClient,
	sync: typeof syncProductionCategories = syncProductionCategories,
) {
	if (payload.evidence)
		return `${payload.mode === "DRY_RUN" ? "Validated" : "Processed"} ${payload.evidence.membershipCount} governed Category memberships. Snapshot ${payload.evidence.snapshotId}.`;
	const endpoint = process.env.PRODUCTION_READ_URL;
	const token = process.env.PRODUCTION_READ_TOKEN;
	if (!client && (!endpoint || !token))
		throw new Error("Production read capability is not configured");
	const result = await sync(
		client ?? new ProductionReadClient(endpoint ?? "", token ?? ""),
		payload.mode === "DRY_RUN"
			? { dryRun: true }
			: { expectedSnapshotId: payload.expectedSnapshotId },
	);
	if (!result)
		throw new Error("Production Category synchronization was skipped");
	if (payload.mode === "DRY_RUN" && result.activated)
		throw new Error("Production Category dry-run changed active state");
	let activeSnapshotMatches = false;
	if (payload.mode === "COMMIT") {
		const active = await db.productionCategoryState.findUniqueOrThrow({
			where: { id: PRODUCTION_CATEGORY.stateId },
			select: { snapshotId: true },
		});
		activeSnapshotMatches = active.snapshotId === payload.expectedSnapshotId;
		if (
			result.snapshotId !== payload.expectedSnapshotId ||
			!activeSnapshotMatches
		)
			throw new Error("Production Category activation evidence does not match");
	}
	const evidence = taskEvidence({
		...result,
		activated: payload.mode === "COMMIT" ? activeSnapshotMatches : false,
	});
	const saved = await db.agentTask.updateMany({
		where: { id: taskId, finishedAt: null },
		data: { payload: { ...payload, evidence } },
	});
	if (saved.count !== 1)
		throw new Error("Production Category task evidence was not saved");
	return `${payload.mode === "DRY_RUN" ? "Validated" : "Processed"} ${result.memberships} governed Category memberships. Snapshot ${result.snapshotId}.`;
}
