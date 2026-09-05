import { z } from "zod";

export const relationshipEvidence = z.object({
	kind: z.string().trim().min(1),
	detail: z.string().trim().min(1),
	sourceUrl: z.url().optional(),
});

export type RelationshipEvidence = z.infer<typeof relationshipEvidence>;
