import { db } from "@crm/db";
import { ProductionReadClient } from "../agent/lib/production-client";
import { importProductionHotels } from "../agent/lib/production-import";

const args = new Set(process.argv.slice(2));
const valueAfter = (name: string) => {
	const index = process.argv.indexOf(name);
	return index === -1 ? undefined : process.argv[index + 1];
};
const destination = valueAfter("--destination");
const expectedText = valueAfter("--expected-count");
const expectedCount = expectedText ? Number(expectedText) : undefined;
if (expectedText && !Number.isSafeInteger(expectedCount)) {
	throw new Error("--expected-count must be an integer");
}
const endpoint = process.env.PRODUCTION_READ_URL;
const token = process.env.PRODUCTION_READ_TOKEN;
if (!endpoint || !token) {
	throw new Error("PRODUCTION_READ_URL and PRODUCTION_READ_TOKEN are required");
}
const client = new ProductionReadClient(endpoint, token);

const result = await importProductionHotels(client, {
	destination,
	dryRun: !args.has("--commit"),
	expectedCount,
});
console.log(JSON.stringify(result, null, 2));
await db.$disconnect();
