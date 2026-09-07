import { z } from "zod";

const digest = z.string().regex(/^[a-f0-9]{64}$/);
const commit = z.string().regex(/^[a-f0-9]{40}$/);
const categoryId = z.string().regex(/^RE-\d{4}$/);

export const productionCoreCategorySchema = z
	.object({
		categoryId,
		name: z.string().trim().min(1),
		evidenceTier: z.literal("Certified"),
		lifecycleStatus: z.literal("active"),
	})
	.strict();

export const productionCategoryDestinationSchema = z
	.object({
		destinationId: z.string().uuid(),
		pulseId: z.string().uuid(),
		runId: z.string().uuid(),
		periodStart: z.iso.date(),
		certifiedAt: z.iso.datetime({ offset: true }),
	})
	.strict();

export const productionCategorySnapshotSchema = z
	.object({
		ok: z.literal(true),
		contractVersion: z.literal("crm-category-v1"),
		snapshotId: digest,
		sourceCommit: commit,
		authorityDigest: digest,
		registryDigest: digest,
		destinationRunDigest: digest,
		membershipDigest: digest,
		categoryCount: z.number().int().nonnegative(),
		destinationCount: z.number().int().nonnegative(),
		propertyCount: z.number().int().nonnegative(),
		membershipCount: z.number().int().nonnegative(),
		registry: z.array(productionCoreCategorySchema),
		destinations: z.array(productionCategoryDestinationSchema),
	})
	.strict();

export const productionCategoryMembershipSchema = z
	.object({
		productionPropertyId: z.string().uuid(),
		categoryId,
		destinationId: z.string().uuid(),
		pulseId: z.string().uuid(),
		runId: z.string().uuid(),
	})
	.strict();

export const productionCategoryMembershipPageSchema = z
	.object({
		ok: z.literal(true),
		contractVersion: z.literal("crm-category-v1"),
		snapshotId: digest,
		records: z.array(productionCategoryMembershipSchema),
		nextCursor: z.string().min(1).nullable(),
	})
	.strict();

export type ProductionCategorySnapshot = z.infer<
	typeof productionCategorySnapshotSchema
>;
export type ProductionCategoryMembership = z.infer<
	typeof productionCategoryMembershipSchema
>;
export type ProductionCategoryMembershipPage = z.infer<
	typeof productionCategoryMembershipPageSchema
>;
