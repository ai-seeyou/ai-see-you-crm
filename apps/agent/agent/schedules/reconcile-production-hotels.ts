import { defineSchedule } from "eve/schedules";
import { queueProductionRefreshAfterFullImport } from "../lib/full-production-gate";

export default defineSchedule({
	cron: "47 3 * * 0",
	async run({ waitUntil }) {
		waitUntil(queueProductionRefreshAfterFullImport(true));
	},
});
