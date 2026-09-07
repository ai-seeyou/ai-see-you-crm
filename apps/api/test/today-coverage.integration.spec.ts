import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import {
	ActivityType,
	AssignmentScope,
	ContactRoleType,
	DealStage,
	db,
	EmailDirection,
	EntityType,
} from "@crm/db";
import { CoverageService } from "../src/coverage/coverage.service";
import { COVERAGE } from "../src/coverage/coverage-config";
import { TodayService } from "../src/today/today.service";
import { TODAY } from "../src/today/today-config";

const suffix = process.env.TEST_RUN_ID ?? "today-coverage";
const DOMAIN = `wsc-views-${suffix}.test`;
const userId = `wsc-views-user-${suffix}`;

const today = new TodayService(db);
const coverage = new CoverageService(db);

const DAY_MS = 24 * 60 * 60 * 1000;

let coveredId: string;
let gappedId: string;
let staleDealId: string;
let freshDealId: string;
let replyThreadId: string;
let oldThreadId: string;
let overdueTaskId: string;
let followUpTaskId: string;
let completedTaskId: string;

async function business(name: string): Promise<string> {
	const row = await db.company.create({
		data: { name, domain: DOMAIN, entityType: EntityType.HOTEL },
		select: { id: true },
	});
	return row.id;
}

async function target(companyId: string): Promise<void> {
	const definition = await db.fieldDefinition.findFirst({
		where: {
			entity: "COMPANY",
			key: COVERAGE.target.fieldKey,
			archivedAt: null,
		},
		select: {
			id: true,
			options: {
				where: { label: { in: [...COVERAGE.target.optionLabels] } },
				select: { id: true },
			},
		},
	});

	const optionId = definition?.options[0]?.id;
	if (!definition || !optionId) {
		throw new Error(
			`The ${COVERAGE.target.fieldKey} field is missing its target option. The test database is behind.`,
		);
	}

	await db.fieldValue.create({
		data: { fieldId: definition.id, companyId, optionId },
		select: { id: true },
	});
}

async function responsible(
	companyId: string,
	roleType: ContactRoleType,
	first: string,
): Promise<void> {
	const contact = await db.contact.create({
		data: {
			firstName: first,
			lastName: `Cover ${suffix}`,
			email: `${first.toLowerCase()}@${DOMAIN}`,
		},
		select: { id: true },
	});

	await db.contactAssignment.create({
		data: {
			contactId: contact.id,
			companyId,
			roleType,
			scope: AssignmentScope.RESPONSIBLE_FOR,
			isPrimary: false,
			validFrom: new Date(),
		},
		select: { id: true },
	});
}

async function clean(): Promise<void> {
	const companies = await db.company.findMany({
		where: { domain: DOMAIN },
		select: { id: true },
	});
	const ids = companies.map((row) => row.id);

	await db.emailThread.deleteMany({
		where: { rootMessageId: { endsWith: `@${DOMAIN}` } },
	});
	await db.activity.deleteMany({ where: { createdById: userId } });
	await db.deal.deleteMany({ where: { companyId: { in: ids } } });
	await db.contact.deleteMany({ where: { email: { endsWith: `@${DOMAIN}` } } });
	await db.company.deleteMany({ where: { id: { in: ids } } });
	await db.user.deleteMany({ where: { id: userId } });
}

