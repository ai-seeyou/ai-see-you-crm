const HOUR_MS = 60 * 60 * 1000;

export const PRODUCTION_IMPORT = {
	pageLimit: 500,
	leaseMs: 6 * HOUR_MS,
	reconciliationMinimumRatio: 0.8,
	snapshotTtlMs: 24 * HOUR_MS,
	stateId: "qualifying-hotels",
} as const;
