import { describe, expect, it } from "bun:test";
import { DataTableFacetFilter } from "@crm/ui/components/data-table";
import { parseSavedViewFilters } from "@crm/validation/saved-view";
import { renderToStaticMarkup } from "react-dom/server";
import { companiesSearchParams } from "@/app/(app)/[slug]/companies/companies-search-params";
import { COMPANY_COLUMNS } from "@/app/(app)/[slug]/companies/companies-table";
import { contactsSearchParams } from "@/app/(app)/[slug]/contacts/contacts-search-params";
import {
	COVERAGE_PARAM,
	coverageInputFrom,
	loadCoverageSearchParams,
} from "@/app/(app)/[slug]/coverage/coverage-search-params";
import { savedViewUpdate } from "@/components/data-table/use-table-query";

const dimensions = {
	countryCodes: ["AU", "GB"],
	destinationIds: ["destination-sydney"],
	hotelGroupIds: ["group-accor"],
	categoryIds: ["RE-0001", "RE-0002"],
};

describe("commercial navigation search state", () => {
	it("passes company dimensions from the URL to the list query", async () => {
		const values = await companiesSearchParams.load(dimensions);
		const input = companiesSearchParams.toInput(values);

		expect(input.countryCodes).toEqual(dimensions.countryCodes);
		expect(input.destinationIds).toEqual(dimensions.destinationIds);
		expect(input.hotelGroupIds).toEqual(dimensions.hotelGroupIds);
		expect(input.categoryIds).toEqual(dimensions.categoryIds);
	});

	it("passes contact dimensions from the URL to the list query", async () => {
		const values = await contactsSearchParams.load(dimensions);
		const input = contactsSearchParams.toInput(values);

		expect(input.countryCodes).toEqual(dimensions.countryCodes);
		expect(input.destinationIds).toEqual(dimensions.destinationIds);
		expect(input.hotelGroupIds).toEqual(dimensions.hotelGroupIds);
		expect(input.categoryIds).toEqual(dimensions.categoryIds);
	});

	it("applies saved dimensions and sorting to URL state", () => {
		const parsed = parseSavedViewFilters({
			q: "hotel",
			sort: "destination",
			dir: "asc",
			archived: false,
			filters: dimensions,
		});
		const restored = savedViewUpdate(
			parsed,
			companiesSearchParams.config.facetIds ?? [],
		);

		expect(restored.countryCodes).toEqual(["AU", "GB"]);
		expect(restored.destinationIds).toEqual(["destination-sydney"]);
		expect(restored.hotelGroupIds).toEqual(["group-accor"]);
		expect(restored.categoryIds).toEqual(["RE-0001", "RE-0002"]);
		expect(restored.sort).toBe("destination");
		expect(restored.dir).toBe("asc");
	});

	it("keeps commercial business columns visible by default", () => {
		const columns = new Map(
			COMPANY_COLUMNS.map((column) => [column.id, column]),
		);

		for (const id of [
			"name",
			"country",
			"destination",
			"hotelGroup",
			"categories",
		]) {
			expect(columns.get(id)?.defaultHidden).not.toBe(true);
		}
	});

	it("renders the category multi-select as a named control", () => {
		const markup = renderToStaticMarkup(
			<DataTableFacetFilter
				facet={{
					id: "categoryIds",
					label: "Category",
					searchable: true,
					options: [
						{ value: "RE-0001", label: "Luxury" },
						{ value: "RE-0002", label: "Family" },
					],
				}}
				selected={["RE-0001", "RE-0002"]}
				onChange={() => undefined}
			/>,
		);

		expect(markup).toContain("Category (2)");
	});

	it("loads the complete coverage scope from the URL", async () => {
		const values = await loadCoverageSearchParams({
			...dimensions,
			[COVERAGE_PARAM.missingRoleTypes]: ["GENERAL_MANAGER"],
			[COVERAGE_PARAM.page]: "3",
			[COVERAGE_PARAM.scope]: "targets",
		});
		const input = coverageInputFrom({
			vertical: values[COVERAGE_PARAM.vertical],
			entityType: values[COVERAGE_PARAM.entityType],
			covered: values[COVERAGE_PARAM.includeCovered],
			countryCodes: values[COVERAGE_PARAM.countryCodes],
			destinationIds: values[COVERAGE_PARAM.destinationIds],
			hotelGroupIds: values[COVERAGE_PARAM.hotelGroupIds],
			categoryIds: values[COVERAGE_PARAM.categoryIds],
			missingRoleTypes: values[COVERAGE_PARAM.missingRoleTypes],
			page: values[COVERAGE_PARAM.page],
			scope: values[COVERAGE_PARAM.scope],
		});

		expect(input).toMatchObject({
			...dimensions,
			missingRoleTypes: ["GENERAL_MANAGER"],
			page: 3,
			pageSize: 25,
			scope: "TARGET_BUSINESSES",
		});
	});
});
