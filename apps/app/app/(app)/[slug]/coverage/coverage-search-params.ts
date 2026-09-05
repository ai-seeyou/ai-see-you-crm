import { EntityType } from "@crm/db/enums";
import {
	createLoader,
	parseAsBoolean,
	parseAsNativeArrayOf,
	parseAsString,
} from "nuqs/server";
import { assertUnreservedSearchParamKeys } from "@/lib/search-param-keys";

export const COVERAGE_PARAM = {
	vertical: "vertical",
	entityType: "entityType",
	includeCovered: "covered",
} as const;

assertUnreservedSearchParamKeys(
	Object.values(COVERAGE_PARAM),
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
};

export const loadCoverageSearchParams = createLoader(coverageParsers);

export type CoverageValues = {
	vertical: string[];
	entityType: string[];
	covered: boolean;
};

const ENTITY_TYPES = new Set<string>(Object.values(EntityType));

export function coverageInputFrom(values: CoverageValues) {
	return {
		vertical: values.vertical,
		entityType: values.entityType.filter((value): value is EntityType =>
			ENTITY_TYPES.has(value),
		),
		includeCovered: values.covered,
	};
}
