import { RelationshipType } from "@crm/db/enums";

export type RelationshipDirection = "outgoing" | "incoming";

type RelationshipPresentation = { outgoing: string; incoming: string };

const PRESENTATION: Record<RelationshipType, RelationshipPresentation> = {
	BELONGS_TO: { outgoing: "Belongs to", incoming: "Includes" },
	BRAND_OF: { outgoing: "Brand of", incoming: "Has brand" },
	MANAGED_BY: { outgoing: "Managed by", incoming: "Manages" },
	OWNED_BY: { outgoing: "Owned by", incoming: "Owns" },
	OPERATED_BY: { outgoing: "Operated by", incoming: "Operates" },
	LOCATED_IN: { outgoing: "Located in", incoming: "Contains" },
};

const UNKNOWN: RelationshipPresentation = {
	outgoing: "Related to",
	incoming: "Related to",
};

export const RELATIONSHIP_TYPE_ORDER: readonly RelationshipType[] = [
	RelationshipType.BELONGS_TO,
	RelationshipType.BRAND_OF,
	RelationshipType.MANAGED_BY,
	RelationshipType.OWNED_BY,
	RelationshipType.OPERATED_BY,
	RelationshipType.LOCATED_IN,
];

export const RELATIONSHIP_TYPE_OPTIONS = RELATIONSHIP_TYPE_ORDER.map(
	(value) => ({ value, label: PRESENTATION[value].outgoing }),
);

export function relationshipLabel(
	type: RelationshipType,
	direction: RelationshipDirection,
): string {
	return (PRESENTATION[type] ?? UNKNOWN)[direction];
}
