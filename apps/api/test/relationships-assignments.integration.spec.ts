import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import {
	AssignmentScope,
	ContactRoleType,
	db,
	EntityType,
	RelationshipType,
} from "@crm/db";
import { AgentQueueService } from "../src/agent/agent-queue.service";
import type { AgentTriggerService } from "../src/agent/agent-trigger.service";
import { AssignmentsService } from "../src/assignments/assignments.service";
import { CompanyDirectoryService } from "../src/companies/company-directory.service";
import { ContactAssignmentService } from "../src/contacts/contact-assignment.service";
import { ContactsService } from "../src/contacts/contacts.service";
import { ActivityStampService } from "../src/crm/activity-stamp.service";
import { FieldsService } from "../src/fields/fields.service";
import { RelationshipsService } from "../src/relationships/relationships.service";
import { withDiscardedCrmEvents } from "./agent-trigger.stub";

const suffix = process.env.TEST_RUN_ID ?? "relationships-assignments";
const TAG = `WSCRA${suffix}`;
const GROUP_DOMAIN = `wsc-group-${suffix}.test`;
const PROPERTY_DOMAIN = `wsc-property-${suffix}.test`;

const agent = {
	contactCreated: async () => true,
	companyCreated: async () => undefined,
	companyRequested: async () => true,
	withCrmEvents: withDiscardedCrmEvents,
	fieldBackfillRecords: async () => ({ queued: 0, merged: 0 }),
	fieldBackfill: async () => undefined,
} as unknown as AgentTriggerService;

const fields = new FieldsService(db, agent);
const relationships = new RelationshipsService(db);
const assignments = new AssignmentsService(
	db,
	new ContactAssignmentService(db),
);
const contacts = new ContactsService(
	db,
	new CompanyDirectoryService(db),
	agent,
	new AgentQueueService(db),
	new ActivityStampService(db),
	fields,
);

const domains = [GROUP_DOMAIN, PROPERTY_DOMAIN];

let groupId: string;
let sydneyId: string;
let melbourneId: string;
let directorId: string;
let managerId: string;

async function business(
	name: string,
	entityType: EntityType,
	domain: string,
): Promise<string> {
	const row = await db.company.create({
		data: { name, domain, entityType },
		select: { id: true },
	});
	return row.id;
}

async function clean(): Promise<void> {
	await db.contact.deleteMany({
		where: { email: { endsWith: `-${suffix}.test` } },
	});
	await db.company.deleteMany({ where: { domain: { in: domains } } });
}

beforeAll(async () => {
	await clean();

	groupId = await business(
		`WSC Group ${suffix}`,
		EntityType.HOTEL_GROUP,
		GROUP_DOMAIN,
	);
	sydneyId = await business(
		`WSC Sydney ${suffix}`,
		EntityType.HOTEL,
		PROPERTY_DOMAIN,
	);
	melbourneId = await business(
		`WSC Melbourne ${suffix}`,
		EntityType.HOTEL,
		PROPERTY_DOMAIN,
	);

	const director = await db.contact.create({
		data: {
			firstName: "Nadia",
			lastName: `Director ${TAG}`,
			email: `nadia@wsc-group-${suffix}.test`,
			companyId: groupId,
		},
		select: { id: true },
	});
	directorId = director.id;

	const manager = await db.contact.create({
		data: {
			firstName: "Owen",
			lastName: `Manager ${TAG}`,
			email: `owen@wsc-property-${suffix}.test`,
			companyId: sydneyId,
		},
		select: { id: true },
	});
	managerId = manager.id;
});

afterAll(async () => {
	await clean();
});

describe("relationships", () => {
	it("records a typed edge and reads it in both directions", async () => {
		await relationships.create({
			fromCompanyId: sydneyId,
			toCompanyId: groupId,
			type: RelationshipType.BELONGS_TO,
		});

		const fromProperty = await relationships.forCompany({
			companyId: sydneyId,
			includeEnded: false,
		});
		const fromGroup = await relationships.forCompany({
			companyId: groupId,
			includeEnded: false,
		});

		expect(fromProperty.outgoing).toHaveLength(1);
		expect(fromProperty.outgoing[0]?.company.id).toBe(groupId);
		expect(fromProperty.incoming).toHaveLength(0);

		expect(fromGroup.incoming).toHaveLength(1);
		expect(fromGroup.incoming[0]?.company.id).toBe(sydneyId);
	});

	it("refuses a relationship that points at itself", async () => {
		await expect(
			relationships.create({
				fromCompanyId: sydneyId,
				toCompanyId: sydneyId,
				type: RelationshipType.BELONGS_TO,
			}),
		).rejects.toThrow("cannot be related to itself");
	});

	it("refuses a duplicate current edge with a sentence, not a Prisma error", async () => {
		await expect(
			relationships.create({
				fromCompanyId: sydneyId,
				toCompanyId: groupId,
				type: RelationshipType.BELONGS_TO,
			}),
		).rejects.toThrow("End that relationship before recording a new one.");
	});

	it("ends a relationship by setting validTo, and keeps the row", async () => {
		const current = await relationships.forCompany({
			companyId: melbourneId,
			includeEnded: false,
		});
		expect(current.outgoing).toHaveLength(0);

		const created = await relationships.create({
			fromCompanyId: melbourneId,
			toCompanyId: groupId,
			type: RelationshipType.MANAGED_BY,
		});

		const ended = await relationships.end({ id: created.id });
		expect(ended.validTo).not.toBeNull();

		const after = await relationships.forCompany({
			companyId: melbourneId,
			includeEnded: false,
		});
		const withHistory = await relationships.forCompany({
			companyId: melbourneId,
			includeEnded: true,
		});

		expect(after.outgoing).toHaveLength(0);
		expect(withHistory.outgoing).toHaveLength(1);

		await expect(relationships.end({ id: created.id })).rejects.toThrow(
			"already ended",
		);
	});

	it("frees the edge once it has ended, so the same type can be recorded again", async () => {
		const again = await relationships.create({
			fromCompanyId: melbourneId,
			toCompanyId: groupId,
			type: RelationshipType.MANAGED_BY,
		});

		expect(again.validTo).toBeNull();
	});
});

