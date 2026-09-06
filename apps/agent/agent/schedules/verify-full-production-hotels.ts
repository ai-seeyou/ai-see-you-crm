import { defineSchedule } from "eve/schedules";
import { readFullUniverseProof } from "../lib/full-production-gate";

export default defineSchedule({
	cron: "*/5 * * * *",
	async run({ waitUntil }) {
		waitUntil(
			Promise.all([
				readFullUniverseProof(true),
				readFullUniverseProof(false),
			]).then(([dryRun, committed]) => {
				console.info(
					"[agent] Full Production universe proof",
					JSON.stringify({ dryRun, committed }),
				);
			}),
		);
	},
});
