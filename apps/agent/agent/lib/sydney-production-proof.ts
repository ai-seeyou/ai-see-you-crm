import { db, EntityType, ExternalRecordType, ExternalSystem } from "@crm/db";
import { z } from "zod";
import {
	productionBoundaryEvidenceSchema,
	productionCommittedBoundaryEvidenceSchema,
	SYDNEY_PROOF,
} from "./production-refresh";

const reviewItemsSchema = z.array(
	z.object({ productionPropertyId: z.string(), reason: z.string() }),
);

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

export async function readSydneyCommittedProof() {
	const [run, task] = await Promise.all([
		db.productionImportRun.findFirst({
			where: {
				scope: SYDNEY_PROOF.scope,
				destination: SYDNEY_PROOF.destination,
				dryRun: false,
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
				unchangedCount: true,
				exceptionCount: true,
				reviewCount: true,
				reviewItems: true,
				chainIdCount: true,
				missingChainCount: true,
				startedAt: true,
				completedAt: true,
			},
		}),
		db.agentTask.findFirst({
			where: {
				kind: "production-refresh",
				subject: SYDNEY_PROOF.commitSubject,
			},
			orderBy: { createdAt: "desc" },
			select: { startedAt: true, finishedAt: true },
		}),
	]);
	const committedEvidence = productionCommittedBoundaryEvidenceSchema.safeParse(
		run?.boundaryEvidence,
	);
	const productionIds = committedEvidence.success
		? committedEvidence.data.manifestProductionIds
		: [];
	const snapshots = await db.productionSnapshot.findMany({
		where: {
			entityKind: "property",
			productionId: { in: productionIds },
			destinationSlug: SYDNEY_PROOF.destination,
		},
		select: { productionId: true, destinationSlug: true },
	});
	const refs = await db.externalRef.findMany({
		where: {
			system: ExternalSystem.PRODUCTION,
			recordType: ExternalRecordType.COMPANY,
			externalId: { in: productionIds },
			confirmedAt: { not: null },
		},
		select: { externalId: true, recordId: true },
	});
	const recordIds = [...new Set(refs.map((ref) => ref.recordId))];
	const companies = await db.company.findMany({
		where: { id: { in: recordIds } },
		select: {
			id: true,
			domain: true,
			entityType: true,
			vertical: { select: { key: true } },
		},
	});
	const companyById = new Map(
		companies.map((company) => [company.id, company]),
	);
	const externalIdCounts = new Map<string, number>();
	const domainRefs = new Map<string, string[]>();
	for (const ref of refs) {
		externalIdCounts.set(
			ref.externalId,
			(externalIdCounts.get(ref.externalId) ?? 0) + 1,
		);
		const domain = companyById.get(ref.recordId)?.domain;
		if (domain)
			domainRefs.set(domain, [...(domainRefs.get(domain) ?? []), ref.recordId]);
	}
	const sharedDomains = [...domainRefs.values()].filter(
		(recordIdsForDomain) => recordIdsForDomain.length > 1,
	);
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
			committedEvidence.success,
		crmBusinessCount: companies.length,
		confirmedProductionExternalRefCount: refs.length,
		duplicateProductionRefCount: [...externalIdCounts.values()].filter(
			(count) => count > 1,
		).length,
		hotelEntityTypeCount: companies.filter(
			(company) => company.entityType === EntityType.HOTEL,
		).length,
		hotelVerticalCount: companies.filter(
			(company) => company.vertical?.key === "hotel",
		).length,
		destinationCount: new Set(
			snapshots.flatMap((snapshot) =>
				snapshot.destinationSlug ? [snapshot.destinationSlug] : [],
			),
		).size,
		sharedDomainGroupCount: sharedDomains.length,
		sharedDomainBusinessCount: sharedDomains.reduce(
			(total, recordIdsForDomain) => total + new Set(recordIdsForDomain).size,
			0,
		),
		sharedDomainCollapsedPropertyCount: sharedDomains.reduce(
			(total, recordIdsForDomain) =>
				total + (recordIdsForDomain.length - new Set(recordIdsForDomain).size),
			0,
		),
		exceptionCount: run?.exceptionCount ?? null,
		reviewCount: run?.reviewCount ?? null,
		reviewItemCount: run
			? (reviewItemsSchema.safeParse(run.reviewItems).data?.length ?? 0)
			: null,
		withChainIdentifierCount: run?.chainIdCount ?? null,
		withoutChainIdentifierCount: run?.missingChainCount ?? null,
		taskState,
		runtimeMs:
			run?.completedAt && run.startedAt
				? Math.max(0, run.completedAt.getTime() - run.startedAt.getTime())
				: null,
	};
}
