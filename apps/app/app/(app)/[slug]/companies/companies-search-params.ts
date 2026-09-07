import { EntityType } from "@crm/db/enums";
import { createListSearchParams } from "@/components/data-table/list-search-params";

export const companiesSearchParams = createListSearchParams({
	defaultSort: "name",
	defaultDir: "asc",
	facetIds: [
		"owner",
		"vertical",
		"entityType",
		"industry",
		"enrichment",
		"activity",
		"countryCodes",
		"destinationIds",
		"hotelGroupIds",
		"categoryIds",
	] as const,
	facetValues: { entityType: Object.values(EntityType) },
});