describe("assignments", () => {
	it("assigns responsibility for several businesses in one action", async () => {
		const result = await assignments.assignMany({
			contactId: directorId,
			companyIds: [sydneyId, melbourneId, sydneyId],
			roleType: ContactRoleType.DISTRIBUTION,
			title: "Group Director of Distribution",
		});

		expect(result.requested).toBe(2);
		expect(result.succeeded).toBe(2);

		const held = await assignments.forContact({
			contactId: directorId,
			scope: [AssignmentScope.RESPONSIBLE_FOR],
			includeEnded: false,
		});

		expect(held.rows).toHaveLength(2);
		expect(new Set(held.rows.map((row) => row.company.id))).toEqual(
			new Set([sydneyId, melbourneId]),
		);
		for (const row of held.rows) {
			expect(row.roleType).toBe(ContactRoleType.DISTRIBUTION);
			expect(row.isPrimary).toBe(false);
		}
	});

	it("is found from the business, which is the direction that matters", async () => {
		const people = await assignments.forCompany({
			companyId: melbourneId,
			scope: [AssignmentScope.RESPONSIBLE_FOR],
			includeEnded: false,
		});

		expect(people.rows).toHaveLength(1);
		expect(people.rows[0]?.contact.id).toBe(directorId);
		expect(people.rows[0]?.contact.employerId).toBe(groupId);
	});

	it("ends a responsibility without deleting the row", async () => {
		await assignments.end({ contactId: directorId, companyId: melbourneId });

		const current = await assignments.forContact({
			contactId: directorId,
			scope: [AssignmentScope.RESPONSIBLE_FOR],
			includeEnded: false,
		});
		const history = await assignments.forContact({
			contactId: directorId,
			scope: [AssignmentScope.RESPONSIBLE_FOR],
			includeEnded: true,
		});

		expect(current.rows).toHaveLength(1);
		expect(history.rows).toHaveLength(2);
		expect(
			history.rows.find((row) => row.company.id === melbourneId)?.validTo,
		).not.toBeNull();
	});

	it("refuses to end a responsibility that is not current", async () => {
		await expect(
			assignments.end({ contactId: directorId, companyId: melbourneId }),
		).rejects.toThrow("not currently responsible");
	});

	it("refuses to assign a contact that does not exist", async () => {
		await expect(
			assignments.assign({
				contactId: `missing-${suffix}`,
				companyId: sydneyId,
				roleType: ContactRoleType.REVENUE,
			}),
		).rejects.toThrow("No contact with id");
	});
});

describe("the role type facet", () => {
	it("counts people, and filters the contact list by current role", async () => {
		await assignments.assign({
			contactId: managerId,
			companyId: melbourneId,
			roleType: ContactRoleType.REVENUE,
		});

		const listed = await contacts.list({
			q: TAG,
			sort: "",
			dir: "asc",
			page: 1,
			pageSize: 25,
			owner: [],
			company: [],
			source: [],
			title: [],
			seniority: [],
			persona: [],
			roleType: [ContactRoleType.DISTRIBUTION],
			activity: [],
			fields: {},
			archived: false,
		});

		expect(listed.rows).toHaveLength(1);
		expect(listed.rows[0]?.id).toBe(directorId);
		expect(listed.rows[0]?.roleTypes).toContain(ContactRoleType.DISTRIBUTION);
		expect(listed.rows[0]?.responsibleForCount).toBe(1);

		const facets = listed.facetCounts.roleType ?? {};
		expect(facets[ContactRoleType.DISTRIBUTION]).toBe(1);
		expect(facets[ContactRoleType.REVENUE]).toBe(1);
	});
});
