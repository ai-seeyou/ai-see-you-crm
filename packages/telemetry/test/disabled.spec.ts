import { describe, expect, it } from "bun:test";
import {
	DISABLE_VARIABLES,
	HARD_DISABLED,
	telemetryDisabled,
	telemetryDisabledByEnvironment,
} from "../src/disabled";
import { POSTHOG_HOST, POSTHOG_KEY, POSTHOG_UI_HOST } from "../src/project";

describe("telemetryDisabled", () => {
	it("is off permanently, whatever the environment says", () => {
		expect(HARD_DISABLED).toBe(true);

		for (const env of [
			{},
			{ NODE_ENV: "production" },
			{ NODE_ENV: "development" },
			{ CRM_TELEMETRY_DISABLED: "0" },
			{ CRM_TELEMETRY_DISABLED: "false" },
			{ DO_NOT_TRACK: "no" },
			{ NODE_ENV: "production", CRM_TELEMETRY_DISABLED: "", DO_NOT_TRACK: "" },
		]) {
			expect(telemetryDisabled(env)).toBe(true);
		}
	});

	it("cannot be turned back on by unsetting a variable", () => {
		expect(telemetryDisabled({ CRM_TELEMETRY_DISABLED: undefined })).toBe(true);
		expect(telemetryDisabled({ DO_NOT_TRACK: undefined })).toBe(true);
	});
});

describe("the upstream destination", () => {
	it("has no credential and no host, so there is nowhere to send", () => {
		expect(POSTHOG_KEY).toBe("");
		expect(POSTHOG_HOST).toBe("");
		expect(POSTHOG_UI_HOST).toBe("");
	});

	it("names no Comp AI endpoint anywhere in the project constants", () => {
		const joined = [POSTHOG_KEY, POSTHOG_HOST, POSTHOG_UI_HOST].join(" ");

		expect(joined).not.toContain("trycomp");
		expect(joined).not.toContain("posthog");
	});
});

describe("telemetryDisabledByEnvironment", () => {
	it("still describes what CRM_TELEMETRY_DISABLED=1 means, for the docs", () => {
		expect(
			telemetryDisabledByEnvironment({ CRM_TELEMETRY_DISABLED: "1" }),
		).toBe(true);
		expect(telemetryDisabledByEnvironment({ DO_NOT_TRACK: "1" })).toBe(true);
		expect(telemetryDisabledByEnvironment({ NODE_ENV: "test" })).toBe(true);
		expect(telemetryDisabledByEnvironment({})).toBe(false);
	});

	it("names both variables so the docs and the code cannot drift", () => {
		expect(DISABLE_VARIABLES).toEqual([
			"CRM_TELEMETRY_DISABLED",
			"DO_NOT_TRACK",
		]);
	});
});
