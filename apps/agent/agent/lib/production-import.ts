import {
	db,
	EntityType,
	ExternalRecordType,
	ExternalSystem,
	MatchActor,
	type Prisma,
	Prisma as PrismaNamespace,
	RecordSource,
	RelationshipType,
} from "@crm/db";
import {
	type ProductionBusiness,
	productionBusinessSchema,
	productionCommercialKnowledgeSchema,
	productionRecommendationSummarySchema,
} from "@crm/validation/production-business";
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
	auditScope?: "qualifying-hotels:sydney:idempotency";
	expectedProductionIds?: string[];
	expectedProductionIdDigest?: string;
	expectedManifestDigest?: string;
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
		contractVersion: "2";
		httpMethod: "GET";
		readRequests: number;
		clientEvidence: "GET_ONLY_HTTP_CLIENT";
		manifestSnapshot: string;
	};
};
type FetchedPage = { records: ProductionBusiness[]; nextCursor: string | null };
type FetchedManifest = {
	pages: FetchedPage[];
	records: ProductionBusiness[];
	snapshot: string;
	readRequests: number;
};

function assertApprovedManifest(
	productionIds: Set<string>,
	expectedProductionIds?: string[],
) {
	if (!expectedProductionIds) return;
	const actualIds = [...productionIds].sort();
	const expectedIds = [...expectedProductionIds].sort();
	if (
		actualIds.length !== expectedIds.length ||
		actualIds.some((id, index) => id !== expectedIds[index])
	) {
		throw new Error("Production manifest does not match the approved IDs");
	}
}

function manifestReviewItems(records: ProductionBusiness[]) {
	return records.flatMap((record) => {
		const reasons: string[] = [];
		if (!record.country.name || !record.country.code)
			reasons.push("Production country identity is incomplete");
		if (record.chain?.name === null)
			reasons.push("Production chain identity has no canonical name");
		if (record.parentChain?.name === null)
			reasons.push("Production parent chain identity has no canonical name");
		if (record.ownershipStatus === "chained" && record.chain === null)
			reasons.push("Chained property has no Production chain identity");
		return reasons.map((reason) => ({
			productionPropertyId: record.productionPropertyId,
			reason,
		}));
	});
}

function assertExpectedEvidence(
	options: ProductionImportOptions,
	records: ProductionBusiness[],
	productionIdManifestDigest: string,
	manifestDigest: string,
) {
	if (
		options.expectedProductionIdDigest &&
		productionIdManifestDigest !== options.expectedProductionIdDigest
	)
		throw new Error("Production manifest digest does not match approval");
	if (
		options.expectedManifestDigest &&
		manifestDigest !== options.expectedManifestDigest
	)
		throw new Error("Production payload digest does not match approval");
	if (
		options.expectedCount !== undefined &&
		records.length !== options.expectedCount
	)
		throw new Error(
			`Expected ${options.expectedCount} qualifying hotels, received ${records.length}`,
		);
}

