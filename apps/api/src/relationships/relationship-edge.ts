import type { Prisma, RelationshipType } from "@crm/db";

const EDGE_COMPANY_SELECT = {
	id: true,
	name: true,
	domain: true,
	entityType: true,
	iconUrl: true,
	iconDarkUrl: true,
	iconTone: true,
} as const;

export const RELATIONSHIP_EDGE_SELECT = {
	id: true,
	type: true,
	note: true,
	source: true,
	validFrom: true,
	validTo: true,
	createdAt: true,
	fromCompany: { select: EDGE_COMPANY_SELECT },
	toCompany: { select: EDGE_COMPANY_SELECT },
} as const;

export type RelationshipDirection = "outgoing" | "incoming";

type EdgeRow = Prisma.EntityRelationshipGetPayload<{
	select: typeof RELATIONSHIP_EDGE_SELECT;
}>;

export type RelationshipEdge = {
	id: string;
	type: RelationshipType;
	direction: RelationshipDirection;
	company: EdgeRow["toCompany"];
	note: string | null;
	source: EdgeRow["source"];
	validFrom: string | null;
	validTo: string | null;
	createdAt: string;
};

export function serializeEdge(
	edge: EdgeRow,
	direction: RelationshipDirection,
): RelationshipEdge {
	return {
		id: edge.id,
		type: edge.type,
		direction,
		company: direction === "outgoing" ? edge.toCompany : edge.fromCompany,
		note: edge.note,
		source: edge.source,
		validFrom: edge.validFrom?.toISOString() ?? null,
		validTo: edge.validTo?.toISOString() ?? null,
		createdAt: edge.createdAt.toISOString(),
	};
}
