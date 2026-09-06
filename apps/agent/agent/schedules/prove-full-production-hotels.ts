import { defineSchedule } from "eve/schedules";
import { queueFullUniverseDryRun } from "../lib/full-production-gate";

export default defineSchedule({
	cron: "*/5 * * * *",
	async run({ waitUntil }) {
		waitUntil(queueFullUniverseDryRun());
	},
});
