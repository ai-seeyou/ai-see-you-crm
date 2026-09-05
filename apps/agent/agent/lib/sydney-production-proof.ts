import { db } from "@crm/db";
import {
	productionBoundaryEvidenceSchema,
	SYDNEY_PROOF,
} from "./production-refresh";

export async function readSydneyProductionProof() {
	const [run, task] = await Promise.all([
		db.productionImportRun.findFirst({
			where: {
				scope: SYDNEY_PROOF.scope,
				destination: SYDNEY_PROOF.destination,
				dryRun: true,
			},
			orderBy: { startedAt: "desc" },
			select: {
				status: true,
				qualifyingCount: true,
				destination: true,
				dryRun: true,
				boundaryEvidence: true,
				createdCount: true,
				updatedCount: true,
				startedAt: true,
				completedAt: true,
			},
		}),
		db.agentTask.findFirst({
			where: {
				kind: "production-refresh",
				subject: SYDNEY_PROOF.subject,
			},
			orderBy: { createdAt: "desc" },
			select: { startedAt: true, finishedAt: true },
		}),
	]);
	const taskState = task?.finishedAt
		? "FINISHED"
		: task?.startedAt
			? "RUNNING"
			: task
				? "QUEUED"
				: "NOT_QUEUED";
	return {
		runStatus: run?.status ?? null,
		qualifyingCount: run?.qualifyingCount ?? null,
		destination: run?.destination ?? null,
		dryRun: run?.dryRun ?? null,
		manifestValid:
			run?.status === "COMPLETED" &&
			run.qualifyingCount === SYDNEY_PROOF.expectedCount &&
			productionBoundaryEvidenceSchema.safeParse(run.boundaryEvidence).success,
		businessWriteCountEvidence: run
			? run.createdCount + run.updatedCount
			: null,
		taskState,
		runtimeMs:
			run?.completedAt && run.startedAt
				? Math.max(0, run.completedAt.getTime() - run.startedAt.getTime())
				: null,
	};
}
