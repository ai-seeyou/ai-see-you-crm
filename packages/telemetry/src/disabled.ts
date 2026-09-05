/**
 * Telemetry is permanently off in the AI See You CRM.
 *
 * Upstream (trycompai/crm) reports anonymous usage counts to Comp AI's PostHog
 * project once a day. That is upstream's business, not ours: our contact
 * volumes, agent tool usage and operating tempo are commercial information.
 *
 * `HARD_DISABLED` is the guarantee. It does not read the environment, so no
 * missing variable, no misconfigured deployment and no future edit to a `.env`
 * can turn reporting back on. `CRM_TELEMETRY_DISABLED=1` is still set in every
 * environment we control (see `.env.example`) as a second, independent layer,
 * and the upstream PostHog credentials have been blanked in `project.ts` so
 * there is no destination to send to either.
 *
 * See docs/telemetry.md.
 */
export const HARD_DISABLED = true;

const TRUTHY = new Set(["1", "true", "yes", "on"]);

export const DISABLE_VARIABLES = ["CRM_TELEMETRY_DISABLED", "DO_NOT_TRACK"];

export function telemetryDisabled(
	env: Record<string, string | undefined> = process.env,
): boolean {
	if (HARD_DISABLED) return true;

	if (env.NODE_ENV === "test") return true;

	return DISABLE_VARIABLES.some((name) => isTruthy(env[name]));
}

/**
 * The environment reading upstream relied on, kept so `.env.example`, the docs
 * and the code cannot drift, and so a reviewer can see exactly what
 * `HARD_DISABLED` is overriding. Nothing in the application calls this.
 */
export function telemetryDisabledByEnvironment(
	env: Record<string, string | undefined> = process.env,
): boolean {
	if (env.NODE_ENV === "test") return true;

	return DISABLE_VARIABLES.some((name) => isTruthy(env[name]));
}

function isTruthy(value: string | undefined): boolean {
	return TRUTHY.has((value ?? "").trim().toLowerCase());
}
