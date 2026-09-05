import { ContactRoleType, EntityType, RelationshipType } from "@crm/db";

export const ENTITY = {
	relationships: {
		partOf: 12,
		contains: 12,
	},

	responsible: {
		listed: 15,
	},

	coverage: {
		listed: 15,
	},

	search: {
		partOf: 3,
	},
} as const;

export const RELATIONSHIP_LABELS = {
	[RelationshipType.BELONGS_TO]: "recorded as belonging to",
	[RelationshipType.BRAND_OF]: "recorded as a brand of",
	[RelationshipType.MANAGED_BY]: "recorded as managed by",
	[RelationshipType.OWNED_BY]: "recorded as owned by",
	[RelationshipType.OPERATED_BY]: "recorded as operated by",
	[RelationshipType.LOCATED_IN]: "recorded as located in",
} as const satisfies Record<RelationshipType, string>;

export const ENTITY_TYPE_LABELS = {
	[EntityType.HOTEL]: "hotel",
	[EntityType.HOTEL_GROUP]: "hotel group",
	[EntityType.HOTEL_BRAND]: "hotel brand",
	[EntityType.MANAGEMENT_COMPANY]: "management company",
	[EntityType.OWNERSHIP_GROUP]: "ownership group",
	[EntityType.DESTINATION_ORGANISATION]: "destination organisation",
	[EntityType.CRUISE_LINE]: "cruise line",
	[EntityType.CRUISE_SHIP]: "cruise ship",
	[EntityType.TOUR_OPERATOR]: "tour operator",
	[EntityType.OTHER]: "not recorded",
} as const satisfies Record<EntityType, string>;

export const ROLE_TYPE_LABELS = {
	[ContactRoleType.GENERAL_MANAGER]: "General manager",
	[ContactRoleType.REVENUE]: "Revenue",
	[ContactRoleType.DISTRIBUTION]: "Distribution",
	[ContactRoleType.COMMERCIAL]: "Commercial",
	[ContactRoleType.MARKETING]: "Marketing",
	[ContactRoleType.DIGITAL]: "Digital",
	[ContactRoleType.OWNER]: "Owner",
	[ContactRoleType.EXECUTIVE]: "Executive",
	[ContactRoleType.PROCUREMENT]: "Procurement",
	[ContactRoleType.OTHER]: "Role not recorded",
} as const satisfies Record<ContactRoleType, string>;
