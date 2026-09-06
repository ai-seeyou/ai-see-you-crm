import { db, type Prisma } from "@crm/db";
import { PRIORITY } from "@crm/db/agent-tasks";
import { z } from "zod";
import { productionIdDigest } from "./production-import";
import { PRODUCTION_IMPORT } from "./production-import-config";
import {
	productionBoundaryEvidenceSchema,
	productionRefreshPayload,
	SYDNEY_PROOF,
} from "./production-refresh";

export const FULL_UNIVERSE = {
	scope: "qualifying-hotels",
	drySubject: "production-hotel-universe-full-proving:dry-run",
	commitSubject: "production-hotel-universe-full-proving:commit",
	lockKey: "crm:production-full-universe-gate",
} as const;

const approvalSchema = z.object({
	expectedCount: z.number().int().positive(),
	snapshot: z.string().datetime(),
	productionIdDigest: z.string().regex(/^[a-f0-9]{64}$/),
	manifestDigest: z.string().regex(/^[a-f0-9]{64}$/),
});

function failureCode(error: string | null | undefined) {
	if (!error) return null;
	const status = /^Production read failed with HTTP (\d{3})$/.exec(error)?.[1];
	if (status) return `PRODUCTION_HTTP_${status}`;
	const rpc = /^Production read failed with (RPC_(?:HTTP_\d{3}|UNKNOWN))$/.exec(
		error,
	)?.[1];
	if (rpc) return `PRODUCTION_${rpc}`;
	if (error.startsWith("[")) return "PRODUCTION_CONTRACT_INVALID";
	if (error === "Production snapshot changed during pagination")
		return "PRODUCTION_SNAPSHOT_CHANGED";
	if (error === "Production import lease was lost")
		return "PRODUCTION_IMPORT_LEASE_LOST";
	return "PRODUCTION_READ_UNKNOWN";
}

async function sydneyIdempotencyPassed() {
	const run = await db.productionImportRun.findFirst({
		where: {
			scope: SYDNEY_PROOF.idempotencyScope,
			status: "COMPLETED",
			dryRun: false,
			qualifyingCount: SYDNEY_PROOF.expectedCount,
			createdCount: 0,
			updatedCount: 0,
			unchangedCount: SYDNEY_PROOF.expectedCount,
			exceptionCount: 0,
		},
		select: { id: true },
	});
	return run !== null;
}

async function completedFullCommit() {
	const runs = await db.productionImportRun.findMany({
		where: {
			scope: FULL_UNIVERSE.scope,
			status: "COMPLETED",
			dryRun: false,
			exceptionCount: 0,
		},
		select: {
			qualifyingCount: true,
			fetchedCount: true,
			createdCount: true,
			updatedCount: true,
			unchangedCount: true,
			boundaryEvidence: true,
		},
	});
	const validity = await Promise.all(
		runs.map(async (run) => {
			const evidence = productionBoundaryEvidenceSchema.safeParse(
				run.boundaryEvidence,
			);
			return (
				evidence.success &&
				evidence.data.contractVersion === "2" &&
				evidence.data.manifestProductionIdDigest !== undefined &&
				evidence.data.manifestPayloadDigest !== undefined &&
				(await productionIdDigest(
					evidence.data.manifestProductionIds ?? [],
				)) === evidence.data.manifestProductionIdDigest &&
				run.qualifyingCount !== null &&
				run.fetchedCount === run.qualifyingCount &&
				run.createdCount + run.updatedCount + run.unchangedCount ===
					run.qualifyingCount
			);
		}),
	);
	return validity.some(Boolean);
}

async function completedFullDryRun() {
	const runs = await db.productionImportRun.findMany({
		where: { scope: FULL_UNIVERSE.scope, status: "COMPLETED", dryRun: true },
		select: { qualifyingCount: true, boundaryEvidence: true },
	});
	const validity = await Promise.all(
		runs.map(async (run) => {
			const evidence = productionBoundaryEvidenceSchema.safeParse(
				run.boundaryEvidence,
			);
			return (
				evidence.success &&
				evidence.data.contractVersion === "2" &&
				run.qualifyingCount === evidence.data.manifestProductionIds?.length &&
				evidence.data.manifestProductionIdDigest !== undefined &&
				evidence.data.manifestPayloadDigest !== undefined &&
				(await productionIdDigest(evidence.data.manifestProductionIds)) ===
					evidence.data.manifestProductionIdDigest
			);
		}),
	);
	return validity.some(Boolean);
}

