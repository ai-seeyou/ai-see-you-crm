import { db, type Prisma } from "@crm/db";
import { PRIORITY } from "@crm/db/agent-tasks";
import { z } from "zod";
import { ProductionReadClient } from "./production-client";
import { importProductionHotels } from "./production-import";
import { PRODUCTION_IMPORT } from "./production-import-config";

const payloadSchema = z.object({ fullReconciliation: z.boolean() });
export type ProductionRefreshPayload = z.infer<typeof payloadSchema>;
const subjectFor = (fullReconciliation: boolean) =>
	fullReconciliation
		? "production-hotel-universe-full"
		: "production-hotel-universe-incremental";

export function productionRefreshPayload(
	value: Prisma.JsonValue | null,
): ProductionRefreshPayload {
	return payloadSchema.parse(value);
}

export async function queueProductionRefresh(fullReconciliation: boolean) {
	const subject = subjectFor(fullReconciliation);
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
					reason: fullReconciliation
						? "Reconcile the complete Production hotel universe."
						: "Import newly qualifying Production hotels.",
					payload: { fullReconciliation },
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
		{ dryRun: false, fullReconciliation: payload.fullReconciliation },
	);
	return `Processed ${result.qualifying} qualifying hotels: ${result.created} created, ${result.updated} updated, ${result.unchanged} unchanged.`;
}
