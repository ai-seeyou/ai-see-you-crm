import { describe, expect, it } from "bun:test";
import {
	MICROSOFT_SYNC_SCOPES,
	mailboxGrantsNeeded,
	SYNC_SCOPES,
	signsInWithGoogle,
	signsInWithMicrosoft,
} from "../src/scopes";

const GRANTED = SYNC_SCOPES.join(",");
const GRANTED_MICROSOFT = MICROSOFT_SYNC_SCOPES.join(",");

describe("which mailbox providers are still outstanding", () => {
	it("names Google when neither scope was granted", () => {
		expect(
			mailboxGrantsNeeded([{ providerId: "google", scope: "openid,email" }]),
		).toEqual(["google"]);
	});

	it("names Google when granular consent dropped one of them", () => {
		expect(
			mailboxGrantsNeeded([
				{ providerId: "google", scope: `openid,${SYNC_SCOPES[0]}` },
			]),
		).toEqual(["google"]);
	});

	it("names nothing once both Google scopes are there", () => {
		expect(
			mailboxGrantsNeeded([{ providerId: "google", scope: GRANTED }]),
		).toEqual([]);
	});

	it("names Microsoft when Mail.Read was not granted", () => {
		expect(
			mailboxGrantsNeeded([
				{ providerId: "microsoft", scope: "openid profile email User.Read" },
			]),
		).toEqual(["microsoft"]);
	});

	it("names nothing once Mail.Read is there", () => {
		expect(
			mailboxGrantsNeeded([
				{ providerId: "microsoft", scope: GRANTED_MICROSOFT },
			]),
		).toEqual([]);
	});

	it("names nothing for somebody who signed in through their own IdP", () => {
		expect(mailboxGrantsNeeded([{ providerId: "okta", scope: null }])).toEqual(
			[],
		);
	});

	it("still names Google for an SSO rep who linked it and revoked it", () => {
		expect(
			mailboxGrantsNeeded([
				{ providerId: "okta", scope: null },
				{ providerId: "google", scope: null },
			]),
		).toEqual(["google"]);
	});

	it("names nothing for an SSO rep with Gmail connected", () => {
		expect(
			mailboxGrantsNeeded([
				{ providerId: "okta", scope: null },
				{ providerId: "google", scope: GRANTED },
			]),
		).toEqual([]);
	});

	it("names nothing for an account with no sign-in rows at all", () => {
		expect(mailboxGrantsNeeded([])).toEqual([]);
	});

	it("names nothing once one of two mailboxes is granted", () => {
		expect(
			mailboxGrantsNeeded([
				{ providerId: "google", scope: GRANTED },
				{ providerId: "microsoft", scope: null },
			]),
		).toEqual([]);
	});

	it("names Google for a rep who linked Slack and never granted Gmail", () => {
		expect(
			mailboxGrantsNeeded([
				{ providerId: "google", scope: "openid,email" },
				{ providerId: "slack", scope: "chat:write" },
			]),
		).toEqual(["google"]);
	});
});

describe("which provider the grant page should offer", () => {
	it("offers the one they signed in with", () => {
		expect(
			mailboxGrantsNeeded([{ providerId: "microsoft", scope: null }]),
		).toEqual(["microsoft"]);
	});

	it("offers both when neither has been granted", () => {
		expect(
			mailboxGrantsNeeded([
				{ providerId: "google", scope: null },
				{ providerId: "microsoft", scope: null },
			]),
		).toEqual(["google", "microsoft"]);
	});

	it("offers nothing to an IdP rep", () => {
		expect(mailboxGrantsNeeded([{ providerId: "okta", scope: null }])).toEqual(
			[],
		);
	});
});

describe("whether revoking a provider costs someone the CRM", () => {
	it("is true when Google is the only way in", () => {
		expect(signsInWithGoogle([{ providerId: "google", scope: GRANTED }])).toBe(
			true,
		);
	});

	it("is true when Microsoft is the only way in", () => {
		expect(
			signsInWithMicrosoft([
				{ providerId: "microsoft", scope: GRANTED_MICROSOFT },
			]),
		).toBe(true);
	});

	it("is false once an IdP is also on the account", () => {
		expect(
			signsInWithGoogle([
				{ providerId: "okta", scope: null },
				{ providerId: "google", scope: GRANTED },
			]),
		).toBe(false);
	});

	it("is false for Google once Microsoft is also a way in", () => {
		expect(
			signsInWithGoogle([
				{ providerId: "google", scope: GRANTED },
				{ providerId: "microsoft", scope: GRANTED_MICROSOFT },
			]),
		).toBe(false);
	});

	it("is false for an account with nothing linked", () => {
		expect(signsInWithGoogle([])).toBe(false);
	});
});
