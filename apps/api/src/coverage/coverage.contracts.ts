import { EntityType } from "@crm/db";
import { z } from "zod";
import { contactRoleType } from "../assignments/assignments.contracts";

const coverageEntityType = z.enum(
	Object.values(EntityType) as [EntityType, ...EntityType[]],
);

export const coverageInput = z.object({
	vertical: z.array(z.string()).default([]),
	entityType: z.array(coverageEntityType).default([]),
	includeCovered: z.boolean().default(false),
});

export type CoverageInput = z.infer<typeof coverageInput>;

const coverageHolderOutput = z.object({
	id: z.string(),
	name: z.string(),
	email: z.string().nullable(),
	scope: z.enum(["EMPLOYER", "RESPONSIBLE_FOR"]),
});

const coverageRoleOutput = z.object({
	roleType: contactRoleType,
	filled: z.boolean(),
	holders: z.array(coverageHolderOutput),
});

const coverageVerticalOutput = z.object({
	id: z.string(),
	key: z.string(),
	label: z.string(),
});

const coverageRowOutput = z.object({
	id: z.string(),
	name: z.string(),
	domain: z.string().nullable(),
	entityType: coverageEntityType,
	vertical: coverageVerticalOutput.nullable(),
	iconUrl: z.string().nullable(),
	iconDarkUrl: z.string().nullable(),
	iconTone: z.string().nullable(),
	roles: z.array(coverageRoleOutput),
	missing: z.array(contactRoleType),
	covered: z.boolean(),
});

export const coverageOutput = z.object({
	configured: z.boolean(),
	targetFieldKey: z.string(),
	targetLabels: z.array(z.string()),
	truncated: z.boolean(),
	summary: z.object({
		targets: z.number(),
		covered: z.number(),
		gaps: z.number(),
	}),
	rows: z.array(coverageRowOutput),
});
