import { describe, expect, it } from "bun:test";
import { Glob } from "bun";

describe("Production read boundary", () => {
	it("contains no Production database client or mutating HTTP verb", async () => {
		const appRoot = new URL("../", import.meta.url).pathname;
		const paths: string[] = [];
		for await (const path of new Glob(
			"{agent,scripts}/**/*production*.ts",
		).scan({
			cwd: appRoot,
			absolute: true,
		}))
			paths.push(path);
		paths.push(
			new URL("../../../.env.example", import.meta.url).pathname,
			new URL("../../../turbo.json", import.meta.url).pathname,
			new URL("../package.json", import.meta.url).pathname,
		);
		const source = (
			await Promise.all(paths.map((path) => Bun.file(path).text()))
		).join("\n");
		expect(paths.length).toBeGreaterThan(8);
		expect(source).not.toMatch(/method:\s*["'](?:POST|PUT|PATCH|DELETE)["']/);
		expect(source).not.toMatch(
			/SUPABASE_SERVICE_ROLE_KEY|PRODUCTION_DATABASE_URL|createClient\s*\(/,
		);
		expect(source).not.toMatch(/supabase\.from\(|\.rpc\(/);
	});

	it("uses Production IDs without domain matching", async () => {
		const importer = await Bun.file(
			new URL("../agent/lib/production-import.ts", import.meta.url),
		).text();
		expect(importer).toContain("externalId: record.productionPropertyId");
		expect(importer).not.toMatch(/find(?:First|Unique)\([\s\S]{0,300}domain/);
	});
});
