import { defineSchedule } from "eve/schedules";
import { readSydneyProductionProof } from "../lib/sydney-production-proof";

export default defineSchedule({
	cron: "*/5 * * * *",
	async run({ waitUntil }) {
		waitUntil(
			readSydneyProductionProof().then((proof) => {
				console.info("[agent] Sydney Production proof", JSON.stringify(proof));
			}),
		);
	},
});
