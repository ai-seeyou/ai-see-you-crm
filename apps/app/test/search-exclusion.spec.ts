import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const appRoot = resolve(import.meta.dir, "..");
const layout = readFileSync(resolve(appRoot, "app/layout.tsx"), "utf8");
const nextConfig = readFileSync(resolve(appRoot, "next.config.ts"), "utf8");

describe("search exclusion", () => {
	it("marks every page as noindex and nofollow in metadata", () => {
		expect(layout).toContain("robots: {");
		expect(layout).toContain("index: false");
		expect(layout).toContain("follow: false");
	});

	it("sends a noindex and nofollow header on every route", () => {
		expect(nextConfig).toContain('source: "/:path*"');
		expect(nextConfig).toContain('key: "X-Robots-Tag"');
		expect(nextConfig).toContain('value: "noindex, nofollow"');
	});
});