export async function productionIdDigest(productionIds: Iterable<string>) {
	const input = [...productionIds].sort().join("\n");
	const bytes = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(input),
	);
	return [...new Uint8Array(bytes)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

export async function productionManifestDigest(records: ProductionBusiness[]) {
	const input = JSON.stringify(
		[...records]
			.sort((left, right) =>
				left.productionPropertyId.localeCompare(right.productionPropertyId),
			)
			.map((record) => productionBusinessSchema.parse(record)),
	);
	const bytes = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(input),
	);
	return [...new Uint8Array(bytes)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

function updatedSinceFor(
	options: ProductionImportOptions,
	saved?: {
		snapshot: string | null;
		updatedSince: Date | null;
		sourceWatermark: Date | null;
	} | null,
) {
	if (options.snapshot || options.fullReconciliation) return undefined;
	return saved?.snapshot
		? saved.updatedSince?.toISOString()
		: saved?.sourceWatermark?.toISOString();
}
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

type ProductionStructure = NonNullable<ProductionBusiness["chain"]>;
const structuralExternalId = (productionId: string) => `chain:${productionId}`;

async function upsertStructuralCompany(
	tx: Prisma.TransactionClient,
	entity: ProductionStructure,
	verticalId: string,
	now: Date,
) {
	const externalId = structuralExternalId(entity.id);
	const ref = await tx.externalRef.findUnique({
		where: {
			system_recordType_externalId: {
				system: ExternalSystem.PRODUCTION,
				recordType: ExternalRecordType.COMPANY,
				externalId,
			},
		},
	});
	if (ref?.confirmedAt === null) return null;
	if (ref) {
		const data: Prisma.CompanyUncheckedUpdateInput = {
			verticalId,
			entityType: EntityType.HOTEL_GROUP,
		};
		if (entity.name !== null) data.name = entity.name;
		await tx.company.update({
			where: { id: ref.recordId },
			data,
		});
		await tx.externalRef.update({
			where: { id: ref.id },
			data: { lastSeenAt: now, staleAt: null, reviewReason: null },
		});
		return ref.recordId;
	}
	if (entity.name === null) return null;
	const company = await tx.company.create({
		data: {
			name: entity.name,
			verticalId,
			entityType: EntityType.HOTEL_GROUP,
			source: RecordSource.IMPORT,
		},
		select: { id: true },
	});
	await tx.externalRef.create({
		data: {
			recordType: ExternalRecordType.COMPANY,
			recordId: company.id,
			system: ExternalSystem.PRODUCTION,
			externalId,
			matchMethod: "production-chain-id",
			matchedBy: MatchActor.IMPORT,
			confirmedAt: now,
			lastSeenAt: now,
		},
	});
	return company.id;
}

const propertyChainRelationshipExternalId = (
	propertyProductionId: string,
	chainProductionId: string,
) => `property:${propertyProductionId}:belongs-to:chain:${chainProductionId}`;

const chainParentRelationshipExternalId = (
	chainProductionId: string,
	parentProductionId: string,
) => `chain:${chainProductionId}:belongs-to:chain:${parentProductionId}`;

function relationshipExternalIds(record: ProductionBusiness) {
	const ids: string[] = [];
	if (record.chain)
		ids.push(
			propertyChainRelationshipExternalId(
				record.productionPropertyId,
				record.chain.id,
			),
		);
	if (record.chain && record.parentChain)
		ids.push(
			chainParentRelationshipExternalId(record.chain.id, record.parentChain.id),
		);
	return ids;
}

async function upsertProductionRelationship(
	tx: Prisma.TransactionClient,
	input: {
		fromCompanyId: string;
		toCompanyId: string;
		externalId: string;
		sourceUpdatedAt: Date;
		now: Date;
	},
) {
	const { externalId } = input;
	const ref = await tx.externalRelationshipRef.findUnique({
		where: {
			system_externalId: { system: ExternalSystem.PRODUCTION, externalId },
		},
		include: { relationship: true },
	});
	if (ref?.confirmedAt === null) return false;
	if (ref) {
		if (
			ref.relationship.fromCompanyId !== input.fromCompanyId ||
			ref.relationship.toCompanyId !== input.toCompanyId ||
			ref.relationship.type !== RelationshipType.BELONGS_TO
		)
			throw new Error("Production relationship identity changed endpoints");
		await tx.externalRelationshipRef.update({
			where: { id: ref.id },
			data: {
				lastSeenAt: input.now,
				staleAt: null,
				reviewReason: null,
				sourceUpdatedAt: input.sourceUpdatedAt,
			},
		});
		if (ref.relationship.validTo !== null)
			await tx.entityRelationship.update({
				where: { id: ref.relationship.id },
				data: { validTo: null },
			});
		return true;
	}
	let relationship = await tx.entityRelationship.findFirst({
		where: {
			fromCompanyId: input.fromCompanyId,
			toCompanyId: input.toCompanyId,
			type: RelationshipType.BELONGS_TO,
			validTo: null,
		},
		select: { id: true },
	});
	relationship ??= await tx.entityRelationship.create({
		data: {
			fromCompanyId: input.fromCompanyId,
			toCompanyId: input.toCompanyId,
			type: RelationshipType.BELONGS_TO,
			source: RecordSource.IMPORT,
		},
		select: { id: true },
	});
	await tx.externalRelationshipRef.create({
		data: {
			relationshipId: relationship.id,
			system: ExternalSystem.PRODUCTION,
			externalId,
			confirmedAt: input.now,
			lastSeenAt: input.now,
			sourceUpdatedAt: input.sourceUpdatedAt,
		},
	});
	return true;
}

async function staleMissingRelationships(
	tx: Prisma.TransactionClient,
	fromProductionId: string,
	fromKind: "property" | "chain",
	currentExternalIds: string[],
	now: Date,
) {
	const refs = await tx.externalRelationshipRef.findMany({
		where: {
			system: ExternalSystem.PRODUCTION,
			confirmedAt: { not: null },
			staleAt: null,
			externalId: {
				startsWith: `${fromKind}:${fromProductionId}:belongs-to:chain:`,
				notIn: currentExternalIds,
			},
		},
		select: { id: true, relationshipId: true },
	});
	if (refs.length === 0) return;
	await tx.externalRelationshipRef.updateMany({
		where: { id: { in: refs.map((ref) => ref.id) } },
		data: {
			staleAt: now,
			reviewReason: "Relationship changed in Production",
		},
	});
	await tx.entityRelationship.updateMany({
		where: {
			id: { in: refs.map((ref) => ref.relationshipId) },
			source: RecordSource.IMPORT,
			validTo: null,
		},
		data: { validTo: now },
	});
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
	const existingProfile = await tx.productionBusinessProfile.findUnique({
		where: { productionPropertyId: record.productionPropertyId },
	});
	const profileChanged =
		existingProfile === null ||
		existingProfile.propertySlug !== record.propertySlug ||
		existingProfile.ownershipStatus !== record.ownershipStatus ||
		existingProfile.brandText !== record.brand ||
		existingProfile.sourceUpdatedAt.toISOString() !== record.sourceUpdatedAt ||
		existingProfile.destinationProductionId !== record.destination.id ||
		existingProfile.destinationName !== record.destination.name ||
		existingProfile.destinationSlug !== record.destination.slug ||
		existingProfile.destinationType !== record.destination.type ||
		existingProfile.localityProductionId !== (record.locality?.id ?? null) ||
		existingProfile.localityName !== (record.locality?.name ?? null) ||
		existingProfile.localitySlug !== (record.locality?.slug ?? null) ||
		existingProfile.localityType !== (record.locality?.type ?? null) ||
		JSON.stringify(
			productionCommercialKnowledgeSchema.parse(
				existingProfile.commercialKnowledge,
			),
		) !== JSON.stringify(record.commercialKnowledge) ||
		JSON.stringify(
			productionRecommendationSummarySchema
				.nullable()
				.parse(existingProfile.recommendationSummary),
		) !== JSON.stringify(record.recommendationSummary);
	const data = companyData(record, vertical.id);
	let outcome: "created" | "updated" | "unchanged";
	let companyId: string;
	if (ref) {
		companyId = ref.recordId;
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
		companyId = company.id;
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
	if (existingProfile && existingProfile.companyId !== companyId)
		throw new Error("Production profile identity changed company");
	if (outcome === "unchanged" && profileChanged) outcome = "updated";
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
	await tx.productionBusinessProfile.upsert({
		where: { productionPropertyId: record.productionPropertyId },
		create: {
			companyId,
			productionPropertyId: record.productionPropertyId,
			propertySlug: record.propertySlug,
			ownershipStatus: record.ownershipStatus,
			destinationProductionId: record.destination.id,
			destinationName: record.destination.name,
			destinationSlug: record.destination.slug,
			destinationType: record.destination.type,
			localityProductionId: record.locality?.id,
			localityName: record.locality?.name,
			localitySlug: record.locality?.slug,
			localityType: record.locality?.type,
			brandText: record.brand,
			commercialKnowledge: record.commercialKnowledge,
			recommendationSummary:
				record.recommendationSummary ?? PrismaNamespace.JsonNull,
			sourceUpdatedAt: new Date(record.sourceUpdatedAt),
			fetchedAt: now,
		},
		update: {
			propertySlug: record.propertySlug,
			ownershipStatus: record.ownershipStatus,
			destinationProductionId: record.destination.id,
			destinationName: record.destination.name,
			destinationSlug: record.destination.slug,
			destinationType: record.destination.type,
			localityProductionId: record.locality?.id ?? null,
			localityName: record.locality?.name ?? null,
			localitySlug: record.locality?.slug ?? null,
			localityType: record.locality?.type ?? null,
			brandText: record.brand,
			commercialKnowledge: record.commercialKnowledge,
			recommendationSummary:
				record.recommendationSummary ?? PrismaNamespace.JsonNull,
			sourceUpdatedAt: new Date(record.sourceUpdatedAt),
			fetchedAt: now,
		},
	});
	const sourceUpdatedAt = new Date(record.sourceUpdatedAt);
	const chainCompanyId = record.chain
		? await upsertStructuralCompany(tx, record.chain, vertical.id, now)
		: null;
	if (record.chain && chainCompanyId)
		await upsertProductionRelationship(tx, {
			fromCompanyId: companyId,
			toCompanyId: chainCompanyId,
			externalId: propertyChainRelationshipExternalId(
				record.productionPropertyId,
				record.chain.id,
			),
			sourceUpdatedAt,
			now,
		});
	await staleMissingRelationships(
		tx,
		record.productionPropertyId,
		"property",
		record.chain
			? [
					propertyChainRelationshipExternalId(
						record.productionPropertyId,
						record.chain.id,
					),
				]
			: [],
		now,
	);
	const parentCompanyId = record.parentChain
		? await upsertStructuralCompany(tx, record.parentChain, vertical.id, now)
		: null;
	if (record.chain && chainCompanyId && record.parentChain && parentCompanyId)
		await upsertProductionRelationship(tx, {
			fromCompanyId: chainCompanyId,
			toCompanyId: parentCompanyId,
			externalId: chainParentRelationshipExternalId(
				record.chain.id,
				record.parentChain.id,
			),
			sourceUpdatedAt,
			now,
		});
	if (record.chain)
		await staleMissingRelationships(
			tx,
			record.chain.id,
			"chain",
			record.parentChain
				? [
						chainParentRelationshipExternalId(
							record.chain.id,
							record.parentChain.id,
						),
					]
				: [],
			now,
		);
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
	const cursors = new Set<string>();
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
		if (page.nextCursor !== null) {
			if (cursors.has(page.nextCursor)) {
				throw new Error("Production pagination repeated a cursor");
			}
			cursors.add(page.nextCursor);
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
	const runScope = options.auditScope ?? key;
	const audit = options.audit ?? true;
	const saved = options.dryRun
		? null
		: await db.productionImportState.findUnique({ where: { id: key } });
	if (options.fullReconciliation && options.destination) {
		throw new Error("Full reconciliation cannot use a destination filter");
	}
	const updatedSince = updatedSinceFor(options, saved);
	let runId: string | undefined;
	const leaseOwner = crypto.randomUUID();
	const priorFullRun = options.fullReconciliation
		? await db.productionImportRun.findFirst({
				where: {
					scope: runScope,
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
				scope: runScope,
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
					scope: runScope,
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
				snapshot: options.snapshot ?? saved?.snapshot ?? undefined,
			},
			heartbeat,
		);
		const { pages, records, snapshot } = manifest;
		let readRequests = manifest.readRequests;
		const productionIds = new Set(
			records.map((record) => record.productionPropertyId),
		);
		const productionRelationshipIds = new Set(
			records.flatMap(relationshipExternalIds),
		);
		const productionStructureIds = new Set(
			records.flatMap((record) =>
				[record.chain, record.parentChain].flatMap((entity) =>
					entity ? [structuralExternalId(entity.id)] : [],
				),
			),
		);
		const productionIdManifestDigest = await productionIdDigest(productionIds);
		const manifestDigest = await productionManifestDigest(records);
		assertApprovedManifest(productionIds, options.expectedProductionIds);
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
		assertExpectedEvidence(
			options,
			records,
			productionIdManifestDigest,
			manifestDigest,
		);
		if (options.destination) {
			const mismatched = records.filter(
				(record) => record.destination.slug !== options.destination,
			);
			if (mismatched.length > 0) {
				if (runId) {
					await db.productionImportRun.update({
						where: { id: runId, leaseOwner },
						data: {
							exceptionCount: mismatched.length,
							reviewCount: mismatched.length,
							reviewItems: mismatched.map((record) => ({
								productionPropertyId: record.productionPropertyId,
								reason: `Expected destination ${options.destination}, received ${record.destination.slug}`,
							})),
						},
					});
				}
				throw new Error(
					"Production manifest contains an unexpected destination",
				);
			}
		}
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
			for (const id of verification.records.flatMap(relationshipExternalIds))
				productionRelationshipIds.add(id);
			for (const record of verification.records)
				for (const entity of [record.chain, record.parentChain])
					if (entity)
						productionStructureIds.add(structuralExternalId(entity.id));
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
		const reviewItems = manifestReviewItems(records);
		const [unconfirmedStructureRefs, unconfirmedRelationshipRefs] =
			await Promise.all([
				db.externalRef.findMany({
					where: {
						system: ExternalSystem.PRODUCTION,
						recordType: ExternalRecordType.COMPANY,
						externalId: { in: [...productionStructureIds] },
						confirmedAt: null,
					},
					select: { externalId: true },
				}),
				db.externalRelationshipRef.findMany({
					where: {
						system: ExternalSystem.PRODUCTION,
						externalId: { in: [...productionRelationshipIds] },
						confirmedAt: null,
					},
					select: { externalId: true },
				}),
			]);
		reviewItems.push(
			...unconfirmedStructureRefs.map((ref) => ({
				productionPropertyId: ref.externalId.slice("chain:".length),
				reason: "Existing Production chain reference is not confirmed",
			})),
			...unconfirmedRelationshipRefs.map((ref) => ({
				productionPropertyId: ref.externalId,
				reason: "Existing Production relationship reference is not confirmed",
			})),
		);
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
		let staleRelationships = 0;

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
		const requiringReview = reviewItems.length;
		const boundaryEvidence = {
			contractVersion: "2" as const,
			httpMethod: "GET" as const,
			readRequests,
			clientEvidence: "GET_ONLY_HTTP_CLIENT" as const,
			manifestSnapshot: snapshot,
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
					const staleStructureRefs = await tx.externalRef.findMany({
						where: {
							system: ExternalSystem.PRODUCTION,
							recordType: ExternalRecordType.COMPANY,
							matchedBy: MatchActor.IMPORT,
							matchMethod: "production-chain-id",
							confirmedAt: { not: null },
							staleAt: null,
							externalId: { notIn: [...productionStructureIds] },
						},
						select: { id: true, externalId: true },
					});
					await tx.externalRef.updateMany({
						where: { id: { in: staleStructureRefs.map((ref) => ref.id) } },
						data: {
							staleAt: now,
							reviewReason:
								"Chain is absent from the current Production universe",
						},
					});
					staleReferences += staleStructureRefs.length;
					for (const ref of staleStructureRefs)
						reviewItems.push({
							productionPropertyId: ref.externalId.slice("chain:".length),
							reason: "Chain left the qualifying Production universe",
						});
					const staleRelationshipRefs =
						await tx.externalRelationshipRef.findMany({
							where: {
								system: ExternalSystem.PRODUCTION,
								confirmedAt: { not: null },
								staleAt: null,
								OR: [
									{ externalId: { startsWith: "property:" } },
									{ externalId: { startsWith: "chain:" } },
								],
								externalId: {
									notIn: [...productionRelationshipIds],
								},
							},
							select: { id: true, relationshipId: true },
						});
					staleRelationships = staleRelationshipRefs.length;
					await tx.externalRelationshipRef.updateMany({
						where: { id: { in: staleRelationshipRefs.map((ref) => ref.id) } },
						data: {
							staleAt: now,
							reviewReason:
								"Relationship is absent from the current Production universe",
						},
					});
					await tx.entityRelationship.updateMany({
						where: {
							id: {
								in: staleRelationshipRefs.map((ref) => ref.relationshipId),
							},
							source: RecordSource.IMPORT,
							validTo: null,
						},
						data: { validTo: now },
					});
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
							relationshipCount: productionRelationshipIds.size,
							staleRelationshipCount: staleRelationships,
							reviewCount:
								requiringReview + staleReferences + staleRelationships,
							staleRefCount: staleReferences,
							reviewItems,
							readRequestCount: readRequests,
							boundaryEvidence: {
								...boundaryEvidence,
								manifestProductionIds: records.map(
									(record) => record.productionPropertyId,
								),
								manifestProductionIdDigest: productionIdManifestDigest,
								manifestPayloadDigest: manifestDigest,
							},
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
