import { z } from "zod";

const identifiedName = z
	.object({
		id: z.string().uuid(),
		name: z.string().trim().min(1).nullable(),
	})
	.strict();

const finiteNumber = z.number().finite();

export const productionDestinationSchema = identifiedName
	.extend({
		name: z.string().trim().min(1),
		slug: z.string().trim().min(1),
		type: z.string().trim().min(1),
	})
	.strict();

export const productionLocalitySchema = identifiedName
	.extend({
		name: z.string().trim().min(1),
		slug: z.string().trim().min(1),
		type: z.enum([
			"precinct",
			"district",
			"suburb",
			"transit_zone",
			"coastal_zone",
			"airport_zone",
			"event_zone",
			"landmark",
		]),
	})
	.strict();

export const productionCommercialKnowledgeSchema = z
	.object({
		canonicalOwnership: z.string().nullable(),
		chainScale: z.string().nullable(),
		propertyPositioning: z.string().nullable(),
		accommodationType: z.string().nullable(),
		starRating: z.string().nullable(),
		heritageStatus: z.string().nullable(),
		locationContexts: z.array(z.string()),
		facilityPresence: z.array(z.string()),
		policyCharacteristics: z.array(z.string()),
		provenance: z.array(
			z
				.object({
					attribute: z.string(),
					value: z.string(),
					evidenceClass: z.string(),
					evidenceSightedAt: z.iso.datetime({ offset: true }),
					modelVersion: z.string(),
				})
				.strict(),
		),
	})
	.strict();

export const productionRecommendationSummarySchema = z
	.object({
		pulseId: z.string().uuid(),
		pulseLabel: z.string(),
		periodStart: z.iso.date(),
		periodEnd: z.iso.date(),
		generation: z.string(),
		certifiedAt: z.iso.datetime({ offset: true }),
		markets: z.array(
			z
				.object({
					market: z.string(),
					recommendationCount: finiteNumber,
					totalPossible: finiteNumber.nullable(),
					recommendationShare: finiteNumber,
					averageIntentShare: finiteNumber,
					weightedScore: finiteNumber.nullable(),
					primaryCount: finiteNumber.nullable(),
					intentsRecommended: finiteNumber,
					topIntentCount: finiteNumber.nullable(),
					topIntentConcentration: finiteNumber,
					rank: finiteNumber,
				})
				.strict(),
		),
	})
	.strict();

export const productionBusinessSchema = z
	.object({
		productionPropertyId: z.string().uuid(),
		canonicalName: z.string().trim().min(1),
		propertySlug: z.string().trim().min(1).nullable(),
		destination: productionDestinationSchema,
		country: z
			.object({
				name: z.string().trim().min(1).nullable(),
				code: z.string().trim().length(2).nullable(),
			})
			.strict(),
		primaryDomain: z.string().trim().min(1).nullable(),
		brand: z.string().trim().min(1).nullable(),
		ownershipStatus: z.enum(["chained", "independent_confirmed", "unresolved"]),
		chain: identifiedName.nullable(),
		parentChain: identifiedName.nullable(),
		locality: productionLocalitySchema.nullable(),
		commercialKnowledge: productionCommercialKnowledgeSchema,
		recommendationSummary: productionRecommendationSummarySchema.nullable(),
		entityType: z.literal("HOTEL"),
		vertical: z.literal("HOTEL"),
		firstQualifiedAt: z.iso.datetime(),
		sourceUpdatedAt: z.iso.datetime(),
	})
	.strict();

export const productionBusinessPageSchema = z
	.object({
		ok: z.literal(true),
		contractVersion: z.literal("2"),
		snapshot: z.iso.datetime(),
		records: z.array(productionBusinessSchema),
		nextCursor: z.string().nullable(),
	})
	.strict();

export type ProductionBusiness = z.infer<typeof productionBusinessSchema>;
export type ProductionBusinessPage = z.infer<
	typeof productionBusinessPageSchema
>;
