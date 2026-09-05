import {
	db,
	EntityType,
	ExternalRecordType,
	ExternalSystem,
	MatchActor,
	type Prisma,
	RecordSource,
} from "@crm/db";
import type { ProductionBusiness } from "@crm/validation/production-business";
import type { ProductionReadClient } from "./production-client";
import { PRODUCTION_IMPORT } from "./production-import-config";

export type ProductionImportOptions = {
	destination?: string;
	dryRun: boolean;
	expectedCount?: number;
	now?: Date;
	audit?: boolean;
	snapshot?: string;
	fullReconciliation?: boolean;
};
export type ProductionImportResult = {
	qualifying: number;
	created: number;
	updated: number;
	unchanged: number;
	exceptions: number;
	destinations: number;
	countries: number;
	withChainIdentifier: number;
	withoutChainIdentifier: number;
	requiringReview: number;
	staleReferences: number;
	snapshot: string;
	boundaryEvidence: {
		contractVersion: "1";
		httpMethod: "GET";
		readRequests: number;
		clientEvidence: "GET_ONLY_HTTP_CLIENT";
	};
};
type FetchedPage = { records: ProductionBusiness[]; nextCursor: string | null };
type FetchedManifest = {
	pages: FetchedPage[];
	records: ProductionBusiness[];
	snapshot: string;
	readRequests: number;
};
type ProductionCompanyData = {
	name: string;
	domain?: string;
	country?: string;
	countryCode?: string;
	verticalId: string;
	entityType: EntityType;
};
const importStateId = (destination?: string) =>
	destination
		? `${PRODUCTION_IMPORT.stateId}:${destination.toLowerCase()}`
		: PRODUCTION_IMPORT.stateId;

function companyData(record: ProductionBusiness, verticalId: string) {
	const data: ProductionCompanyData = {
		name: record.canonicalName,
		verticalId,
		entityType: EntityType.HOTEL,
	};
	if (record.primaryDomain !== null) data.domain = record.primaryDomain;
	if (record.country.name !== null) data.country = record.country.name;
	if (record.country.code !== null) data.countryCode = record.country.code;
	return data;
}

function sameCompanyIdentity(
	company: {
		name: string;
		domain: string | null;
		country: string | null;
		countryCode: string | null;
		verticalId: string | null;
		entityType: EntityType;
	},
	data: ProductionCompanyData,
) {
	return (
		company.name === data.name &&
		(data.domain === undefined || company.domain === data.domain) &&
		(data.country === undefined || company.country === data.country) &&
		(data.countryCode === undefined ||
			company.countryCode === data.countryCode) &&
		company.verticalId === data.verticalId &&
		company.entityType === data.entityType
	);
}

async function writeRecord(
	tx: Prisma.TransactionClient,
	record: ProductionBusiness,
	now: Date,
): Promise<"created" | "updated" | "unchanged" | "exception"> {
	const ref = await tx.externalRef.findUnique({
		where: {
			system_recordType_externalId: {
				system: ExternalSystem.PRODUCTION,
				recordType: ExternalRecordType.COMPANY,
				externalId: record.productionPropertyId,
			},
		},
	});
	if (ref && ref.confirmedAt === null) return "exception";
	const vertical = await tx.vertical.findUniqueOrThrow({
		where: { key: "hotel" },
		select: { id: true },
	});
	const data = companyData(record, vertical.id);
	let outcome: "created" | "updated" | "unchanged";
	if (ref) {
		const company = await tx.company.findUniqueOrThrow({
			where: { id: ref.recordId },
		});
		const unchanged = sameCompanyIdentity(company, data);
		if (!unchanged)
			await tx.company.update({ where: { id: ref.recordId }, data });
		await tx.externalRef.update({
			where: { id: ref.id },
			data: { lastSeenAt: now, staleAt: null, reviewReason: null },
		});
		outcome = unchanged ? "unchanged" : "updated";
	} else {
		const company = await tx.company.create({
			data: { ...data, source: RecordSource.IMPORT },
			select: { id: true },
		});
		await tx.externalRef.create({
			data: {
				recordType: ExternalRecordType.COMPANY,
				recordId: company.id,
				system: ExternalSystem.PRODUCTION,
				externalId: record.productionPropertyId,
				matchMethod: "production-property-id",
				matchedBy: MatchActor.IMPORT,
				confirmedAt: now,
				lastSeenAt: now,
			},
		});
		outcome = "created";
	}
	await tx.productionSnapshot.upsert({
		where: { productionId: record.productionPropertyId },
		create: {
			productionId: record.productionPropertyId,
			entityKind: "property",
			name: record.canonicalName,
			destination: record.destination.name,
			destinationId: record.destination.id,
			destinationSlug: record.destination.slug,
			country: record.country.name,
			payload: record,
			fetchedAt: now,
			staleAfter: new Date(now.getTime() + PRODUCTION_IMPORT.snapshotTtlMs),
		},
		update: {
			name: record.canonicalName,
			destination: record.destination.name,
			destinationId: record.destination.id,
			destinationSlug: record.destination.slug,
			country: record.country.name,
			payload: record,
			fetchedAt: now,
			staleAfter: new Date(now.getTime() + PRODUCTION_IMPORT.snapshotTtlMs),
		},
	});
	return outcome;
}

