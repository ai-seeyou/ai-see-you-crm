import { createListSearchParams } from "@/components/data-table/list-search-params";

export const companiesSearchParams = createListSearchParams({
	defaultSort: "createdAt",
	defaultDir: "desc",
	facetIds: [
		"owner",
		"vertical",
		"entityType",
		"industry",
		"enrichment",
		"activity",
	] as const,
});
