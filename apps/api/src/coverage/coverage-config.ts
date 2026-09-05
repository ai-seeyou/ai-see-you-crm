import { ContactRoleType, EntityType } from "@crm/db";

const ROLE = ContactRoleType;

export const COVERAGE = {
	target: {
		fieldKey: "lifecycle_stage",
		optionLabels: ["Target"],
	},

	page: {
		maxBusinesses: 200,
	},

	// The required role per kind of business. Change a row here and the gap view
	// changes with it. This is a decision about who has to be in the CRM before we
	// can sell to a business, not a fact about the business, so it stays a constant
	// and does not become a table until somebody other than an engineer edits it.
	requiredRoles: {
		[EntityType.HOTEL]: [ROLE.GENERAL_MANAGER, ROLE.REVENUE, ROLE.MARKETING],
		[EntityType.HOTEL_GROUP]: [
			ROLE.EXECUTIVE,
			ROLE.DISTRIBUTION,
			ROLE.COMMERCIAL,
		],
		[EntityType.HOTEL_BRAND]: [ROLE.MARKETING, ROLE.DISTRIBUTION],
		[EntityType.MANAGEMENT_COMPANY]: [
			ROLE.COMMERCIAL,
			ROLE.REVENUE,
			ROLE.EXECUTIVE,
		],
		[EntityType.OWNERSHIP_GROUP]: [ROLE.OWNER, ROLE.EXECUTIVE],
		[EntityType.DESTINATION_ORGANISATION]: [ROLE.MARKETING, ROLE.EXECUTIVE],
		[EntityType.CRUISE_LINE]: [
			ROLE.COMMERCIAL,
			ROLE.DISTRIBUTION,
			ROLE.MARKETING,
		],
		[EntityType.CRUISE_SHIP]: [ROLE.GENERAL_MANAGER],
		[EntityType.TOUR_OPERATOR]: [ROLE.COMMERCIAL, ROLE.PROCUREMENT],
		[EntityType.OTHER]: [ROLE.COMMERCIAL],
	},
} as const satisfies {
	target: { fieldKey: string; optionLabels: readonly string[] };
	page: { maxBusinesses: number };
	requiredRoles: Record<EntityType, readonly ContactRoleType[]>;
};

export function requiredRolesFor(
	entityType: EntityType,
): readonly ContactRoleType[] {
	return COVERAGE.requiredRoles[entityType];
}
