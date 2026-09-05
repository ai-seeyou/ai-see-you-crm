export const GOOGLE_PROVIDER_ID = "google";
export const MICROSOFT_PROVIDER_ID = "microsoft";
export const SLACK_PROVIDER_ID = "slack";

export const MAILBOX_PROVIDER_IDS = [
	GOOGLE_PROVIDER_ID,
	MICROSOFT_PROVIDER_ID,
] as const;

export type MailboxProviderId = (typeof MAILBOX_PROVIDER_IDS)[number];

export const IDENTITY_SCOPES = ["openid", "email", "profile"] as const;

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
export const CALENDAR_SCOPE =
	"https://www.googleapis.com/auth/calendar.readonly";
export const OUTLOOK_MAIL_SCOPE = "Mail.Read";

export const SYNC_SCOPES = [GMAIL_SCOPE, CALENDAR_SCOPE] as const;
export const MICROSOFT_SYNC_SCOPES = [OUTLOOK_MAIL_SCOPE] as const;

export const SYNC_SCOPES_FOR = {
	[GOOGLE_PROVIDER_ID]: SYNC_SCOPES,
	[MICROSOFT_PROVIDER_ID]: MICROSOFT_SYNC_SCOPES,
} satisfies Record<MailboxProviderId, readonly string[]>;

// Sign-in asks for identity and nothing else. This used to include SYNC_SCOPES,
// which stopped being true when mailbox access became a separate decision.
export const REQUIRED_SCOPES = [...IDENTITY_SCOPES] as const;

const GRAPH_SCOPE_PREFIX = "https://graph.microsoft.com/";

export function isMailboxProvider(
	providerId: string,
): providerId is MailboxProviderId {
	return (MAILBOX_PROVIDER_IDS as readonly string[]).includes(providerId);
}

export function hasSyncScopes(
	providerId: string,
	scope: string | null | undefined,
): boolean {
	if (!isMailboxProvider(providerId)) return false;

	const granted = parseScopes(scope);
	return SYNC_SCOPES_FOR[providerId].every((needed) => granted.has(needed));
}

export type SignInAccount = {
	providerId: string;
	scope?: string | null;
};

export function signsInOnlyWith(
	accounts: readonly SignInAccount[],
	providerId: string,
): boolean {
	return (
		accounts.length > 0 &&
		accounts.every((account) => account.providerId === providerId)
	);
}

export function signsInWithGoogle(accounts: readonly SignInAccount[]): boolean {
	return signsInOnlyWith(accounts, GOOGLE_PROVIDER_ID);
}

export function signsInWithMicrosoft(
	accounts: readonly SignInAccount[],
): boolean {
	return signsInOnlyWith(accounts, MICROSOFT_PROVIDER_ID);
}

// Which mailbox providers this person could still grant on. It reads the mailbox
// rows and ignores everything else: testing that EVERY row was a mailbox meant a
// rep who linked Slack was told they had nothing outstanding, and /grant-access
// then bounced them away from the only page that offers the grant. That was
// nearly unreachable while sign-in always granted the sync scopes. It is not now.
export function mailboxGrantsNeeded(
	accounts: readonly SignInAccount[],
): MailboxProviderId[] {
	const mailboxes = accounts.filter((account) =>
		isMailboxProvider(account.providerId),
	);

	if (mailboxes.length === 0) return [];

	const granted = mailboxes.some((account) =>
		hasSyncScopes(account.providerId, account.scope),
	);
	if (granted) return [];

	return [
		...new Set(
			mailboxes.map((account) => account.providerId).filter(isMailboxProvider),
		),
	];
}

export function parseScopes(scope: string | null | undefined): Set<string> {
	return new Set(
		(scope ?? "")
			.split(/[,\s]+/)
			.map((entry) => entry.trim())
			.filter(Boolean)
			.map((entry) =>
				entry.startsWith(GRAPH_SCOPE_PREFIX)
					? entry.slice(GRAPH_SCOPE_PREFIX.length)
					: entry,
			),
	);
}
