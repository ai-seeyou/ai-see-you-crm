const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;

export const PRODUCTION_CATEGORY = {
	stateId: "core",
	pageLimit: 500,
	writeBatchSize: 1000,
	maximumPages: 250,
	approvedCategoryCount: 9,
	maximumDestinations: 500,
	maximumProperties: 20_000,
	maximumMemberships: 100_000,
	fetchDeadlineMs: 2 * MINUTE_MS,
	transaction: { maxWait: 10 * SECOND_MS, timeout: 2 * MINUTE_MS },
} as const;
