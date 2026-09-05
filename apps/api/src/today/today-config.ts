const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export const TODAY = {
	overdueTasks: {
		limit: 25,
	},

	followUps: {
		dueWithinMs: 7 * DAY_MS,
		limit: 25,
	},

	replies: {
		sinceMs: 3 * DAY_MS,
		limit: 25,
	},

	opportunities: {
		staleAfterMs: 21 * DAY_MS,
		limit: 25,
	},

	dayMs: DAY_MS,
} as const;
