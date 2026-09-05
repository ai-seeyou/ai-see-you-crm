import { db } from "@crm/db";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { sensitiveWrite } from "../lib/approval";
import { writeTimelineNote } from "../lib/crm";
import { employerMoveBlock } from "../lib/entities";
import { lastEmployerChange } from "../lib/facts";
import { focusOn } from "../lib/focus";
import { assertResearchPurpose } from "../lib/session-purpose";

export default defineTool({
	description:
		"Raise a job change on a contact's timeline and task their owner. Reads the change from the facts already recorded; call it after recording a new employer.",
	inputSchema: z.object({
		contactId: z.string(),
		moveToCompanyId: z
			.string()
			.optional()
			.describe(
				"Only when the new employer is already a company in the CRM and a person has approved the move. A move between two businesses that are already related in the CRM, a property and its group, a group and its management company, is refused: which entity inside a group employs somebody is a commercial fact a person confirms.",
			),
	}),
	approval: sensitiveWrite(
		"Raise the change without `moveToCompanyId`, the alert lands on the timeline and their owner decides whether to move them.",
	),
	async execute({ contactId, moveToCompanyId }, ctx) {
		assertResearchPurpose(ctx);
		focusOn({ contactId });
		return recordJobChange({ contactId, moveToCompanyId });
	},
});

export async function recordJobChange({
	contactId,
	moveToCompanyId,
}: {
	contactId: string;
	moveToCompanyId?: string;
}) {
	const change = await lastEmployerChange(contactId);
	if (!change) {
		return {
			raised: false as const,
			reason: "No employer change on the facts for this contact.",
		};
	}

	const contact = await db.contact.findUnique({
		where: { id: contactId },
		select: {
			firstName: true,
			lastName: true,
			ownerId: true,
			companyId: true,
		},
	});
	if (!contact) return { raised: false as const, reason: "No such contact." };
	const destination = moveToCompanyId
		? await db.company.findUnique({
				where: { id: moveToCompanyId },
				select: { id: true },
			})
		: null;
	if (moveToCompanyId && !destination) {
		return { raised: false as const, reason: "No such destination company." };
	}

	const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ");
	const blocked = moveToCompanyId
		? await employerMoveBlock(contact.companyId, moveToCompanyId)
		: null;
	const subject = blocked
		? `${name} reported a possible employer change`
		: `${name} has moved to ${change.to}`;
	const detail = [
		`${name} appears to have left ${change.from} for ${change.to}.`,
		change.sourceUrl ?? "",
		blocked ?? "",
		"",
		"Worth a conversation either way: a champion in a new seat is the",
		"warmest introduction there is, and their replacement at the old",
		"account is a relationship nobody owns yet.",
	]
		.filter(Boolean)
		.join("\n");

	await writeTimelineNote(contactId, subject, detail, {
		source: "job-change",
		from: change.from,
		to: change.to,
		blocked,
	});

	if (moveToCompanyId && !blocked) {
		await db.contact.update({
			where: { id: contactId },
			data: { companyId: moveToCompanyId },
		});
	}

	return {
		raised: true as const,
		from: change.from,
		to: change.to,
		moved: Boolean(moveToCompanyId) && blocked === null,
		blocked,
		ownerNotified: contact.ownerId !== null,
	};
}
