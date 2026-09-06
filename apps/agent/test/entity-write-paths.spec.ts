import { describe, expect, it } from "bun:test";
import { Glob } from "bun";

const ROOT = new URL("../agent/", import.meta.url).pathname;
const PRODUCTION_IMPORT_WRITE_PATH = "lib/production-import.ts";

const MODELS = [
	"entityRelationship",
	"contactAssignment",
	"externalRef",
	"externalRelationshipRef",
	"productionBusinessProfile",
	"vertical",
	"opportunityEntity",
] as const;

const MUTATORS = [
	"create",
	"createMany",
	"createManyAndReturn",
	"update",
	"updateMany",
	"upsert",
	"delete",
	"deleteMany",
] as const;

const PRISMA_WRITE = new RegExp(
	`\\.(?:${MODELS.join("|")})\\s*\\.\\s*(?:${MUTATORS.join("|")})\\b`,
);

const RAW_WRITE = new RegExp(
	`(?:insert\\s+into|update|delete\\s+from)\\s+"?(?:${MODELS.join("|")})"?`,
	"i",
);

const READS_ENTITY_TYPE =
	/^\s*entityType\s*:\s*(?:true|EntityType|[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\.entityType)[;,]?\s*$/;

async function sources(): Promise<{ path: string; text: string }[]> {
	const glob = new Glob("**/*.ts");
	const files: { path: string; text: string }[] = [];

	for await (const path of glob.scan({ cwd: ROOT, absolute: true })) {
		files.push({
			path: path.slice(ROOT.length),
			text: await Bun.file(path).text(),
		});
	}

	return files;
}

describe("the agent has no write path into the travel graph", () => {
	it("scans the whole agent, not an empty directory", async () => {
		expect((await sources()).length).toBeGreaterThan(50);
	});

	it("never calls a Prisma write on a structural table", async () => {
		const offenders = (await sources())
			.filter((file) => file.path !== PRODUCTION_IMPORT_WRITE_PATH)
			.filter((file) => PRISMA_WRITE.test(file.text))
			.map((file) => file.path);

		expect(offenders).toEqual([]);
	});

	it("never writes a structural table in raw SQL", async () => {
		const offenders = (await sources())
			.filter((file) => RAW_WRITE.test(file.text))
			.map((file) => file.path);

		expect(offenders).toEqual([]);
	});

	it("never mentions verticalId, so it can never set one", async () => {
		const offenders = (await sources())
			.filter((file) => file.path !== PRODUCTION_IMPORT_WRITE_PATH)
			.filter((file) => file.text.includes("verticalId"))
			.map((file) => file.path);

		expect(offenders).toEqual([]);
	});

	it("only ever reads entityType, never assigns one", async () => {
		const offenders: string[] = [];

		for (const file of await sources()) {
			if (file.path === PRODUCTION_IMPORT_WRITE_PATH) continue;
			for (const line of file.text.split("\n")) {
				if (!/\bentityType\s*:/.test(line)) continue;
				if (READS_ENTITY_TYPE.test(line)) continue;
				offenders.push(`${file.path}: ${line.trim()}`);
			}
		}

		expect(offenders).toEqual([]);
	});
});
