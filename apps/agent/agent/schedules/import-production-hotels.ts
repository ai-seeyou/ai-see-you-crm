import { defineSchedule } from "eve/schedules";
import { queueProductionRefreshAfterFullImport } from "../lib/full-production-gate";

export default defineSchedule({
	cron: "17 2 * * *",
	async run({ waitUntil }) {
		waitUntil(queueProductionRefreshAfterFullImport(false));
	},
});
