import { auth, type Session } from "@crm/auth";
import { db } from "@crm/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

export const getSession = cache(
	async (): Promise<Session | null> =>
		auth.api.getSession({ headers: await headers() }),
);

export async function requireSession(): Promise<Session> {
	const session = await getSession();

	if (!session) {
		redirect("/sign-in");
	}

	return session;
}

export const signInAccounts = cache(async (userId: string) =>
	db.account.findMany({
		where: { userId },
		select: { providerId: true, scope: true },
	}),
);

// Reading a mailbox is optional here, so nothing walls a rep who has not
// connected one. Upstream treated sync as mandatory and sent every Google rep to
// /grant-access until they granted Gmail, which meant signing in and handing over
// a mailbox were the same act. They are two decisions and this keeps them apart.
// mailboxGrantsNeeded still says which providers are outstanding, and
// /grant-access still offers them, reached from Settings rather than forced.
export async function requireMailboxAccess(): Promise<Session> {
	return requireSession();
}
