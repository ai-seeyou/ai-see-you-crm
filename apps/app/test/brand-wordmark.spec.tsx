import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { BrandWordmark } from "@crm/ui/components/brand-wordmark";
import { renderToStaticMarkup } from "react-dom/server";

describe("AI See You header wordmark", () => {
	it("uses the unchanged Production logo asset", () => {
		const asset = readFileSync(
			new URL("../public/logo-ai-see-you.png", import.meta.url),
		);
		expect(createHash("sha256").update(asset).digest("hex")).toBe(
			"e11e24d8b4d04a67a47e637c02febb47358bccecdd1b484b01931e4f70dd1f28",
		);
	});

	it("renders an accessible, proportionate logo at mobile and desktop sizes", () => {
		const html = renderToStaticMarkup(<BrandWordmark />);
		expect(html).toContain('alt="AI See You"');
		expect(html).toContain('width="1000"');
		expect(html).toContain('height="220"');
		expect(html).toContain("h-auto w-40 shrink-0 sm:w-48");
		expect(html).toContain("logo-ai-see-you.png");
		expect(html).not.toContain("Comp AI");
	});
});