beforeAll(async () => {
	await clean();

	await db.user.create({
		data: {
			id: userId,
			name: "Views Founder",
			email: `${userId}@example.test`,
			emailVerified: true,
		},
		select: { id: true },
	});

	coveredId = await business(`WSC Covered ${suffix}`);
	gappedId = await business(`WSC Gapped ${suffix}`);
	await target(coveredId);
	await target(gappedId);

	for (const roleType of COVERAGE.requiredRoles[EntityType.HOTEL]) {
		await responsible(coveredId, roleType, `Covered${roleType}`);
	}

	const [firstRequired] = COVERAGE.requiredRoles[EntityType.HOTEL];
	if (!firstRequired) throw new Error("A hotel must require a role.");
	await responsible(gappedId, firstRequired, `Gapped${firstRequired}`);

	const quiet = new Date(
		Date.now() - TODAY.opportunities.staleAfterMs - 2 * DAY_MS,
	);

	const stale = await db.deal.create({
		data: {
			name: `WSC Stale ${suffix}`,
			companyId: gappedId,
			ownerId: userId,
			stage: DealStage.ENGAGED,
			stageChangedAt: quiet,
			lastActivityAt: quiet,
		},
		select: { id: true },
	});
	staleDealId = stale.id;

	const fresh = await db.deal.create({
		data: {
			name: `WSC Fresh ${suffix}`,
			companyId: coveredId,
			ownerId: userId,
			stage: DealStage.ENGAGED,
			lastActivityAt: new Date(),
		},
		select: { id: true },
	});
	freshDealId = fresh.id;

	const overdue = await db.activity.create({
		data: {
			type: ActivityType.TASK,
			subject: `WSC Overdue ${suffix}`,
			dueAt: new Date(Date.now() - 2 * DAY_MS),
			createdById: userId,
			companyId: gappedId,
		},
		select: { id: true },
	});
	overdueTaskId = overdue.id;

	const followUp = await db.activity.create({
		data: {
			type: ActivityType.TASK,
			subject: `WSC Follow up ${suffix}`,
			dueAt: new Date(Date.now() + 2 * DAY_MS),
			createdById: userId,
			companyId: coveredId,
		},
		select: { id: true },
	});
	followUpTaskId = followUp.id;

	const replied = await db.emailThread.create({
		data: {
			rootMessageId: `wsc-reply-root@${DOMAIN}`,
			subject: `WSC Reply ${suffix}`,
			companyId: gappedId,
			firstMessageAt: new Date(Date.now() - 5 * DAY_MS),
			lastMessageAt: new Date(Date.now() - DAY_MS),
			messageCount: 1,
			messages: {
				create: {
					rfcMessageId: `wsc-reply-message@${DOMAIN}`,
					direction: EmailDirection.INBOUND,
					fromEmail: `guest@${DOMAIN}`,
					fromName: "A Buyer",
					snippet: "Happy to talk next week.",
					recipients: [],
					sentAt: new Date(Date.now() - DAY_MS),
					syncedByUserId: userId,
				},
			},
		},
		select: { id: true },
	});
	replyThreadId = replied.id;

	const older = new Date(Date.now() - TODAY.replies.sinceMs - 2 * DAY_MS);
	const old = await db.emailThread.create({
		data: {
			rootMessageId: `wsc-old-root@${DOMAIN}`,
			subject: `WSC Old ${suffix}`,
			companyId: coveredId,
			firstMessageAt: older,
			lastMessageAt: older,
			messageCount: 1,
			messages: {
				create: {
					rfcMessageId: `wsc-old-message@${DOMAIN}`,
					direction: EmailDirection.INBOUND,
					fromEmail: `stale@${DOMAIN}`,
					recipients: [],
					sentAt: older,
				},
			},
		},
		select: { id: true },
	});
	oldThreadId = old.id;

	const completed = await db.activity.create({
		data: {
			type: ActivityType.TASK,
			subject: `WSC Done ${suffix}`,
			dueAt: new Date(Date.now() - 3 * DAY_MS),
			completedAt: new Date(),
			createdById: userId,
			companyId: coveredId,
		},
		select: { id: true },
	});
	completedTaskId = completed.id;
});

afterAll(async () => {
	await clean();
});

