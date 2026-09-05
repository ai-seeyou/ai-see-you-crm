import { db, type Prisma } from "@crm/db";
import { PRIORITY } from "@crm/db/agent-tasks";
import { z } from "zod";
import { ProductionReadClient } from "./production-client";
import { importProductionHotels } from "./production-import";
import { PRODUCTION_IMPORT } from "./production-import-config";

const payloadSchema = z
	.object({
		fullReconciliation: z.boolean(),
		destination: z.string().min(1).optional(),
		expectedCount: z.number().int().nonnegative().optional(),
		dryRun: z.boolean().optional(),
		snapshot: z.string().datetime().optional(),
	})
	.strict();
export type ProductionRefreshPayload = z.infer<typeof payloadSchema>;
const subjectFor = (payload: ProductionRefreshPayload) => {
	if (payload.destination) {
		return `production-hotel-universe-proving:${payload.destination.toLowerCase()}:${payload.dryRun ? "dry-run" : "commit"}`;
	}
	return payload.fullReconciliation
		? "production-hotel-universe-full"
		: "production-hotel-universe-incremental";
};

export function productionRefreshPayload(
	value: Prisma.JsonValue | null,
): ProductionRefreshPayload {
	return payloadSchema.parse(value);
}

export async function queueProductionRefresh(fullReconciliation: boolean) {
	return queueProductionRefreshTask({ fullReconciliation });
}

export async function queueProductionRefreshTask(
	input: ProductionRefreshPayload,
) {
	const payload = payloadSchema.parse(input);
	if (payload.fullReconciliation && payload.destination) {
		throw new Error("A full reconciliation cannot use a destination filter");
	}
	if (payload.snapshot && payload.dryRun) {
		throw new Error("A dry-run cannot resume a pinned snapshot");
	}
	if (payload.destination && !payload.dryRun && !payload.snapshot) {
		throw new Error("A destination commit requires a pinned snapshot");
	}
	if (payload.destination && payload.expectedCount === undefined) {
		throw new Error("A destination task requires an expected count");
	}
	const subject = subjectFor(payload);
	const pending = await db.agentTask.findFirst({
		where: { kind: "production-refresh", subject, finishedAt: null },
		select: { id: true },
	});
	if (pending) return pending.id;
	try {
		return (
			await db.agentTask.create({
				data: {
					kind: "production-refresh",
					reason: payload.destination
						? `Prove the ${payload.destination} Production hotel universe.`
						: payload.fullReconciliation
							? "Reconcile the complete Production hotel universe."
							: "Import newly qualifying Production hotels.",
					payload,
					priority: PRIORITY.productionRefresh,
					budget: 0,
					dueAt: new Date(),
					subject,
				},
				select: { id: true },
			})
		).id;
	} catch (error) {
		const raced = await db.agentTask.findFirst({
			where: { kind: "production-refresh", subject, finishedAt: null },
			select: { id: true },
		});
		if (!raced) throw error;
		return raced.id;
	}
}

const boundaryEvidenceSchema = z.object({
	manifestSnapshot: z.string().datetime(),
});

export async function queueSydneyProductionDryRun() {
	const completed = await db.productionImportRun.findMany({
		where: {
			scope: "qualifying-hotels:sydney",
			destination: "sydney",
			dryRun: true,
			status: "COMPLETED",
			qualifyingCount: 228,
		},
		orderBy: { completedAt: "desc" },
		select: { boundaryEvidence: true },
	});
	if (
		completed.some(
			(run) => boundaryEvidenceSchema.safeParse(run.boundaryEvidence).success,
		)
	) {
		return null;
	}
	return queueProductionRefreshTask({
		fullReconciliation: false,
		destination: "sydney",
		expectedCount: 228,
		dryRun: true,
	});
}

export async function approveSydneyProductionProving() {
	const dryRun = await db.productionImportRun.findFirst({
		where: {
			scope: "qualifying-hotels:sydney",
			destination: "sydney",
			dryRun: true,
			status: "COMPLETED",
			qualifyingCount: 228,
		},
		orderBy: { completedAt: "desc" },
		select: { boundaryEvidence: true },
	});
	if (!dryRun) {
		throw new Error("A completed 228-hotel Sydney dry-run is required");
	}
	const evidence = boundaryEvidenceSchema.parse(dryRun.boundaryEvidence);
	return queueProductionRefreshTask({
		fullReconciliation: false,
		destination: "sydney",
		expectedCount: 228,
		dryRun: false,
		snapshot: evidence.manifestSnapshot,
	});
}

export async function runProductionRefresh(
	taskId: string,
	payload: ProductionRefreshPayload,
) {
	const endpoint = process.env.PRODUCTION_READ_URL;
	const token = process.env.PRODUCTION_READ_TOKEN;
	if (!endpoint || !token)
		return "Production read capability is not configured.";
	await db.agentTask.update({
		where: { id: taskId },
		data: { leasedUntil: new Date(Date.now() + PRODUCTION_IMPORT.leaseMs) },
	});
	const result = await importProductionHotels(
		new ProductionReadClient(endpoint, token),
		{
			dryRun: payload.dryRun ?? false,
			fullReconciliation: payload.fullReconciliation,
			destination: payload.destination,
			expectedCount: payload.expectedCount,
			snapshot: payload.snapshot,
		},
	);
	const action = payload.dryRun ? "Validated" : "Processed";
	return `${action} ${result.qualifying} qualifying hotels: ${result.created} created, ${result.updated} updated, ${result.unchanged} unchanged. Snapshot ${result.snapshot}.`;
}
