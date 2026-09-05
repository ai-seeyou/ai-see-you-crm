import { z } from "zod";

const identifiedName = z.object({
	id: z.string().uuid(),
	name: z.string().trim().min(1),
});

export const productionBusinessSchema = z.object({
	productionPropertyId: z.string().uuid(),
	canonicalName: z.string().trim().min(1),
	destination: identifiedName.extend({ slug: z.string().trim().min(1) }),
	country: z.object({
		name: z.string().trim().min(1).nullable(),
		code: z.string().trim().length(2).nullable(),
	}),
	primaryDomain: z.string().trim().min(1).nullable(),
	chain: identifiedName.nullable(),
	entityType: z.literal("HOTEL"),
	vertical: z.literal("HOTEL"),
	firstQualifiedAt: z.iso.datetime(),
	sourceUpdatedAt: z.iso.datetime(),
});

export const productionBusinessPageSchema = z.object({
	ok: z.literal(true),
	contractVersion: z.literal("1"),
	snapshot: z.iso.datetime(),
	records: z.array(productionBusinessSchema),
	nextCursor: z.string().nullable(),
});

export type ProductionBusiness = z.infer<typeof productionBusinessSchema>;
export type ProductionBusinessPage = z.infer<
	typeof productionBusinessPageSchema
>;