async function createGateTask(
	subject: string,
	payload: ReturnType<typeof productionRefreshPayload>,
) {
	return db.$transaction(async (tx) => {
		await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${FULL_UNIVERSE.lockKey}))`;
		const activeRuns = await tx.productionImportRun.count({
			where: {
				status: "RUNNING",
				scope: {
					in: [
						FULL_UNIVERSE.scope,
						SYDNEY_PROOF.scope,
						SYDNEY_PROOF.idempotencyScope,
					],
				},
			},
		});
		if (activeRuns > 0) return null;
		const unfinished = await tx.agentTask.count({
			where: {
				kind: "production-refresh",
				finishedAt: null,
				subject: {
					in: [
						SYDNEY_PROOF.subject,
						SYDNEY_PROOF.commitSubject,
						SYDNEY_PROOF.idempotencyScope,
						FULL_UNIVERSE.drySubject,
						FULL_UNIVERSE.commitSubject,
						"production-hotel-universe-full",
						"production-hotel-universe-incremental",
					],
				},
			},
		});
		if (unfinished > 0) return null;
		return (
			await tx.agentTask.create({
				data: {
					kind: "production-refresh",
					reason: "Prove the complete Production hotel universe.",
					payload,
					priority: PRIORITY.productionRefresh,
					budget: 0,
					dueAt: new Date(),
					subject,
				},
				select: { id: true },
			})
		).id;
	});
}

export async function queueFullUniverseDryRun() {
	if (
		!(await sydneyIdempotencyPassed()) ||
		(await completedFullDryRun()) ||
		(await completedFullCommit())
	)
		return null;
	return createGateTask(
		FULL_UNIVERSE.drySubject,
		productionRefreshPayload({
			fullReconciliation: false,
			dryRun: true,
			universeGate: "DRY_RUN",
		}),
	);
}

export async function recoverStrandedFullUniverseDryRun() {
	return db.$transaction(async (tx) => {
		const now = new Date();
		const staleBefore = new Date(now.getTime() - PRODUCTION_IMPORT.retryMs);
		const legacyLeaseAfter = new Date(
			now.getTime() + PRODUCTION_IMPORT.retryMs,
		);
		const tasks = await tx.$queryRaw<
			Array<{
				id: string;
				leasedUntil: Date | null;
				payload: Prisma.JsonValue | null;
				startedAt: Date | null;
			}>
		>`SELECT "id", "leasedUntil", "payload", "startedAt" FROM "agentTask" WHERE "kind" = 'production-refresh' AND "subject" = ${FULL_UNIVERSE.drySubject} AND "finishedAt" IS NULL AND "attempts" = 1 FOR UPDATE`;
		if (tasks.length !== 1) return false;
		const task = tasks[0];
		if (
			!task?.leasedUntil ||
			!task.startedAt ||
			task.leasedUntil <= legacyLeaseAfter
		)
			return false;
		const payload = productionRefreshPayload(task.payload);
		if (
			Object.keys(payload).length !== 3 ||
			payload.fullReconciliation ||
			payload.dryRun !== true ||
			payload.universeGate !== "DRY_RUN"
		)
			return false;
		const activeRuns = await tx.productionImportRun.count({
			where: { scope: FULL_UNIVERSE.scope, status: "RUNNING" },
		});
		if (activeRuns !== 0) return false;
		const latest = await tx.productionImportRun.findFirst({
			where: { scope: FULL_UNIVERSE.scope },
			orderBy: { startedAt: "desc" },
			select: {
				status: true,
				dryRun: true,
				startedAt: true,
				completedAt: true,
				heartbeatAt: true,
			},
		});
		if (
			latest?.status !== "FAILED" ||
			latest.dryRun !== true ||
			latest.startedAt < task.startedAt ||
			!latest.completedAt ||
			latest.completedAt > staleBefore ||
			latest.heartbeatAt > staleBefore
		)
			return false;
		const changed = await tx.agentTask.updateMany({
			where: {
				id: task.id,
				kind: "production-refresh",
				subject: FULL_UNIVERSE.drySubject,
				finishedAt: null,
				attempts: 1,
				leasedUntil: task.leasedUntil,
			},
			data: { dueAt: now, leasedUntil: now },
		});
		return changed.count === 1;
	});
}

export async function readFullUniverseGateState() {
	const [
		sydneyPassed,
		dryRunCompleted,
		commitCompleted,
		activeRuns,
		unfinished,
	] = await Promise.all([
		sydneyIdempotencyPassed(),
		completedFullDryRun(),
		completedFullCommit(),
		db.productionImportRun.count({
			where: {
				status: "RUNNING",
				scope: {
					in: [
						FULL_UNIVERSE.scope,
						SYDNEY_PROOF.scope,
						SYDNEY_PROOF.idempotencyScope,
					],
				},
			},
		}),
		db.agentTask.findMany({
			where: {
				kind: "production-refresh",
				finishedAt: null,
				subject: {
					in: [
						SYDNEY_PROOF.subject,
						SYDNEY_PROOF.commitSubject,
						SYDNEY_PROOF.idempotencyScope,
						FULL_UNIVERSE.drySubject,
						FULL_UNIVERSE.commitSubject,
						"production-hotel-universe-full",
						"production-hotel-universe-incremental",
					],
				},
			},
			select: {
				subject: true,
				startedAt: true,
				leasedUntil: true,
				attempts: true,
			},
		}),
	]);
	return {
		sydneyPassed,
		dryRunCompleted,
		commitCompleted,
		activeRuns,
		unfinished: unfinished.map((task) => ({
			subject: task.subject,
			started: task.startedAt !== null,
			leaseActive:
				task.leasedUntil !== null && task.leasedUntil.getTime() > Date.now(),
			attempts: task.attempts,
		})),
	};
}

export async function queueApprovedFullUniverseCommit(
	input: z.input<typeof approvalSchema>,
) {
	const approval = approvalSchema.parse(input);
	if (await completedFullCommit()) return null;
	const dryRuns = await db.productionImportRun.findMany({
		where: { scope: FULL_UNIVERSE.scope, status: "COMPLETED", dryRun: true },
		orderBy: { completedAt: "desc" },
		select: { qualifyingCount: true, boundaryEvidence: true },
	});
	const bound = dryRuns.some((run) => {
		const evidence = productionBoundaryEvidenceSchema.safeParse(
			run.boundaryEvidence,
		);
		return (
			evidence.success &&
			run.qualifyingCount === approval.expectedCount &&
			evidence.data.manifestSnapshot === approval.snapshot &&
			evidence.data.manifestProductionIdDigest ===
				approval.productionIdDigest &&
			evidence.data.manifestPayloadDigest === approval.manifestDigest
		);
	});
	if (!bound)
		throw new Error("Full-universe approval does not match dry-run evidence");
	return createGateTask(
		FULL_UNIVERSE.commitSubject,
		productionRefreshPayload({
			fullReconciliation: false,
			dryRun: false,
			universeGate: "COMMIT",
			expectedCount: approval.expectedCount,
			snapshot: approval.snapshot,
			expectedProductionIdDigest: approval.productionIdDigest,
			expectedManifestDigest: approval.manifestDigest,
		}),
	);
}

export async function readFullUniverseProof(dryRun: boolean) {
	const run = await db.productionImportRun.findFirst({
		where: { scope: FULL_UNIVERSE.scope, dryRun },
		orderBy: { startedAt: "desc" },
		select: {
			status: true,
			error: true,
			qualifyingCount: true,
			fetchedCount: true,
			createdCount: true,
			updatedCount: true,
			unchangedCount: true,
			exceptionCount: true,
			reviewCount: true,
			chainIdCount: true,
			missingChainCount: true,
			relationshipCount: true,
			staleRelationshipCount: true,
			readRequestCount: true,
			destinations: true,
			countries: true,
			boundaryEvidence: true,
			startedAt: true,
			completedAt: true,
		},
	});
	const evidence = productionBoundaryEvidenceSchema.safeParse(
		run?.boundaryEvidence,
	);
	const recomputedDigest = evidence.success
		? await productionIdDigest(evidence.data.manifestProductionIds ?? [])
		: null;
	return {
		runStatus: run?.status ?? null,
		failureCode: failureCode(run?.error),
		dryRun,
		qualifyingCount: run?.qualifyingCount ?? null,
		fetchedCount: run?.fetchedCount ?? null,
		createdCount: run?.createdCount ?? null,
		updatedCount: run?.updatedCount ?? null,
		unchangedCount: run?.unchangedCount ?? null,
		exceptionCount: run?.exceptionCount ?? null,
		reviewCount: run?.reviewCount ?? null,
		withChainIdentifierCount: run?.chainIdCount ?? null,
		withoutChainIdentifierCount: run?.missingChainCount ?? null,
		relationshipCount: run?.relationshipCount ?? null,
		staleRelationshipCount: run?.staleRelationshipCount ?? null,
		readRequestCount: run?.readRequestCount ?? null,
		destinationCount: run?.destinations ?? null,
		countryCount: run?.countries ?? null,
		manifestSnapshot: evidence.success ? evidence.data.manifestSnapshot : null,
		productionIdDigest: evidence.success
			? (evidence.data.manifestProductionIdDigest ?? null)
			: null,
		manifestDigest: evidence.success
			? (evidence.data.manifestPayloadDigest ?? null)
			: null,
		manifestValid:
			evidence.success &&
			evidence.data.manifestProductionIdDigest !== undefined &&
			evidence.data.manifestPayloadDigest !== undefined &&
			recomputedDigest === evidence.data.manifestProductionIdDigest &&
			run?.qualifyingCount === evidence.data.manifestProductionIds?.length,
		runtimeMs:
			run?.completedAt && run.startedAt
				? Math.max(0, run.completedAt.getTime() - run.startedAt.getTime())
				: null,
	};
}
