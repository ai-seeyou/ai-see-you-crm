import { db } from "@crm/db";
import {
	approveSydneyProductionProving,
	queueProductionRefreshTask,
} from "../agent/lib/production-refresh";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const approveCommit = args.has("--approve-commit");
if (dryRun === approveCommit || args.size !== 1) {
	throw new Error("Choose exactly one of --dry-run or --approve-commit");
}

const id = dryRun
	? await queueProductionRefreshTask({
			fullReconciliation: false,
			destination: "sydney",
			expectedCount: 228,
			dryRun: true,
		})
	: await approveSydneyProductionProving();
console.log(id);
await db.$disconnect();
