import { defineSchedule } from "eve/schedules";
import {
	readSydneyCommittedProof,
	readSydneyProductionProof,
} from "../lib/sydney-production-proof";

export default defineSchedule({
	cron: "*/5 * * * *",
	async run({ waitUntil }) {
		waitUntil(
			Promise.all([
				readSydneyProductionProof(),
				readSydneyCommittedProof(),
			]).then(([dryRun, committed]) => {
				console.info(
					"[agent] Sydney Production proof",
					JSON.stringify({ dryRun, committed }),
				);
			}),
		);
	},
});
