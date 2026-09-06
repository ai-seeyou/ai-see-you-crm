import { defineSchedule } from "eve/schedules";
import {
	queueFullUniverseDryRun,
	readFullUniverseGateState,
	recoverStrandedFullUniverseDryRun,
} from "../lib/full-production-gate";

export default defineSchedule({
	cron: "*/5 * * * *",
	async run({ waitUntil }) {
		waitUntil(
			recoverStrandedFullUniverseDryRun().then(async (recovered) => {
				const taskId = await queueFullUniverseDryRun();
				const gate = await readFullUniverseGateState();
				console.info(
					"[agent] Full Production universe gate",
					JSON.stringify({ recovered, queued: taskId !== null, gate }),
				);
			}),
		);
	},
});
