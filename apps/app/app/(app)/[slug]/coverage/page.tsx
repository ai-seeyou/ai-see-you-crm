import type { Metadata } from "next";
import { Suspense } from "react";
import {
	PageShell,
	PageShellContent,
	PageShellDescription,
	PageShellHeader,
	PageShellHeading,
	PageShellLoading,
	PageShellTitle,
} from "@/components/page-shell";
import { BUSINESS } from "@/lib/labels";
import { requireSession } from "@/lib/session";
import { HydrateClient } from "@/lib/trpc/hydrate";
import { getServerQueryClient, getServerTrpc } from "@/lib/trpc/server";
import {
	COVERAGE_PARAM,
	coverageInputFrom,
	loadCoverageSearchParams,
} from "./coverage-search-params";
import { CoverageView } from "./coverage-view";

export const metadata: Metadata = {
	title: "Coverage",
};

export default function CoveragePage({
	searchParams,
}: PageProps<"/[slug]/coverage">) {
	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Coverage</PageShellTitle>
					<PageShellDescription>
						{`${BUSINESS.many} missing the people we need.`}
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>

			<PageShellContent>
				<Suspense fallback={<PageShellLoading />}>
					<Coverage searchParams={searchParams} />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Coverage({
	searchParams,
}: Pick<PageProps<"/[slug]/coverage">, "searchParams">) {
	const [, values] = await Promise.all([
		requireSession(),
		loadCoverageSearchParams(searchParams),
	]);

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();
	await Promise.all([
		queryClient.prefetchQuery(
			trpc.coverage.gaps.queryOptions(
				coverageInputFrom({
					vertical: values[COVERAGE_PARAM.vertical],
					entityType: values[COVERAGE_PARAM.entityType],
					covered: values[COVERAGE_PARAM.includeCovered],
					countryCodes: values[COVERAGE_PARAM.countryCodes],
					destinationIds: values[COVERAGE_PARAM.destinationIds],
					hotelGroupIds: values[COVERAGE_PARAM.hotelGroupIds],
					missingRoleTypes: values[COVERAGE_PARAM.missingRoleTypes],
					page: values[COVERAGE_PARAM.page],
					scope: values[COVERAGE_PARAM.scope],
				}),
			),
		),
		queryClient.prefetchQuery(
			trpc.verticals.list.queryOptions({ includeArchived: false }),
		),
		queryClient.prefetchQuery(trpc.companies.navigation.queryOptions({})),
	]);

	return (
		<HydrateClient>
			<CoverageView />
		</HydrateClient>
	);
}
