import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db, EntityType } from "@crm/db";
import { AgentQueueService } from "../src/agent/agent-queue.service";
import type { AgentTriggerService } from "../src/agent/agent-trigger.service";
import { CompaniesService } from "../src/companies/companies.service";
import type { FaviconService } from "../src/companies/favicon.service";
import { ActivityStampService } from "../src/crm/activity-stamp.service";
import { ConversionService } from "../src/currency/conversion.service";
import { FieldsService } from "../src/fields/fields.service";
import { FACET_UNASSIGNED } from "../src/trpc/list-input";
import { withDiscardedCrmEvents } from "./agent-trigger.stub";

const suffix = process.env.TEST_RUN_ID ?? "company-facets";
const TAG = `WSCFACET${suffix}`;
const DOMAIN = `wsc-facets-${suffix}.test`;

const agent = {
	contactCreated: async () => true,
	companyCreated: async () => undefined,
	companyRequested: async () => true,
	withCrmEvents: withDiscardedCrmEvents,
	fieldBackfillRecords: async () => ({ queued: 0, merged: 0 }),
} as unknown as AgentTriggerService;

const fields = new FieldsService(db, agent);
const companies = new CompaniesService(
	db,
	agent,
	new AgentQueueService(db),
	{ backfill: async () => undefined } as unknown as FaviconService,
	new ActivityStampService(db),
	new ConversionService(db),
	fields,
);

const listArgs = {
	sort: "",
	dir: "asc" as const,
	page: 1,
	pageSize: 25,
	owner: [],
	industry: [],
	vertical: [],
	entityType: [],
	enrichment: [],
	source: [],
	activity: [],
	fields: {},
	archived: false,
};

let hotelVerticalId: string;
let propertyId: string;
let groupId: string;
let lifecycleFieldId: string;
let targetOptionId: string;
let regionFieldId: string;
let regionOptionId: string;

async function selectField(key: string) {
	const definition = await db.fieldDefinition.findFirst({
		where: { entity: "COMPANY", key, archivedAt: null },
		select: {
			id: true,
			showOnFilter: true,
			options: {
				orderBy: { position: "asc" },
				select: { id: true, label: true },
			},
		},
	});
	if (!definition) throw new Error(`The ${key} field is missing.`);
	return definition;
}

async function clean(): Promise<void> {
	await db.company.deleteMany({ where: { domain: DOMAIN } });
}

beforeAll(async () => {
	await clean();

	const hotel = await db.vertical.findFirst({
		where: { key: "hotel" },
		select: { id: true },
	});
	if (!hotel) throw new Error("The hotel vertical is missing.");
	hotelVerticalId = hotel.id;

	const lifecycle = await selectField("lifecycle_stage");
	const region = await selectField("region");

	expect(lifecycle.showOnFilter).toBe(true);
	expect(region.showOnFilter).toBe(true);

	lifecycleFieldId = lifecycle.id;
	const target = lifecycle.options.find((option) => option.label === "Target");
	if (!target) throw new Error("The lifecycle stage field has no Target.");
	targetOptionId = target.id;

	regionFieldId = region.id;
	const firstRegion = region.options[0];
	if (!firstRegion) throw new Error("The region field has no options.");
	regionOptionId = firstRegion.id;

	const property = await db.company.create({
		data: {
			name: `${TAG} Property`,
			domain: DOMAIN,
			entityType: EntityType.HOTEL,
			verticalId: hotelVerticalId,
		},
		select: { id: true },
	});
	propertyId = property.id;

	const group = await db.company.create({
		data: {
			name: `${TAG} Group`,
			domain: DOMAIN,
			entityType: EntityType.HOTEL_GROUP,
		},
		select: { id: true },
	});
	groupId = group.id;

	await db.fieldValue.createMany({
		data: [
			{
				fieldId: lifecycleFieldId,
				companyId: propertyId,
				optionId: targetOptionId,
			},
			{
				fieldId: regionFieldId,
				companyId: propertyId,
				optionId: regionOptionId,
			},
		],
	});
});

afterAll(async () => {
	await clean();
});

describe("the business list facets", () => {
	it("counts vertical and entity type, and says which businesses have no vertical", async () => {
		const listed = await companies.list({ ...listArgs, q: TAG });

		expect(listed.total).toBe(2);
		expect(listed.facetCounts.vertical?.[hotelVerticalId]).toBe(1);
		expect(listed.facetCounts.vertical?.[FACET_UNASSIGNED]).toBe(1);
		expect(listed.facetCounts.entityType?.[EntityType.HOTEL]).toBe(1);
		expect(listed.facetCounts.entityType?.[EntityType.HOTEL_GROUP]).toBe(1);
	});

	it("filters by entity type and carries both columns on the row", async () => {
		const listed = await companies.list({
			...listArgs,
			q: TAG,
			entityType: [EntityType.HOTEL],
		});

		expect(listed.rows).toHaveLength(1);
		expect(listed.rows[0]?.id).toBe(propertyId);
		expect(listed.rows[0]?.entityType).toBe(EntityType.HOTEL);
		expect(listed.rows[0]?.vertical?.key).toBe("hotel");
	});

	it("filters by vertical, and by no vertical", async () => {
		const inVertical = await companies.list({
			...listArgs,
			q: TAG,
			vertical: [hotelVerticalId],
		});
		const without = await companies.list({
			...listArgs,
			q: TAG,
			vertical: [FACET_UNASSIGNED],
		});

		expect(inVertical.rows.map((row) => row.id)).toEqual([propertyId]);
		expect(without.rows.map((row) => row.id)).toEqual([groupId]);
	});

	it("already filters and counts lifecycle stage and region, because they are FieldDefinition rows and not columns", async () => {
		const listed = await companies.list({ ...listArgs, q: TAG });

		expect(listed.facetCounts["field:lifecycle_stage"]?.[targetOptionId]).toBe(
			1,
		);
		expect(listed.facetCounts["field:region"]?.[regionOptionId]).toBe(1);

		const targets = await companies.list({
			...listArgs,
			q: TAG,
			fields: { lifecycle_stage: [targetOptionId] },
		});

		expect(targets.rows.map((row) => row.id)).toEqual([propertyId]);
	});
});