describe("TODAY", () => {
	it("returns the overdue task and leaves the completed one out", async () => {
		const summary = await today.summary(userId, { scope: "me" });
		const ids = summary.overdueTasks.map((task) => task.id);

		expect(ids).toContain(overdueTaskId);
		expect(ids).not.toContain(completedTaskId);
		expect(ids).not.toContain(followUpTaskId);
		expect(summary.counts.overdueTasks).toBe(1);
	});

	it("returns the follow-up that falls inside the window", async () => {
		const summary = await today.summary(userId, { scope: "me" });
		const ids = summary.followUps.map((task) => task.id);

		expect(ids).toEqual([followUpTaskId]);
		expect(summary.thresholds.followUpWithinDays).toBe(7);
	});

	it("returns the opportunity that has gone quiet and not the fresh one", async () => {
		const summary = await today.summary(userId, { scope: "me" });
		const ids = summary.staleOpportunities.map((deal) => deal.id);

		expect(ids).toContain(staleDealId);
		expect(ids).not.toContain(freshDealId);
		expect(summary.thresholds.opportunityStaleAfterDays).toBe(21);

		const stale = summary.staleOpportunities.find(
			(deal) => deal.id === staleDealId,
		);
		expect(stale?.quietForDays).toBeGreaterThanOrEqual(
			summary.thresholds.opportunityStaleAfterDays,
		);
	});

	it("returns a reply received inside the window, and not an older one", async () => {
		const summary = await today.summary(userId, { scope: "me" });
		const threads = summary.replies.map((reply) => reply.threadId);

		expect(threads).toContain(replyThreadId);
		expect(threads).not.toContain(oldThreadId);
		expect(summary.thresholds.replySinceDays).toBe(3);

		const reply = summary.replies.find((row) => row.threadId === replyThreadId);
		expect(reply?.fromEmail).toBe(`guest@${DOMAIN}`);
		expect(reply?.company?.id).toBe(gappedId);
	});

	it("leaves out a reply that arrived in somebody else's mailbox", async () => {
		const stranger = await db.user.upsert({
			where: { email: `stranger-${suffix}@example.test` },
			create: {
				id: `wsc-stranger-${suffix}`,
				name: "Another Rep",
				email: `stranger-${suffix}@example.test`,
			},
			update: {},
			select: { id: true },
		});

		await db.emailMessage.updateMany({
			where: { threadId: replyThreadId },
			data: { syncedByUserId: stranger.id },
		});

		const mine = await today.summary(userId, { scope: "me" });
		const everyone = await today.summary(userId, { scope: "everyone" });

		expect(mine.replies.map((reply) => reply.threadId)).not.toContain(
			replyThreadId,
		);
		expect(everyone.replies.map((reply) => reply.threadId)).toContain(
			replyThreadId,
		);

		await db.emailMessage.updateMany({
			where: { threadId: replyThreadId },
			data: { syncedByUserId: userId },
		});
		await db.user.deleteMany({ where: { id: stranger.id } });
	});

	it("stops naming an opportunity once it has activity again", async () => {
		await db.deal.update({
			where: { id: staleDealId },
			data: { lastActivityAt: new Date() },
		});

		const summary = await today.summary(userId, { scope: "me" });
		expect(summary.staleOpportunities.map((deal) => deal.id)).not.toContain(
			staleDealId,
		);

		await db.deal.update({
			where: { id: staleDealId },
			data: {
				lastActivityAt: new Date(
					Date.now() - TODAY.opportunities.staleAfterMs - 2 * DAY_MS,
				),
			},
		});
	});
});

describe("COVERAGE", () => {
	it("names the target business missing a required role", async () => {
		const result = await coverage.gaps({
			scope: "TARGET_BUSINESSES",
			vertical: [],
			entityType: [EntityType.HOTEL],
			includeCovered: false,
		});

		const gapped = result.rows.find((row) => row.id === gappedId);

		expect(result.configured).toBe(true);
		expect(gapped).toBeDefined();
		expect(gapped?.covered).toBe(false);
		expect(gapped?.missing.length).toBe(
			COVERAGE.requiredRoles[EntityType.HOTEL].length - 1,
		);
	});

	it("does not name the target business that has every required role", async () => {
		const result = await coverage.gaps({
			scope: "TARGET_BUSINESSES",
			vertical: [],
			entityType: [EntityType.HOTEL],
			includeCovered: false,
		});

		expect(result.rows.map((row) => row.id)).not.toContain(coveredId);
	});

	it("returns the covered business when asked for it, with its holders", async () => {
		const result = await coverage.gaps({
			scope: "TARGET_BUSINESSES",
			vertical: [],
			entityType: [EntityType.HOTEL],
			includeCovered: true,
		});

		const covered = result.rows.find((row) => row.id === coveredId);

		expect(covered?.covered).toBe(true);
		expect(covered?.missing).toEqual([]);
		for (const role of covered?.roles ?? []) {
			expect(role.filled).toBe(true);
			expect(role.holders.length).toBeGreaterThan(0);
		}
	});

	it("leaves out a business that is not a target", async () => {
		const untargeted = await business(`WSC Untargeted ${suffix}`);

		const result = await coverage.gaps({
			scope: "TARGET_BUSINESSES",
			vertical: [],
			entityType: [EntityType.HOTEL],
			includeCovered: true,
		});

		expect(result.rows.map((row) => row.id)).not.toContain(untargeted);
	});

	it("clamps a stale page to the filtered result range", async () => {
		const result = await coverage.gaps({
			scope: "TARGET_BUSINESSES",
			page: 999,
			pageSize: 25,
			vertical: [],
			entityType: [EntityType.HOTEL],
			includeCovered: true,
		});

		expect(result.page).toBe(1);
		expect(result.rows.length).toBeGreaterThan(0);
	});
});
