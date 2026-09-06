import { defineSchedule } from "eve/schedules";
import {
	queueFullUniverseDryRun,
	readFullUniverseGateState,
} from "../lib/full-production-gate";

export default defineSchedule({
	cron: "*/5 * * * *",
	async run({ waitUntil }) {
		waitUntil(
			queueFullUniverseDryRun().then(async (taskId) => {
				const gate = await readFullUniverseGateState();
				console.info(
					"[agent] Full Production universe gate",
					JSON.stringify({ queued: taskId !== null, gate }),
				);
			}),
		);
	},
});
