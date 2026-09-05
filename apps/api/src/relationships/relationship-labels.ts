import { RelationshipType } from "@crm/db";

export const RELATIONSHIP_LABELS = {
	[RelationshipType.BELONGS_TO]: "recorded as belonging to",
	[RelationshipType.BRAND_OF]: "recorded as a brand of",
	[RelationshipType.MANAGED_BY]: "recorded as managed by",
	[RelationshipType.OWNED_BY]: "recorded as owned by",
	[RelationshipType.OPERATED_BY]: "recorded as operated by",
	[RelationshipType.LOCATED_IN]: "recorded as located in",
} as const satisfies Record<RelationshipType, string>;
