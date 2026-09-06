import { defineSchedule } from "eve/schedules";
import { holdProductionUniverseRefresh } from "../lib/production-refresh";

export default defineSchedule({
	cron: "17 2 * * *",
	async run({ waitUntil }) {
		waitUntil(holdProductionUniverseRefresh());
	},
});
