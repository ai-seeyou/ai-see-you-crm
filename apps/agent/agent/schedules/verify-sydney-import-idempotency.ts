import { defineSchedule } from "eve/schedules";
import { queueSydneyIdempotencyProof } from "../lib/production-refresh";

export default defineSchedule({
	cron: "*/5 * * * *",
	async run({ waitUntil }) {
		waitUntil(queueSydneyIdempotencyProof());
	},
});
