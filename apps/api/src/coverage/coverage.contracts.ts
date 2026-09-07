import { EntityType } from "@crm/db";
import { z } from "zod";
import { contactRoleType } from "../assignments/assignments.contracts";
import {
	canonicalIdsFilter,
	countryCodesFilter,
} from "../companies/companies.contracts";

const coverageEntityType = z.enum(
	Object.values(EntityType) as [EntityType, ...EntityType[]],
);

export const coverageInput = z.object({
	scope: z.enum(["ALL_HOTELS", "TARGET_BUSINESSES"]).default("ALL_HOTELS"),
	page: z.number().int().min(1).default(1),
	pageSize: z.number().int().min(1).max(100).default(25),
	vertical: z.array(z.string()).default([]),
	entityType: z.array(coverageEntityType).default([]),
	countryCodes: countryCodesFilter.default([]),
	destinationIds: canonicalIdsFilter.default([]),
	hotelGroupIds: canonicalIdsFilter.default([]),
	missingRoleTypes: z.array(contactRoleType).max(10).default([]),
	includeCovered: z.boolean().default(false),
});

type ParsedCoverageInput = z.infer<typeof coverageInput>;
type NewCoverageKeys =
	| "scope"
	| "page"
	| "pageSize"
	| "countryCodes"
	| "destinationIds"
	| "hotelGroupIds"
	| "missingRoleTypes";
export type CoverageInput = Omit<ParsedCoverageInput, NewCoverageKeys> &
	Partial<Pick<ParsedCoverageInput, NewCoverageKeys>>;

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
	examined: z.number(),
	page: z.number(),
	pageSize: z.number(),
	total: z.number(),
	summary: z.object({
		targets: z.number(),
		covered: z.number(),
		gaps: z.number(),
	}),
	rows: z.array(coverageRowOutput),
	groupGaps: z.array(
		z.object({
			groupId: z.string(),
			groupName: z.string(),
			hotelCount: z.number(),
			gapCount: z.number(),
			missingByRole: z.record(z.string(), z.number()),
		}),
	),
});
