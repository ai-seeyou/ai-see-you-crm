import { ContactRoleType } from "@crm/db/enums";
import { createListSearchParams } from "@/components/data-table/list-search-params";

export const contactsSearchParams = createListSearchParams({
	defaultSort: "createdAt",
	defaultDir: "desc",
	facetIds: [
		"owner",
		"company",
		"title",
		"seniority",
		"persona",
		"activity",
		"roleType",
		"countryCodes",
		"destinationIds",
		"hotelGroupIds",
	] as const,
	facetValues: { roleType: Object.values(ContactRoleType) },
});
