import { db } from "@crm/db";
import { syncProductionCategories } from "../agent/lib/production-category-sync";
import { ProductionReadClient } from "../agent/lib/production-client";

const endpoint = process.env.PRODUCTION_READ_URL;
const token = process.env.PRODUCTION_READ_TOKEN;
if (!endpoint || !token)
	throw new Error("Production read capability is not configured");

const argumentsList = process.argv.slice(2);
const dryRun = argumentsList.length === 1 && argumentsList[0] === "--dry-run";
const commit =
	argumentsList.length === 1 && argumentsList[0]?.startsWith("--commit=")
		? argumentsList[0]
		: undefined;
if (!dryRun && !commit)
	throw new Error("Choose --dry-run or --commit=<approved snapshot ID>");

try {
	const result = await syncProductionCategories(
		new ProductionReadClient(endpoint, token),
		commit
			? { expectedSnapshotId: commit.slice("--commit=".length) }
			: { dryRun: true },
	);
	if (!result)
		throw new Error("Production Category synchronization was skipped");
	console.log(
		JSON.stringify({
			snapshotId: result.snapshotId,
			categoryCount: result.categories,
			propertyCount: result.properties,
			membershipCount: result.memberships,
			linkedPropertyCount: result.linkedProperties,
			unresolvedPropertyCount: result.unresolvedProperties,
			authorityDigest: result.authorityDigest,
			registryDigest: result.registryDigest,
			destinationRunDigest: result.destinationRunDigest,
			membershipDigest: result.membershipDigest,
			activated: result.activated,
			readRequests: result.readRequests,
		}),
	);
} finally {
	await db.$disconnect();
}
