import { defineSchedule } from "eve/schedules";
import { queueSydneyProductionCommit } from "../lib/production-refresh";

export default defineSchedule({
	cron: "*/5 * * * *",
	async run({ waitUntil }) {
		waitUntil(queueSydneyProductionCommit());
	},
});
