import { EntityType, RecordSource, RelationshipType } from "@crm/db";
import { relationshipEvidence } from "@crm/validation/relationship-evidence";
import { pastOrPresent } from "@crm/validation/temporal";
import { z } from "zod";

export const relationshipType = z.enum(
	Object.values(RelationshipType) as [RelationshipType, ...RelationshipType[]],
);

const relationshipEntityType = z.enum(
	Object.values(EntityType) as [EntityType, ...EntityType[]],
);

const relationshipSource = z.enum(
	Object.values(RecordSource) as [RecordSource, ...RecordSource[]],
);

export const relationshipDirection = z.enum(["outgoing", "incoming"]);

const relationshipCompanyOutput = z.object({
	id: z.string(),
	name: z.string(),
	domain: z.string().nullable(),
	entityType: relationshipEntityType,
	iconUrl: z.string().nullable(),
	iconDarkUrl: z.string().nullable(),
	iconTone: z.string().nullable(),
});

export const relationshipEdgeOutput = z.object({
	id: z.string(),
	type: relationshipType,
	direction: relationshipDirection,
	company: relationshipCompanyOutput,
	note: z.string().nullable(),
	source: relationshipSource,
	validFrom: z.string().nullable(),
	validTo: z.string().nullable(),
	createdAt: z.string(),
});

export const relationshipsForCompanyInput = z.object({
	companyId: z.string(),
	includeEnded: z.boolean().default(false),
});

export type RelationshipsForCompanyInput = z.infer<
	typeof relationshipsForCompanyInput
>;

export const relationshipsForCompanyOutput = z.object({
	companyId: z.string(),
	outgoing: z.array(relationshipEdgeOutput),
	incoming: z.array(relationshipEdgeOutput),
});

export const relationshipCreateInput = z.object({
	fromCompanyId: z.string(),
	toCompanyId: z.string(),
	type: relationshipType,
	note: z.string().optional(),
	validFrom: pastOrPresent.optional(),
	evidence: relationshipEvidence.optional(),
});

export type RelationshipCreateInput = z.infer<typeof relationshipCreateInput>;

export const relationshipEndInput = z.object({
	id: z.string(),
	at: z.iso.datetime().optional(),
});

export type RelationshipEndInput = z.infer<typeof relationshipEndInput>;

export const relationshipMutateOutput = z.object({
	id: z.string(),
	fromCompanyId: z.string(),
	toCompanyId: z.string(),
	type: relationshipType,
	validFrom: z.string().nullable(),
	validTo: z.string().nullable(),
});
