import {
	db,
	EntityType,
	ExternalRecordType,
	ExternalSystem,
	MatchActor,
	type Prisma,
	Prisma as PrismaNamespace,
} from "@crm/db";
import type {
	ProductionCategoryMembership,
	ProductionCategorySnapshot,
} from "@crm/validation/production-category";
import { productionCategorySnapshotSchema } from "@crm/validation/production-category";
import { PRODUCTION_CATEGORY } from "./production-category-config";
import type { ProductionReadClient } from "./production-client";
import { PRODUCTION_READ } from "./production-read-config";

export type ProductionCategorySyncResult = {
	snapshotId: string;
	categories: number;
	properties: number;
	memberships: number;
	linkedProperties: number;
	unresolvedProperties: number;
	activated: boolean;
	relinkedProperties: number;
	readRequests: number;
	authorityDigest: string;
	registryDigest: string;
	destinationRunDigest: string;
	membershipDigest: string;
};

export type ProductionCategorySyncOptions = {
	dryRun?: boolean;
	expectedSnapshotId?: string;
};

export function productionCategorySyncMode(
	activeSnapshotId: string | null,
	options: ProductionCategorySyncOptions,
) {
	if (
		options.expectedSnapshotId &&
		!/^[a-f0-9]{64}$/.test(options.expectedSnapshotId)
	)
		throw new Error("Approved Production Category snapshot ID is invalid");
	if (options.dryRun) return "DRY_RUN" as const;
	if (activeSnapshotId || options.expectedSnapshotId) return "SYNC" as const;
	return "SKIP" as const;
}

