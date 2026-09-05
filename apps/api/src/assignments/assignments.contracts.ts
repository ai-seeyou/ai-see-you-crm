import { AssignmentScope, ContactRoleType, EntityType } from "@crm/db";
import { z } from "zod";
import { MAX_BULK_IDS } from "../crm/bulk";

export const contactRoleType = z.enum(
	Object.values(ContactRoleType) as [ContactRoleType, ...ContactRoleType[]],
);

export const assignmentScope = z.enum(
	Object.values(AssignmentScope) as [AssignmentScope, ...AssignmentScope[]],
);

const assignmentEntityType = z.enum(
	Object.values(EntityType) as [EntityType, ...EntityType[]],
);

const assignmentContactOutput = z.object({
	id: z.string(),
	firstName: z.string(),
	lastName: z.string().nullable(),
	email: z.string().nullable(),
	title: z.string().nullable(),
	imageUrl: z.string().nullable(),
	employerId: z.string().nullable(),
	employerName: z.string().nullable(),
});

const assignmentCompanyOutput = z.object({
	id: z.string(),
	name: z.string(),
	domain: z.string().nullable(),
	entityType: assignmentEntityType,
	iconUrl: z.string().nullable(),
	iconDarkUrl: z.string().nullable(),
	iconTone: z.string().nullable(),
});

const assignmentBase = {
	id: z.string(),
	scope: assignmentScope,
	roleType: contactRoleType,
	title: z.string().nullable(),
	isPrimary: z.boolean(),
	validFrom: z.string().nullable(),
	validTo: z.string().nullable(),
};

export const companyAssignmentOutput = z.object({
	...assignmentBase,
	contact: assignmentContactOutput,
});

export const contactAssignmentOutput = z.object({
	...assignmentBase,
	company: assignmentCompanyOutput,
});

export const assignmentsForCompanyInput = z.object({
	companyId: z.string(),
	scope: z.array(assignmentScope).default([AssignmentScope.RESPONSIBLE_FOR]),
	includeEnded: z.boolean().default(false),
});

export type AssignmentsForCompanyInput = z.infer<
	typeof assignmentsForCompanyInput
>;

export const assignmentsForCompanyOutput = z.object({
	companyId: z.string(),
	rows: z.array(companyAssignmentOutput),
});

export const assignmentsForContactInput = z.object({
	contactId: z.string(),
	scope: z.array(assignmentScope).default([AssignmentScope.RESPONSIBLE_FOR]),
	includeEnded: z.boolean().default(false),
});

export type AssignmentsForContactInput = z.infer<
	typeof assignmentsForContactInput
>;

export const assignmentsForContactOutput = z.object({
	contactId: z.string(),
	rows: z.array(contactAssignmentOutput),
});

export const assignInput = z.object({
	contactId: z.string(),
	companyId: z.string(),
	roleType: contactRoleType,
	title: z.string().optional(),
	validFrom: z.iso.datetime().optional(),
});

export type AssignInput = z.infer<typeof assignInput>;

export const assignManyInput = z.object({
	contactId: z.string(),
	companyIds: z
		.array(z.string())
		.min(1, "Pick at least one business.")
		.max(MAX_BULK_IDS, "Too many businesses at once, do a page at a time."),
	roleType: contactRoleType,
	title: z.string().optional(),
	validFrom: z.iso.datetime().optional(),
});

export type AssignManyInput = z.infer<typeof assignManyInput>;

export const endAssignmentInput = z.object({
	contactId: z.string(),
	companyId: z.string(),
	at: z.iso.datetime().optional(),
});

export type EndAssignmentInput = z.infer<typeof endAssignmentInput>;

export const assignOutput = z.object({
	id: z.string(),
	contactId: z.string(),
	companyId: z.string(),
	roleType: contactRoleType,
});

export const assignManyOutput = z.object({
	contactId: z.string(),
	ids: z.array(z.string()),
	requested: z.number(),
	succeeded: z.number(),
});

export const endAssignmentOutput = z.object({
	contactId: z.string(),
	companyId: z.string(),
	ended: z.boolean(),
});
