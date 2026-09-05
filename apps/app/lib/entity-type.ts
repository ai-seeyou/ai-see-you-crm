import { EntityType } from "@crm/db/enums";

export const ENTITY_TYPE_ORDER: readonly EntityType[] = [
	EntityType.HOTEL,
	EntityType.HOTEL_GROUP,
	EntityType.HOTEL_BRAND,
	EntityType.MANAGEMENT_COMPANY,
	EntityType.OWNERSHIP_GROUP,
	EntityType.DESTINATION_ORGANISATION,
	EntityType.CRUISE_LINE,
	EntityType.CRUISE_SHIP,
	EntityType.TOUR_OPERATOR,
	EntityType.OTHER,
];

type EntityTypePresentation = { label: string; many: string };

type EntityTypeMap = Record<EntityType, EntityTypePresentation>;

const PRESENTATION: EntityTypeMap = {
	HOTEL: { label: "Hotel", many: "Hotels" },
	HOTEL_GROUP: { label: "Hotel group", many: "Hotel groups" },
	HOTEL_BRAND: { label: "Hotel brand", many: "Hotel brands" },
	MANAGEMENT_COMPANY: {
		label: "Management company",
		many: "Management companies",
	},
	OWNERSHIP_GROUP: { label: "Ownership group", many: "Ownership groups" },
	DESTINATION_ORGANISATION: {
		label: "Destination organisation",
		many: "Destination organisations",
	},
	CRUISE_LINE: { label: "Cruise line", many: "Cruise lines" },
	CRUISE_SHIP: { label: "Cruise ship", many: "Cruise ships" },
	TOUR_OPERATOR: { label: "Tour operator", many: "Tour operators" },
	OTHER: { label: "Other", many: "Other" },
};

// A row written before an entity type was retired still holds its old name. The
// table and the sheet render those rows, so an unknown name reads as itself
// rather than throwing on a lookup that cannot succeed.
const UNKNOWN: EntityTypePresentation = {
	label: "Unknown type",
	many: "Unknown types",
};

export const ENTITY_TYPE_OPTIONS = ENTITY_TYPE_ORDER.map((value) => ({
	value,
	label: PRESENTATION[value].label,
}));

export function entityTypePresentation(
	entityType: EntityType,
): EntityTypePresentation {
	return PRESENTATION[entityType] ?? UNKNOWN;
}

export function entityTypeLabel(entityType: EntityType): string {
	return entityTypePresentation(entityType).label;
}

export function entityTypeLabelPlural(entityType: EntityType): string {
	return entityTypePresentation(entityType).many;
}
