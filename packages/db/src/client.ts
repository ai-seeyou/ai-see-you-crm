import "@crm/env/load";

import { PrismaPg } from "@prisma/adapter-pg";
import { type Prisma, PrismaClient } from "./generated/prisma/client";

const LOCAL_HOSTS = new Set([
	"localhost",
	"127.0.0.1",
	"::1",
	"[::1]",
	"0.0.0.0",
]);

const rawConnectionString =
	process.env.NODE_ENV === "test" ? testDatabase() : liveDatabase();

const connection = describeConnection(rawConnectionString);

// Supabase signs its pooler certificate with its own root, which is in no system
// trust store, so `sslmode=require` fails to verify and the usual fix is
// `sslmode=no-verify`. That encrypts without authenticating, which is a different
// thing: the pooler also accepts plaintext, so an unverified client cannot tell a
// downgrade from a bad day. DATABASE_CA_CERT holds the PEM of the issuing root and
// the chain is verified against it. The certificate is public, not a secret.
//
// `sslmode` is stripped from the connection string when a certificate is present,
// because node-postgres lets the string win and the verification would not happen.
// The string keeps it for the Prisma CLI, which has its own connector.
//
// A remote database with no certificate is refused rather than connected to
// insecurely, because the alternative is a silent plaintext connection.
type DatabaseConnection = {
	connectionString: string;
	ssl?: { ca: string; rejectUnauthorized: true };
};

function describeConnection(url: string): DatabaseConnection {
	const ca = process.env.DATABASE_CA_CERT?.trim();

	if (!ca) {
		if (isLocal(url)) return { connectionString: url };

		throw new Error(
			[
				`DATABASE_CA_CERT is not set and the database is at ${hostOf(url)}, which is not local.`,
				"",
				"The connection would not be verified, and Supabase's pooler accepts",
				"plaintext, so it could silently be unencrypted. Set DATABASE_CA_CERT to",
				"the PEM of the root that signs the database's certificate.",
				"",
				"For Supabase:",
				"",
				"    curl -sS https://supabase-downloads.s3.amazonaws.com/prod/ssl/prod-ca-2021.crt",
				"",
			].join("\n"),
		);
	}

	return {
		connectionString: withoutSslMode(url),
		ssl: { ca, rejectUnauthorized: true },
	};
}

function withoutSslMode(url: string): string {
	try {
		const parsed = new URL(url);
		parsed.searchParams.delete("sslmode");
		return parsed.toString();
	} catch {
		return url;
	}
}

function isLocal(url: string): boolean {
	return LOCAL_HOSTS.has(hostOf(url));
}

function hostOf(url: string): string {
	try {
		return new URL(url).hostname;
	} catch {
		return url;
	}
}

function liveDatabase(): string {
	const url = process.env.DATABASE_URL;

	if (!url) {
		throw new Error(
			"DATABASE_URL is not set. Copy .env.example to .env at the root of the repo and fill it in, or set DATABASE_URL in the environment.",
		);
	}

	return url;
}

function testDatabase(): string {
	const url = process.env.TEST_DATABASE_URL;

	if (!url) {
		throw new Error(
			[
				"TEST_DATABASE_URL is not set, and the suite will not fall back to DATABASE_URL.",
				"",
				"These are real integration tests. They delete every workspace member and the",
				"organization row and put them back when the run finishes — so a run that is",
				"interrupted leaves everybody locked out of whatever database it was pointed at.",
				"The pre-push hook runs them, so that is one `git push` away from a database you",
				"care about.",
				"",
				"Make a throwaway one and point TEST_DATABASE_URL at it:",
				"",
				"    bun run db:test",
				"",
			].join("\n"),
		);
	}

	if (!databaseName(url).endsWith("_test")) {
		throw new Error(
			`TEST_DATABASE_URL must name a database ending in _test, so it cannot be one somebody is using. It names "${databaseName(url)}".`,
		);
	}

	return url;
}

function databaseName(url: string): string {
	try {
		return new URL(url).pathname.replace(/^\//, "");
	} catch {
		return url;
	}
}

export interface PrismaLogRecord {
	level: Prisma.LogLevel;
	message: string;
	target: string;
	durationMs?: number;
}

export type PrismaLogSink = (record: PrismaLogRecord) => void;

const consoleSink: PrismaLogSink = ({ level, message, target, durationMs }) => {
	const suffix = durationMs === undefined ? "" : ` (+${durationMs}ms)`;
	const line = `[prisma:${level}] ${message}${suffix} [${target}]`;

	if (level === "error") {
		console.error(line);
	} else if (level === "warn") {
		console.warn(line);
	} else {
		console.log(line);
	}
};

let sink: PrismaLogSink = consoleSink;

export function setPrismaLogSink(next: PrismaLogSink | null): void {
	sink = next ?? consoleSink;
}

const logQueries = process.env.PRISMA_LOG_QUERIES === "true";

const logDefinitions: Prisma.LogDefinition[] = [
	{ level: "warn", emit: "event" },
	{ level: "error", emit: "event" },
	...(logQueries
		? ([
				{ level: "query", emit: "event" },
				{ level: "info", emit: "event" },
			] satisfies Prisma.LogDefinition[])
		: []),
];

const createPrismaClient = () => {
	const client = new PrismaClient({
		adapter: new PrismaPg(connection),
		log: logDefinitions,
	});

	client.$on("error", ({ message, target }) => {
		sink({ level: "error", message, target });
	});
	client.$on("warn", ({ message, target }) => {
		sink({ level: "warn", message, target });
	});
	client.$on("info", ({ message, target }) => {
		sink({ level: "info", message, target });
	});
	client.$on("query", ({ query, duration, target }) => {
		sink({ level: "query", message: query, target, durationMs: duration });
	});

	return client;
};

declare global {
	var prisma: ReturnType<typeof createPrismaClient> | undefined;
}

export const db = globalThis.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
	globalThis.prisma = db;
}

export type Db = typeof db;
