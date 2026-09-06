import { defineSchedule } from "eve/schedules";
import {
	readSydneyCommittedProof,
	readSydneyIdempotencyProof,
	readSydneyProductionProof,
} from "../lib/sydney-production-proof";

export default defineSchedule({
	cron: "*/5 * * * *",
	async run({ waitUntil }) {
		waitUntil(
			Promise.all([
				readSydneyProductionProof(),
				readSydneyCommittedProof(),
				readSydneyIdempotencyProof(),
			]).then(([dryRun, committed, idempotency]) => {
				console.info(
					"[agent] Sydney Production proof",
					JSON.stringify({ dryRun, committed, idempotency }),
				);
			}),
		);
	},
});
