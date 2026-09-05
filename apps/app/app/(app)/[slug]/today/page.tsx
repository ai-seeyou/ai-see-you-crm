import type { Metadata } from "next";
import { Suspense } from "react";
import {
	PageShell,
	PageShellActions,
	PageShellContent,
	PageShellDescription,
	PageShellHeader,
	PageShellHeading,
	PageShellLoading,
	PageShellTitle,
} from "@/components/page-shell";
import { requireSession } from "@/lib/session";
import { HydrateClient } from "@/lib/trpc/hydrate";
import { getServerQueryClient, getServerTrpc } from "@/lib/trpc/server";
import {
	OverviewScopeToggle,
	OverviewScopeToggleFallback,
} from "../overview-scope";
import { loadOverviewSearchParams } from "../overview-search-params";
import { TodayView } from "./today-view";

export const metadata: Metadata = {
	title: "Today",
};

export default function TodayPage({
	searchParams,
}: PageProps<"/[slug]/today">) {
	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Today</PageShellTitle>
					<PageShellDescription>
						What is waiting on you right now.
					</PageShellDescription>
				</PageShellHeading>
				<PageShellActions>
					<Suspense fallback={<OverviewScopeToggleFallback />}>
						<OverviewScopeToggle />
					</Suspense>
				</PageShellActions>
			</PageShellHeader>

			<PageShellContent>
				<Suspense fallback={<PageShellLoading />}>
					<Today searchParams={searchParams} />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Today({
	searchParams,
}: Pick<PageProps<"/[slug]/today">, "searchParams">) {
	const [, { scope }] = await Promise.all([
		requireSession(),
		loadOverviewSearchParams(searchParams),
	]);

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();
	await Promise.all([
		queryClient.prefetchQuery(trpc.today.summary.queryOptions({ scope })),
		queryClient.prefetchQuery(
			trpc.domainReviews.list.queryOptions({
				status: ["PROPOSED"],
				limit: 100,
			}),
		),
	]);

	return (
		<HydrateClient>
			<TodayView />
		</HydrateClient>
	);
}