async function sha256(value: string) {
	const bytes = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(value),
	);
	return [...new Uint8Array(bytes)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

function assertOrderedUnique(values: string[], label: string) {
	for (let index = 1; index < values.length; index += 1) {
		const previous = values[index - 1];
		const current = values[index];
		if (previous !== undefined && current !== undefined && previous >= current)
			throw new Error(`Production Category ${label} is not ordered and unique`);
	}
}

async function assertSnapshot(snapshot: ProductionCategorySnapshot) {
	if (snapshot.categoryCount !== PRODUCTION_CATEGORY.approvedCategoryCount)
		throw new Error(
			"Production Category registry does not match the approved core count",
		);
	if (
		snapshot.destinationCount > PRODUCTION_CATEGORY.maximumDestinations ||
		snapshot.propertyCount > PRODUCTION_CATEGORY.maximumProperties ||
		snapshot.membershipCount > PRODUCTION_CATEGORY.maximumMemberships
	)
		throw new Error(
			"Production Category snapshot exceeds its bounded contract",
		);
	if (snapshot.registry.length !== snapshot.categoryCount)
		throw new Error("Production Category registry count does not match");
	if (snapshot.destinations.length !== snapshot.destinationCount)
		throw new Error("Production Category destination count does not match");
	assertOrderedUnique(
		snapshot.registry.map((category) => category.categoryId),
		"registry",
	);
	assertOrderedUnique(
		snapshot.destinations.map((destination) => destination.destinationId),
		"destinations",
	);
	const registryDigest = await sha256(
		snapshot.registry
			.map(
				(category) =>
					`${category.categoryId}|${category.name}|${category.evidenceTier}|${category.lifecycleStatus}`,
			)
			.join("\n"),
	);
	const destinationRunDigest = await sha256(
		snapshot.destinations
			.map(
				(destination) =>
					`${destination.destinationId}|${destination.pulseId}|${destination.runId}|${destination.periodStart}|${destination.certifiedAt}`,
			)
			.join("\n"),
	);
	if (registryDigest !== snapshot.registryDigest)
		throw new Error("Production Category registry digest does not match");
	if (destinationRunDigest !== snapshot.destinationRunDigest)
		throw new Error("Production Category destination digest does not match");
	const snapshotId = await sha256(
		`crm-category-v1|${snapshot.registryDigest}|${snapshot.destinationRunDigest}|${snapshot.membershipDigest}|${snapshot.authorityDigest}`,
	);
	if (snapshotId !== snapshot.snapshotId)
		throw new Error("Production Category snapshot identity does not match");
}

async function fetchMemberships(
	client: ProductionReadClient,
	snapshot: ProductionCategorySnapshot,
	deadline: number,
) {
	const records: ProductionCategoryMembership[] = [];
	const cursors = new Set<string>();
	let cursor: string | undefined;
	let readRequests = 0;
	do {
		if (
			Date.now() > deadline ||
			readRequests >= PRODUCTION_CATEGORY.maximumPages
		)
			throw new Error("Production Category fetch exceeded its operation limit");
		const page = await client.categoryMembershipPage({
			snapshotId: snapshot.snapshotId,
			cursor,
			limit: PRODUCTION_CATEGORY.pageLimit,
			timeoutMs: requestTimeout(deadline),
		});
		readRequests += 1;
		if (page.snapshotId !== snapshot.snapshotId)
			throw new Error("Production Category membership snapshot changed");
		if (page.records.length > PRODUCTION_CATEGORY.pageLimit)
			throw new Error("Production Category membership page exceeds its limit");
		records.push(...page.records);
		if (records.length > PRODUCTION_CATEGORY.maximumMemberships)
			throw new Error(
				"Production Category membership result exceeds its limit",
			);
		if (page.nextCursor && cursors.has(page.nextCursor))
			throw new Error("Production Category membership cursor repeated");
		if (page.nextCursor) cursors.add(page.nextCursor);
		cursor = page.nextCursor ?? undefined;
	} while (cursor);
	return { records, readRequests };
}

function requestTimeout(deadline: number) {
	const remaining = deadline - Date.now();
	if (remaining <= 0)
		throw new Error("Production Category fetch exceeded its operation limit");
	return Math.min(remaining, PRODUCTION_READ.requestTimeoutMs);
}

async function assertMemberships(
	snapshot: ProductionCategorySnapshot,
	records: ProductionCategoryMembership[],
) {
	if (records.length !== snapshot.membershipCount)
		throw new Error("Production Category membership count does not match");
	const registry = new Set(
		snapshot.registry.map((category) => category.categoryId),
	);
	const destinations = new Map(
		snapshot.destinations.map((destination) => [
			destination.destinationId,
			destination,
		]),
	);
	const pairs = records.map(
		(record) => `${record.productionPropertyId}|${record.categoryId}`,
	);
	assertOrderedUnique(pairs, "memberships");
	const propertyDestinations = new Map<string, string>();
	for (const record of records) {
		if (!registry.has(record.categoryId))
			throw new Error("Production Category membership has an unknown category");
		const destination = destinations.get(record.destinationId);
		if (
			!destination ||
			destination.pulseId !== record.pulseId ||
			destination.runId !== record.runId
		)
			throw new Error("Production Category membership has unknown provenance");
		const priorDestination = propertyDestinations.get(
			record.productionPropertyId,
		);
		if (priorDestination && priorDestination !== record.destinationId)
			throw new Error(
				"Production Category property has conflicting destinations",
			);
		propertyDestinations.set(record.productionPropertyId, record.destinationId);
	}
	const propertyCount = new Set(
		records.map((record) => record.productionPropertyId),
	).size;
	if (propertyCount !== snapshot.propertyCount)
		throw new Error("Production Category property count does not match");
	const membershipDigest = await sha256(pairs.join("\n"));
	if (membershipDigest !== snapshot.membershipDigest)
		throw new Error("Production Category membership digest does not match");
}

export async function verifyProductionCategoryPayload(
	snapshot: ProductionCategorySnapshot,
	records: ProductionCategoryMembership[],
) {
	await assertSnapshot(snapshot);
	await assertMemberships(snapshot, records);
}

function sameSnapshot(
	left: ProductionCategorySnapshot,
	right: ProductionCategorySnapshot,
) {
	return JSON.stringify(left) === JSON.stringify(right);
}

async function companyLinks(
	tx: Prisma.TransactionClient,
	productionPropertyIds: string[],
) {
	const [profiles, refs] = await Promise.all([
		tx.productionBusinessProfile.findMany({
			where: {
				productionPropertyId: { in: productionPropertyIds },
			},
			select: {
				productionPropertyId: true,
				companyId: true,
				company: {
					select: {
						entityType: true,
					},
				},
			},
		}),
		tx.externalRef.findMany({
			where: {
				system: ExternalSystem.PRODUCTION,
				recordType: ExternalRecordType.COMPANY,
				externalId: { in: productionPropertyIds },
				matchMethod: "production-property-id",
				matchedBy: MatchActor.IMPORT,
				confirmedAt: { not: null },
				staleAt: null,
			},
			select: { externalId: true, recordId: true },
		}),
	]);
	const profilesById = new Map(
		profiles
			.filter((profile) => profile.company.entityType === EntityType.HOTEL)
			.map((profile) => [profile.productionPropertyId, profile.companyId]),
	);
	const refsById = new Map(refs.map((ref) => [ref.externalId, ref.recordId]));
	const links = new Map<string, string>();
	for (const productionPropertyId of productionPropertyIds) {
		const profileCompanyId = profilesById.get(productionPropertyId);
		const refCompanyId = refsById.get(productionPropertyId);
		if (profileCompanyId && refCompanyId && profileCompanyId !== refCompanyId)
			throw new Error("Production Category company identity conflicts");
		if (profileCompanyId && refCompanyId)
			links.set(productionPropertyId, profileCompanyId);
	}
	return links;
}

export async function syncProductionCategories(
	client: ProductionReadClient,
	options: ProductionCategorySyncOptions = {},
): Promise<ProductionCategorySyncResult | null> {
	const initialState = await db.productionCategoryState.findUniqueOrThrow({
		where: { id: PRODUCTION_CATEGORY.stateId },
		select: {
			snapshotId: true,
			revision: true,
			snapshot: { select: { manifest: true } },
		},
	});
	const mode = productionCategorySyncMode(initialState.snapshotId, options);
	if (mode === "SKIP") return null;
	const deadline = Date.now() + PRODUCTION_CATEGORY.fetchDeadlineMs;
	const snapshot = await client.categorySnapshot(requestTimeout(deadline));
	await assertSnapshot(snapshot);
	if (
		options.expectedSnapshotId &&
		snapshot.snapshotId !== options.expectedSnapshotId
	)
		throw new Error("Production Category snapshot does not match approval");
	const isCurrent =
		mode === "SYNC" && initialState.snapshotId === snapshot.snapshotId;
	if (isCurrent) {
		const stored = productionCategorySnapshotSchema.parse(
			initialState.snapshot?.manifest,
		);
		if (!sameSnapshot(snapshot, stored))
			throw new Error("Stored Production Category manifest does not match");
	}
	const fetched = isCurrent
		? { records: [] as ProductionCategoryMembership[], readRequests: 0 }
		: await fetchMemberships(client, snapshot, deadline);
	if (!isCurrent) await assertMemberships(snapshot, fetched.records);
	if (Date.now() > deadline)
		throw new Error("Production Category fetch exceeded its operation limit");
	const verification = isCurrent
		? snapshot
		: await client.categorySnapshot(requestTimeout(deadline));
	if (Date.now() > deadline)
		throw new Error("Production Category fetch exceeded its operation limit");
	if (!sameSnapshot(snapshot, verification))
		throw new Error(
			"Production Category snapshot changed during synchronization",
		);
	if (mode === "DRY_RUN") {
		const productionPropertyIds = [
			...new Set(fetched.records.map((record) => record.productionPropertyId)),
		];
		const links = await db.$transaction(
			(tx) => companyLinks(tx, productionPropertyIds),
			{
				...PRODUCTION_CATEGORY.transaction,
				isolationLevel: PrismaNamespace.TransactionIsolationLevel.Serializable,
			},
		);
		return {
			snapshotId: snapshot.snapshotId,
			categories: snapshot.categoryCount,
			properties: snapshot.propertyCount,
			memberships: snapshot.membershipCount,
			linkedProperties: links.size,
			unresolvedProperties: productionPropertyIds.length - links.size,
			activated: false,
			relinkedProperties: 0,
			readRequests: fetched.readRequests + 2,
			authorityDigest: snapshot.authorityDigest,
			registryDigest: snapshot.registryDigest,
			destinationRunDigest: snapshot.destinationRunDigest,
			membershipDigest: snapshot.membershipDigest,
		};
	}
	const result = await db.$transaction(
		async (tx) => {
			const state = await tx.productionCategoryState.findUniqueOrThrow({
				where: { id: PRODUCTION_CATEGORY.stateId },
				select: { snapshotId: true, revision: true },
			});
			if (
				state.snapshotId !== initialState.snapshotId ||
				state.revision !== initialState.revision
			)
				throw new Error("Production Category activation state changed");
			const productionPropertyIds = isCurrent
				? (
						await tx.productionCategoryMembership.findMany({
							where: { snapshotId: snapshot.snapshotId },
							select: { productionPropertyId: true },
							distinct: ["productionPropertyId"],
						})
					).map((row) => row.productionPropertyId)
				: [
						...new Set(
							fetched.records.map((record) => record.productionPropertyId),
						),
					];
			const links = await companyLinks(tx, productionPropertyIds);
			const linkedPropertyCount = links.size;
			const unresolvedPropertyCount =
				productionPropertyIds.length - linkedPropertyCount;
			if (state.snapshotId === snapshot.snapshotId) {
				const linked = await tx.productionCategoryMembership.findMany({
					where: { snapshotId: snapshot.snapshotId, companyId: { not: null } },
					select: { productionPropertyId: true, companyId: true },
					distinct: ["productionPropertyId", "companyId"],
				});
				for (const membership of linked) {
					const currentCompanyId = links.get(membership.productionPropertyId);
					if (currentCompanyId && currentCompanyId !== membership.companyId)
						throw new Error("Production Category company link conflicts");
				}
				const unresolved = await tx.productionCategoryMembership.findMany({
					where: { snapshotId: snapshot.snapshotId, companyId: null },
					select: { productionPropertyId: true },
					distinct: ["productionPropertyId"],
				});
				let relinkedProperties = 0;
				for (const { productionPropertyId } of unresolved) {
					const companyId = links.get(productionPropertyId);
					if (!companyId) continue;
					const updated = await tx.productionCategoryMembership.updateMany({
						where: {
							snapshotId: snapshot.snapshotId,
							productionPropertyId,
							companyId: null,
						},
						data: { companyId },
					});
					if (updated.count > 0) relinkedProperties += 1;
				}
				const activeLinkedPropertyCount =
					new Set(linked.map((membership) => membership.productionPropertyId))
						.size + relinkedProperties;
				if (relinkedProperties > 0)
					await tx.productionCategorySnapshot.update({
						where: { id: snapshot.snapshotId },
						data: {
							linkedPropertyCount: activeLinkedPropertyCount,
							unresolvedPropertyCount:
								productionPropertyIds.length - activeLinkedPropertyCount,
						},
					});
				return {
					activated: false,
					relinkedProperties,
					linkedPropertyCount: activeLinkedPropertyCount,
					unresolvedPropertyCount:
						productionPropertyIds.length - activeLinkedPropertyCount,
				};
			}
			const existing = await tx.productionCategorySnapshot.findUnique({
				where: { id: snapshot.snapshotId },
				select: {
					manifest: true,
					membershipDigest: true,
					propertyCount: true,
					membershipCount: true,
					categories: {
						select: { categoryId: true, name: true },
						orderBy: { categoryId: "asc" },
					},
					memberships: {
						select: { productionPropertyId: true, categoryId: true },
						orderBy: [{ productionPropertyId: "asc" }, { categoryId: "asc" }],
					},
				},
			});
			if (existing) {
				const stored = productionCategorySnapshotSchema.parse(
					existing.manifest,
				);
				const storedMembershipDigest = await sha256(
					existing.memberships
						.map((row) => `${row.productionPropertyId}|${row.categoryId}`)
						.join("\n"),
				);
				const storedCategories = existing.categories.map((category) => ({
					categoryId: category.categoryId,
					name: category.name,
				}));
				const expectedCategories = snapshot.registry.map((category) => ({
					categoryId: category.categoryId,
					name: category.name,
				}));
				if (
					!sameSnapshot(snapshot, stored) ||
					existing.membershipDigest !== snapshot.membershipDigest ||
					existing.propertyCount !== snapshot.propertyCount ||
					existing.membershipCount !== snapshot.membershipCount ||
					storedMembershipDigest !== snapshot.membershipDigest ||
					JSON.stringify(storedCategories) !==
						JSON.stringify(expectedCategories)
				)
					throw new Error(
						"Stored Production Category snapshot is inconsistent",
					);
			} else {
				await tx.productionCategorySnapshot.create({
					data: {
						id: snapshot.snapshotId,
						manifest: snapshot as Prisma.InputJsonValue,
						membershipDigest: snapshot.membershipDigest,
						propertyCount: snapshot.propertyCount,
						membershipCount: snapshot.membershipCount,
						linkedPropertyCount,
						unresolvedPropertyCount,
					},
				});
				await tx.productionCoreCategory.createMany({
					data: snapshot.registry.map((category) => ({
						snapshotId: snapshot.snapshotId,
						categoryId: category.categoryId,
						name: category.name,
					})),
				});
				for (
					let offset = 0;
					offset < fetched.records.length;
					offset += PRODUCTION_CATEGORY.writeBatchSize
				)
					await tx.productionCategoryMembership.createMany({
						data: fetched.records
							.slice(offset, offset + PRODUCTION_CATEGORY.writeBatchSize)
							.map((record) => ({
								snapshotId: snapshot.snapshotId,
								productionPropertyId: record.productionPropertyId,
								categoryId: record.categoryId,
								companyId: links.get(record.productionPropertyId) ?? null,
							})),
					});
			}
			const activated = await tx.productionCategoryState.updateMany({
				where: {
					id: PRODUCTION_CATEGORY.stateId,
					revision: initialState.revision,
					snapshotId: initialState.snapshotId,
				},
				data: { snapshotId: snapshot.snapshotId, revision: { increment: 1 } },
			});
			if (activated.count !== 1)
				throw new Error(
					"Production Category activation lost its revision lease",
				);
			return {
				activated: true,
				relinkedProperties: 0,
				linkedPropertyCount,
				unresolvedPropertyCount,
			};
		},
		{
			...PRODUCTION_CATEGORY.transaction,
			isolationLevel: PrismaNamespace.TransactionIsolationLevel.Serializable,
		},
	);
	return {
		snapshotId: snapshot.snapshotId,
		categories: snapshot.categoryCount,
		properties: snapshot.propertyCount,
		memberships: snapshot.membershipCount,
		linkedProperties: result.linkedPropertyCount,
		unresolvedProperties: result.unresolvedPropertyCount,
		activated: result.activated,
		relinkedProperties: result.relinkedProperties,
		readRequests: fetched.readRequests + (isCurrent ? 1 : 2),
		authorityDigest: snapshot.authorityDigest,
		registryDigest: snapshot.registryDigest,
		destinationRunDigest: snapshot.destinationRunDigest,
		membershipDigest: snapshot.membershipDigest,
	};
}
