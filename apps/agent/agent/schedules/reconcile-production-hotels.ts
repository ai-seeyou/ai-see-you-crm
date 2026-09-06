import { defineSchedule } from "eve/schedules";
import { holdProductionUniverseRefresh } from "../lib/production-refresh";

export default defineSchedule({
	cron: "47 3 * * 0",
	async run({ waitUntil }) {
		waitUntil(holdProductionUniverseRefresh());
	},
});
