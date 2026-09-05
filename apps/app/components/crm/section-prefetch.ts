"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { companiesSearchParams } from "@/app/(app)/[slug]/companies/companies-search-params";
import { contactsSearchParams } from "@/app/(app)/[slug]/contacts/contacts-search-params";
import { coverageInputFrom } from "@/app/(app)/[slug]/coverage/coverage-search-params";
import { dealsSearchParams } from "@/app/(app)/[slug]/deals/deals-search-params";
import { useTRPC } from "@/lib/trpc/client";

export type Section =
	| "/"
	| "/today"
	| "/companies"
	| "/contacts"
	| "/deals"
	| "/coverage"
	| "/settings";

export function usePrefetchSection(): (section: string) => void {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	return useCallback(
		(section: string) => {
			switch (section) {
				case "/":
					void queryClient.prefetchQuery(
						trpc.dashboard.summary.queryOptions({ scope: "me" }),
					);
					return;
				case "/today":
					void queryClient.prefetchQuery(
						trpc.today.summary.queryOptions({ scope: "me" }),
					);
					void queryClient.prefetchQuery(
						trpc.domainReviews.list.queryOptions({
							status: ["PROPOSED"],
							limit: 100,
						}),
					);
					return;
				case "/coverage":
					void queryClient.prefetchQuery(
						trpc.coverage.gaps.queryOptions(
							coverageInputFrom({
								vertical: [],
								entityType: [],
								covered: false,
							}),
						),
					);
					return;
				case "/companies":
					void queryClient.prefetchQuery(
						trpc.companies.list.queryOptions(
							companiesSearchParams.defaultInput(),
						),
					);
					return;
				case "/contacts":
					void queryClient.prefetchQuery(
						trpc.contacts.list.queryOptions(
							contactsSearchParams.defaultInput(),
						),
					);
					return;
				case "/deals":
					void queryClient.prefetchQuery(
						trpc.deals.list.queryOptions(dealsSearchParams.defaultInput()),
					);
					return;
				default:
					return;
			}
		},
		[trpc, queryClient],
	);
}