async function fetchManifest(
	client: ProductionReadClient,
	input: { destination?: string; updatedSince?: string; snapshot?: string },
	heartbeat: () => Promise<void>,
): Promise<FetchedManifest> {
	let cursor: string | undefined;
	let snapshot = input.snapshot;
	const pages: FetchedPage[] = [];
	let readRequests = 0;
	do {
		const page = await client.page({
			...input,
			cursor,
			snapshot,
			limit: PRODUCTION_IMPORT.pageLimit,
		});
		if (snapshot && page.snapshot !== snapshot) {
			throw new Error("Production snapshot changed during pagination");
		}
		await heartbeat();
		snapshot = page.snapshot;
		pages.push({ records: page.records, nextCursor: page.nextCursor });
		cursor = page.nextCursor ?? undefined;
		readRequests += 1;
	} while (cursor);
	return {
		pages,
		records: pages.flatMap((page) => page.records),
		snapshot: snapshot ?? "",
		readRequests,
	};
}

export async function importProductionHotels(
	client: ProductionReadClient,
	options: ProductionImportOptions,
): Promise<ProductionImportResult> {
	const now = options.now ?? new Date();
	const key = importStateId(options.destination);
	const audit = options.audit ?? true;
	const saved = options.dryRun
		? null
		: await db.productionImportState.findUnique({ where: { id: key } });
	if (options.fullReconciliation && options.destination) {
		throw new Error("Full reconciliation cannot use a destination filter");
	}
	const updatedSince = options.fullReconciliation
		? undefined
		: saved?.snapshot
			? saved.updatedSince?.toISOString()
			: saved?.sourceWatermark?.toISOString();
	let runId: string | undefined;
	const leaseOwner = crypto.randomUUID();
	const priorFullRun = options.fullReconciliation
		? await db.productionImportRun.findFirst({
				where: {
					scope: key,
					status: "COMPLETED",
					dryRun: false,
					fullReconciliation: true,
					qualifyingCount: { not: null },
				},
				orderBy: { completedAt: "desc" },
				select: { qualifyingCount: true },
			})
		: null;

	if (audit) {
		await db.productionImportRun.updateMany({
			where: {
				scope: key,
				status: "RUNNING",
				heartbeatAt: {
					lt: new Date(now.getTime() - PRODUCTION_IMPORT.leaseMs),
				},
			},
			data: {
				status: "FAILED",
				error: "Import lease expired",
				completedAt: now,
			},
		});
		runId = (
			await db.productionImportRun.create({
				data: {
					scope: key,
					leaseOwner,
					heartbeatAt: now,
					destination: options.destination,
					dryRun: options.dryRun,
					fullReconciliation: options.fullReconciliation ?? false,
				},
			})
		).id;
	}

	try {
		const heartbeat = async () => {
			if (runId) {
				const result = await db.productionImportRun.updateMany({
					where: { id: runId, leaseOwner, status: "RUNNING" },
					data: { heartbeatAt: new Date() },
				});
				if (result.count !== 1)
					throw new Error("Production import lease was lost");
			}
		};
		const manifest = await fetchManifest(
			client,
			{
				destination: options.destination,
				updatedSince,
				snapshot: saved?.snapshot ?? options.snapshot,
			},
			heartbeat,
		);
		const { pages, records, snapshot } = manifest;
		let readRequests = manifest.readRequests;
		const productionIds = new Set(
			records.map((record) => record.productionPropertyId),
		);
		if (productionIds.size !== records.length) {
			const seen = new Set<string>();
			const duplicates = records
				.map((record) => record.productionPropertyId)
				.filter((id) => {
					if (seen.has(id)) return true;
					seen.add(id);
					return false;
				});
			if (runId) {
				await db.productionImportRun.update({
					where: { id: runId, leaseOwner },
					data: {
						exceptionCount: duplicates.length,
						reviewCount: duplicates.length,
						reviewItems: duplicates.map((productionPropertyId) => ({
							productionPropertyId,
							reason: "Duplicate Production property ID in frozen snapshot",
						})),
					},
				});
			}
			throw new Error("Production snapshot contains duplicate property IDs");
		}
		if (
			options.expectedCount !== undefined &&
			records.length !== options.expectedCount
		)
			throw new Error(
				`Expected ${options.expectedCount} qualifying hotels, received ${records.length}`,
			);
		if (options.fullReconciliation) {
			if (records.length === 0) {
				throw new Error("Full reconciliation returned an empty manifest");
			}
			const priorCount = priorFullRun?.qualifyingCount;
			if (
				priorCount &&
				records.length <
					Math.floor(priorCount * PRODUCTION_IMPORT.reconciliationMinimumRatio)
			) {
				throw new Error("Full reconciliation manifest is sharply reduced");
			}
		}
		const reconciliationPresentIds = new Set(productionIds);
		if (options.fullReconciliation) {
			const verification = await fetchManifest(client, {}, heartbeat);
			readRequests += verification.readRequests;
			const verificationIds = new Set(
				verification.records.map((record) => record.productionPropertyId),
			);
			for (const id of verificationIds) reconciliationPresentIds.add(id);
			if (
				verificationIds.size === 0 ||
				verificationIds.size <
					Math.floor(
						records.length * PRODUCTION_IMPORT.reconciliationMinimumRatio,
					)
			) {
				throw new Error("Production absence verification is incomplete");
			}
		}

		let created = 0;
		let updated = 0;
		let unchanged = 0;
		let exceptions = 0;
		const reviewItems: Array<{ productionPropertyId: string; reason: string }> =
			[];
		for (const record of records) {
			if (!record.country.name || !record.country.code) {
				reviewItems.push({
					productionPropertyId: record.productionPropertyId,
					reason: "Production country identity is incomplete",
				});
			}
		}
		let latestWatermark = saved?.sourceWatermark ?? null;
		for (const record of records) {
			const changed = new Date(record.sourceUpdatedAt);
			if (!latestWatermark || changed > latestWatermark)
				latestWatermark = changed;
		}
		if (!options.dryRun) {
			for (const page of pages) {
				await db.$transaction(async (tx) => {
					if (runId) {
						const lease = await tx.productionImportRun.updateMany({
							where: { id: runId, leaseOwner, status: "RUNNING" },
							data: { heartbeatAt: new Date() },
						});
						if (lease.count !== 1)
							throw new Error("Production import lease was lost");
					}
					for (const record of page.records) {
						const outcome = await writeRecord(tx, record, now);
						if (outcome === "created") created += 1;
						else if (outcome === "updated") updated += 1;
						else if (outcome === "unchanged") unchanged += 1;
						else {
							exceptions += 1;
							reviewItems.push({
								productionPropertyId: record.productionPropertyId,
								reason: "Existing Production reference is not confirmed",
							});
						}
					}
					await tx.productionImportState.upsert({
						where: { id: key },
						create: {
							id: key,
							cursor: page.nextCursor,
							snapshot,
							destination: options.destination,
							updatedSince: updatedSince ? new Date(updatedSince) : null,
							runId,
							sourceWatermark: saved?.sourceWatermark,
							createdCount: created,
							updatedCount: updated,
							unchangedCount: unchanged,
							exceptionCount: exceptions,
						},
						update: {
							cursor: page.nextCursor,
							snapshot,
							runId,
							createdCount: created,
							updatedCount: updated,
							unchangedCount: unchanged,
							exceptionCount: exceptions,
						},
					});
					if (runId)
						await tx.productionImportRun.update({
							where: { id: runId },
							data: {
								fetchedCount: created + updated + unchanged + exceptions,
								createdCount: created,
								updatedCount: updated,
								unchangedCount: unchanged,
								exceptionCount: exceptions,
								reviewItems,
							},
						});
				});
			}
		}
		if (exceptions > 0) {
			throw new Error(`${exceptions} Production references require review`);
		}
		let staleReferences = 0;

		const destinations = new Set(
			records.map((record) => record.destination.id),
		);
		const countries = new Set(
			records.flatMap((record) =>
				record.country.code ? [record.country.code] : [],
			),
		);
		const chainIdCount = records.filter(
			(record) => record.chain !== null,
		).length;
		const requiringReview =
			exceptions +
			records.filter((record) => !record.country.name || !record.country.code)
				.length;
		const boundaryEvidence = {
			contractVersion: "1" as const,
			httpMethod: "GET" as const,
			readRequests,
			clientEvidence: "GET_ONLY_HTTP_CLIENT" as const,
		};
		if (runId || !options.dryRun)
			await db.$transaction(async (tx) => {
				if (!options.dryRun && options.fullReconciliation) {
					const propertySnapshots = await tx.productionSnapshot.findMany({
						where: { entityKind: "property" },
						select: { productionId: true },
					});
					const staleRefs = await tx.externalRef.findMany({
						where: {
							system: ExternalSystem.PRODUCTION,
							recordType: ExternalRecordType.COMPANY,
							matchedBy: MatchActor.IMPORT,
							matchMethod: "production-property-id",
							confirmedAt: { not: null },
							staleAt: null,
							externalId: {
								in: propertySnapshots.map((row) => row.productionId),
								notIn: [...reconciliationPresentIds],
							},
						},
						select: { id: true, externalId: true },
					});
					await tx.externalRef.updateMany({
						where: { id: { in: staleRefs.map((ref) => ref.id) } },
						data: {
							staleAt: now,
							reviewReason:
								"Property is absent from the current qualifying Production universe",
						},
					});
					staleReferences = staleRefs.length;
					for (const ref of staleRefs) {
						reviewItems.push({
							productionPropertyId: ref.externalId,
							reason: "Property left the qualifying Production universe",
						});
					}
				}
				if (runId) {
					const completed = await tx.productionImportRun.updateMany({
						where: { id: runId, leaseOwner, status: "RUNNING" },
						data: {
							status: "COMPLETED",
							qualifyingCount: records.length,
							fetchedCount: records.length,
							createdCount: created,
							updatedCount: updated,
							unchangedCount: unchanged,
							exceptionCount: exceptions,
							chainIdCount,
							missingChainCount: records.length - chainIdCount,
							reviewCount: requiringReview + staleReferences,
							staleRefCount: staleReferences,
							reviewItems,
							readRequestCount: readRequests,
							boundaryEvidence,
							destinations: destinations.size,
							countries: countries.size,
							completedAt: new Date(),
							sourceWatermark: latestWatermark,
						},
					});
					if (completed.count !== 1) {
						throw new Error(
							"Production import lease was lost before completion",
						);
					}
				}
				if (!options.dryRun)
					await tx.productionImportState.update({
						where: { id: key },
						data: {
							cursor: null,
							snapshot: null,
							runId: null,
							updatedSince: null,
							lastCompletedAt: new Date(),
							sourceWatermark: latestWatermark,
							createdCount: created,
							updatedCount: updated,
							unchangedCount: unchanged,
							exceptionCount: exceptions,
						},
					});
			});
		return {
			qualifying: records.length,
			created,
			updated,
			unchanged,
			exceptions,
			destinations: destinations.size,
			countries: countries.size,
			withChainIdentifier: chainIdCount,
			withoutChainIdentifier: records.length - chainIdCount,
			requiringReview: requiringReview + staleReferences,
			staleReferences,
			snapshot: snapshot ?? "",
			boundaryEvidence,
		};
	} catch (error) {
		if (runId)
			await db.productionImportRun.update({
				where: { id: runId, leaseOwner },
				data: {
					status: "FAILED",
					error: error instanceof Error ? error.message : String(error),
					completedAt: new Date(),
				},
			});
		if (!options.dryRun)
			await db.productionImportState.updateMany({
				where: { id: key, runId },
				data: { cursor: null, runId: null },
			});
		throw error;
	}
}
