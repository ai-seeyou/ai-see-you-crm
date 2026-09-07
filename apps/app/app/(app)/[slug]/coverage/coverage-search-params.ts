import { ContactRoleType, EntityType } from "@crm/db/enums";
import {
	createLoader,
	parseAsBoolean,
	parseAsInteger,
	parseAsNativeArrayOf,
	parseAsString,
	parseAsStringLiteral,
} from "nuqs/server";
import {
	assertUnreservedSearchParamKeys,
	SEARCH_PARAM,
} from "@/lib/search-param-keys";

export const COVERAGE_PARAM = {
	vertical: "vertical",
	entityType: "entityType",
	includeCovered: "covered",
	countryCodes: "countryCodes",
	destinationIds: "destinationIds",
	hotelGroupIds: "hotelGroupIds",
	missingRoleTypes: "missingRoleTypes",
	page: SEARCH_PARAM.list.page,
	scope: "coverageScope",
} as const;

assertUnreservedSearchParamKeys(
	Object.values(COVERAGE_PARAM).filter(
		(value) => value !== SEARCH_PARAM.list.page,
	),
	"coverageSearchParams",
);

export const coverageParsers = {
	[COVERAGE_PARAM.vertical]: parseAsNativeArrayOf(parseAsString).withDefault(
		[],
	),
	[COVERAGE_PARAM.entityType]: parseAsNativeArrayOf(parseAsString).withDefault(
		[],
	),
	[COVERAGE_PARAM.includeCovered]: parseAsBoolean.withDefault(false),
	[COVERAGE_PARAM.countryCodes]: parseAsNativeArrayOf(
		parseAsString,
	).withDefault([]),
	[COVERAGE_PARAM.destinationIds]: parseAsNativeArrayOf(
		parseAsString,
	).withDefault([]),
	[COVERAGE_PARAM.hotelGroupIds]: parseAsNativeArrayOf(
		parseAsString,
	).withDefault([]),
	[COVERAGE_PARAM.missingRoleTypes]: parseAsNativeArrayOf(
		parseAsString,
	).withDefault([]),
	[COVERAGE_PARAM.page]: parseAsInteger.withDefault(1),
	[COVERAGE_PARAM.scope]: parseAsStringLiteral([
		"all",
		"targets",
	] as const).withDefault("all"),
};

export const loadCoverageSearchParams = createLoader(coverageParsers);

export type CoverageValues = {
	vertical: string[];
	entityType: string[];
	covered: boolean;
	countryCodes: string[];
	destinationIds: string[];
	hotelGroupIds: string[];
	missingRoleTypes: string[];
	page: number;
	scope: "all" | "targets";
};

const ENTITY_TYPES = new Set<string>(Object.values(EntityType));

export function coverageInputFrom(values: CoverageValues) {
	return {
		vertical: values.vertical,
		entityType: values.entityType.filter((value): value is EntityType =>
			ENTITY_TYPES.has(value),
		),
		includeCovered: values.covered,
		countryCodes: values.countryCodes,
		destinationIds: values.destinationIds,
		hotelGroupIds: values.hotelGroupIds,
		missingRoleTypes: values.missingRoleTypes.filter((value) =>
			Object.values(ContactRoleType).includes(value as ContactRoleType),
		) as ContactRoleType[],
		page: Math.max(1, values.page),
		pageSize: 25,
		scope:
			values.scope === "targets"
				? ("TARGET_BUSINESSES" as const)
				: ("ALL_HOTELS" as const),
	};
}
