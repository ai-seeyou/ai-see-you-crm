import {
	type Db,
	EntityType,
	ExternalRecordType,
	ExternalSystem,
	type Prisma,
	RelationshipType,
} from "@crm/db";

export type BusinessDimensions = {
	countryCodes: string[];
	destinationIds: string[];
	hotelGroupIds: string[];
};

export const UNGROUPED_HOTELS = "ungrouped";

const countryNames = new Intl.DisplayNames(["en"], { type: "region" });

export function countryLabel(code: string): string {
	if (code === "GB") return "United Kingdom";
	try {
		return countryNames.of(code) ?? code;
	} catch {
		return code;
	}
}

function activeAt(now: Date) {
	return {
		AND: [
			{ OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
			{ OR: [{ validTo: null }, { validTo: { gt: now } }] },
		],
	};
}

function governedRelationship(now: Date): Prisma.EntityRelationshipWhereInput {
	return {
		...activeAt(now),
		externalRef: {
			is: {
				system: ExternalSystem.PRODUCTION,
				confirmedAt: { not: null },
				staleAt: null,
			},
		},
	};
}

async function governedGroupIds(db: Db): Promise<Set<string>> {
	const groups = await db.company.findMany({
		where: { entityType: EntityType.HOTEL_GROUP, archivedAt: null },
		select: { id: true },
	});
	const refs = await db.externalRef.findMany({
		where: {
			system: ExternalSystem.PRODUCTION,
			recordType: ExternalRecordType.COMPANY,
			confirmedAt: { not: null },
			staleAt: null,
			recordId: { in: groups.map(({ id }) => id) },
		},
		select: { recordId: true },
	});
	return new Set(refs.map((ref) => ref.recordId));
}

async function governedHotelIds(db: Db): Promise<string[]> {
	const refs = await db.externalRef.findMany({
		where: {
			system: ExternalSystem.PRODUCTION,
			recordType: ExternalRecordType.COMPANY,
			matchMethod: "production-property-id",
			matchedBy: "IMPORT",
			confirmedAt: { not: null },
			staleAt: null,
		},
		select: { recordId: true },
	});
	return refs.map(({ recordId }) => recordId);
}

async function selectedGroupClosure(
	db: Db,
	selected: string[],
	now: Date,
): Promise<string[]> {
	if (selected.length === 0) return [];
	const governed = await governedGroupIds(db);
	const roots = selected.filter((id) => governed.has(id));
	if (roots.length === 0) return [];
	const edges = await db.entityRelationship.findMany({
		where: {
			type: RelationshipType.BELONGS_TO,
			...governedRelationship(now),
			fromCompanyId: { in: [...governed] },
			toCompanyId: { in: [...governed] },
		},
		select: { fromCompanyId: true, toCompanyId: true },
	});
	const descendants = new Set(roots);
	let changed = true;
	while (changed) {
		changed = false;
		for (const edge of edges) {
			if (
				!descendants.has(edge.toCompanyId) ||
				descendants.has(edge.fromCompanyId)
			)
				continue;
			descendants.add(edge.fromCompanyId);
			changed = true;
		}
	}
	return [...descendants];
}

export async function businessDimensionFilter(
	db: Db,
	dimensions: BusinessDimensions,
	now = new Date(),
): Promise<Prisma.CompanyWhereInput> {
	const and: Prisma.CompanyWhereInput[] = [];
	const countryCodes = dimensions.countryCodes.map((code) =>
		code.toUpperCase(),
	);
	if (countryCodes.length > 0) and.push({ countryCode: { in: countryCodes } });
	if (dimensions.destinationIds.length > 0) {
		const hotelIds = await governedHotelIds(db);
		and.push({
			id: { in: hotelIds },
			productionProfile: {
				is: { destinationProductionId: { in: dimensions.destinationIds } },
			},
		});
	}
	if (dimensions.hotelGroupIds.length > 0) {
		const hotelIds = await governedHotelIds(db);
		const governedGroups = await governedGroupIds(db);
		const includesUngrouped =
			dimensions.hotelGroupIds.includes(UNGROUPED_HOTELS);
		const groupIds = await selectedGroupClosure(
			db,
			dimensions.hotelGroupIds.filter((id) => id !== UNGROUPED_HOTELS),
			now,
		);
		const groupConditions: Prisma.CompanyWhereInput[] = [];
		if (groupIds.length > 0)
			groupConditions.push({
				relationsFrom: {
					some: {
						type: RelationshipType.BELONGS_TO,
						toCompanyId: { in: groupIds },
						...governedRelationship(now),
					},
				},
			});
		if (includesUngrouped)
			groupConditions.push({
				relationsFrom: {
					none: {
						type: RelationshipType.BELONGS_TO,
						toCompanyId: { in: [...governedGroups] },
						...governedRelationship(now),
					},
				},
			});
		if (groupConditions.length === 0) groupConditions.push({ id: { in: [] } });
		and.push({
			id: { in: hotelIds },
			entityType: EntityType.HOTEL,
			OR: groupConditions,
		});
	}
	return and.length === 0 ? {} : { AND: and };
}

export async function navigationFacets(db: Db, now = new Date()) {
	const [governed, hotelIds] = await Promise.all([
		governedGroupIds(db),
		governedHotelIds(db),
	]);
	const hotels = await db.company.findMany({
		where: {
			id: { in: hotelIds },
			archivedAt: null,
			entityType: EntityType.HOTEL,
			productionProfile: { isNot: null },
		},
		select: {
			id: true,
			countryCode: true,
			productionProfile: {
				select: { destinationProductionId: true, destinationName: true },
			},
			relationsFrom: {
				where: {
					type: RelationshipType.BELONGS_TO,
					toCompanyId: { in: [...governed] },
					...governedRelationship(now),
				},
				select: { toCompanyId: true },
			},
		},
	});
	const groups = await db.company.findMany({
		where: {
			id: { in: [...governed] },
			entityType: EntityType.HOTEL_GROUP,
			archivedAt: null,
		},
		select: { id: true, name: true },
		orderBy: { name: "asc" },
	});
	const edges = await db.entityRelationship.findMany({
		where: {
			type: RelationshipType.BELONGS_TO,
			...governedRelationship(now),
			fromCompanyId: { in: groups.map((group) => group.id) },
			toCompanyId: { in: groups.map((group) => group.id) },
		},
		select: { fromCompanyId: true, toCompanyId: true },
	});
	const parentsByChild = new Map<string, Set<string>>();
	for (const edge of edges) {
		const parents = parentsByChild.get(edge.fromCompanyId) ?? new Set<string>();
		parentsByChild.set(edge.fromCompanyId, parents);
		parents.add(edge.toCompanyId);
	}
	const countryCounts = new Map<string, number>();
	const destinations = new Map<
		string,
		{ name: string; countryCode: string | null; count: number }
	>();
	const groupCounts = new Map<string, number>();
	for (const hotel of hotels) {
		if (hotel.countryCode)
			countryCounts.set(
				hotel.countryCode,
				(countryCounts.get(hotel.countryCode) ?? 0) + 1,
			);
		if (hotel.productionProfile) {
			const current = destinations.get(
				hotel.productionProfile.destinationProductionId,
			);
			destinations.set(hotel.productionProfile.destinationProductionId, {
				name: hotel.productionProfile.destinationName,
				countryCode: current?.countryCode ?? hotel.countryCode,
				count: (current?.count ?? 0) + 1,
			});
		}
		const reached = new Set<string>();
		const pending = hotel.relationsFrom.map(({ toCompanyId }) => toCompanyId);
		while (pending.length) {
			const groupId = pending.pop();
			if (!groupId || reached.has(groupId)) continue;
			reached.add(groupId);
			for (const parent of parentsByChild.get(groupId) ?? [])
				pending.push(parent);
		}
		for (const groupId of reached)
			groupCounts.set(groupId, (groupCounts.get(groupId) ?? 0) + 1);
	}
	return {
		countries: [...countryCounts]
			.map(([code, count]) => ({ code, label: countryLabel(code), count }))
			.sort((a, b) => a.label.localeCompare(b.label)),
		destinations: [...destinations]
			.map(([id, value]) => ({ id, ...value }))
			.sort((a, b) => a.name.localeCompare(b.name)),
		hotelGroups: [
			...groups.map((group) => ({
				...group,
				parentId: [...(parentsByChild.get(group.id) ?? [])][0] ?? null,
				count: groupCounts.get(group.id) ?? 0,
			})),
			{
				id: UNGROUPED_HOTELS,
				name: "Ungrouped",
				parentId: null,
				count: hotels.filter((hotel) => hotel.relationsFrom.length === 0)
					.length,
			},
		],
	};
}

export async function hotelGroupMemberships(
	db: Db,
	hotelIds: string[],
	now = new Date(),
) {
	const governed = await governedGroupIds(db);
	const [groups, relations] = await Promise.all([
		db.company.findMany({
			where: {
				id: { in: [...governed] },
				entityType: EntityType.HOTEL_GROUP,
				archivedAt: null,
			},
			select: { id: true, name: true },
		}),
		db.entityRelationship.findMany({
			where: {
				type: RelationshipType.BELONGS_TO,
				...governedRelationship(now),
				OR: [
					{
						fromCompanyId: { in: hotelIds },
						toCompanyId: { in: [...governed] },
					},
					{
						fromCompanyId: { in: [...governed] },
						toCompanyId: { in: [...governed] },
					},
				],
			},
			select: { fromCompanyId: true, toCompanyId: true },
		}),
	]);
	const groupById = new Map(groups.map((group) => [group.id, group]));
	const parentsByChild = new Map<string, Set<string>>();
	for (const relation of relations.filter(({ fromCompanyId }) =>
		governed.has(fromCompanyId),
	)) {
		const parents =
			parentsByChild.get(relation.fromCompanyId) ?? new Set<string>();
		parentsByChild.set(relation.fromCompanyId, parents);
		parents.add(relation.toCompanyId);
	}
	const memberships = new Map<string, Set<string>>();
	for (const relation of relations) {
		if (!hotelIds.includes(relation.fromCompanyId)) continue;
		const ids = memberships.get(relation.fromCompanyId) ?? new Set<string>();
		memberships.set(relation.fromCompanyId, ids);
		const pending = [relation.toCompanyId];
		while (pending.length) {
			const groupId = pending.pop();
			if (!groupId || ids.has(groupId)) continue;
			ids.add(groupId);
			for (const parent of parentsByChild.get(groupId) ?? [])
				pending.push(parent);
		}
	}
	return { memberships, groupById };
}

export const activeAssignmentWhere = (
	now = new Date(),
): Prisma.ContactAssignmentWhereInput => ({
	scope: { in: ["EMPLOYER", "RESPONSIBLE_FOR"] },
	...activeAt(now),
});
