import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
	captureNow,
	onTelemetryProblem,
	resetTelemetryClient,
} from "../src/client";

/**
 * Upstream shipped an integration spec asserting that events reach Comp AI's
 * PostHog project. It has been replaced by this one, which asserts the
 * opposite and needs no database: nothing leaves this install, under any
 * environment, ever.
 */

const realFetch = globalThis.fetch;

const realEnv = {
	nodeEnv: process.env.NODE_ENV,
	disabled: process.env.CRM_TELEMETRY_DISABLED,
	doNotTrack: process.env.DO_NOT_TRACK,
};

let calls: string[] = [];

beforeEach(() => {
	calls = [];
	globalThis.fetch = (async (input: RequestInfo | URL) => {
		calls.push(String(input));
		return new Response("{}", { status: 200 });
	}) as typeof fetch;

	onTelemetryProblem(null);
	resetTelemetryClient();
});

afterEach(() => {
	globalThis.fetch = realFetch;
	restore("NODE_ENV", realEnv.nodeEnv);
	restore("CRM_TELEMETRY_DISABLED", realEnv.disabled);
	restore("DO_NOT_TRACK", realEnv.doNotTrack);
	resetTelemetryClient();
});

function restore(name: string, value: string | undefined): void {
	if (value === undefined) delete process.env[name];
	else process.env[name] = value;
}

describe("captureNow", () => {
	it("makes no network call and reports nothing sent, by default", async () => {
		expect(await captureNow("install_daily", { crm_version: "1.0.0" })).toBe(
			false,
		);
		expect(calls).toEqual([]);
	});

	it("makes no network call even with every disable variable cleared", async () => {
		process.env.NODE_ENV = "production";
		delete process.env.CRM_TELEMETRY_DISABLED;
		delete process.env.DO_NOT_TRACK;
		resetTelemetryClient();

		expect(await captureNow("install_daily", { crm_version: "1.0.0" })).toBe(
			false,
		);
		expect(calls).toEqual([]);
	});

	it("makes no network call when the variables are explicitly set to off", async () => {
		process.env.NODE_ENV = "production";
		process.env.CRM_TELEMETRY_DISABLED = "0";
		process.env.DO_NOT_TRACK = "false";
		resetTelemetryClient();

		expect(await captureNow("agent_error", {})).toBe(false);
		expect(calls).toEqual([]);
	});
});
