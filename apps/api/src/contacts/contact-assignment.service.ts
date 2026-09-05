import {
	AssignmentScope,
	type ContactRoleType,
	type Db,
	type Prisma,
	type RecordSource,
} from "@crm/db";
import { parse } from "@crm/validation";
import {
	type RelationshipEvidence,
	relationshipEvidence,
} from "@crm/validation/relationship-evidence";
import { Injectable, NotFoundException } from "@nestjs/common";
import { blankToNull } from "../crm/values";
import { InjectDatabase } from "../database/database.constants";

type Writer = Prisma.TransactionClient;

export type EmployerInput = {
	contactId: string;
	companyId: string | null;
	roleType?: ContactRoleType;
	title?: string | null;
};

export type ResponsibilityInput = {
	contactId: string;
	companyId: string;
	roleType: ContactRoleType;
	title?: string | null;
	source?: RecordSource;
	evidence?: RelationshipEvidence;
	validFrom?: Date;
};

export type BulkResponsibilityInput = Omit<ResponsibilityInput, "companyId"> & {
	companyIds: readonly string[];
};

@Injectable()
export class ContactAssignmentService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async setEmployer(input: EmployerInput): Promise<void> {
		await this.db.$transaction(async (tx) => {
			const moved = await tx.contact.updateMany({
				where: { id: input.contactId },
				data: { companyId: input.companyId },
			});
			if (moved.count === 0) {
				throw new NotFoundException("That contact no longer exists.");
			}

			if (input.companyId === null) return;
			if (input.roleType === undefined && input.title === undefined) return;

			await tx.contactAssignment.updateMany({
				where: {
					contactId: input.contactId,
					companyId: input.companyId,
					scope: AssignmentScope.EMPLOYER,
					validTo: null,
				},
				data: {
					roleType: input.roleType,
					title:
						input.title === undefined
							? undefined
							: blankToNull(input.title ?? ""),
				},
			});
		});
	}

	async assignResponsibility(input: ResponsibilityInput): Promise<string> {
		return this.db.$transaction((tx) => this.responsibility(tx, input));
	}

	async assignResponsibilities(
		input: BulkResponsibilityInput,
	): Promise<string[]> {
		const { companyIds, ...rest } = input;
		return this.db.$transaction(async (tx) => {
			const ids: string[] = [];
			for (const companyId of new Set(companyIds)) {
				ids.push(await this.responsibility(tx, { ...rest, companyId }));
			}
			return ids;
		});
	}

	async endResponsibility(input: {
		contactId: string;
		companyId: string;
		at?: Date;
	}): Promise<boolean> {
		const ended = await this.db.contactAssignment.updateMany({
			where: {
				contactId: input.contactId,
				companyId: input.companyId,
				scope: AssignmentScope.RESPONSIBLE_FOR,
				validTo: null,
			},
			data: { validTo: input.at ?? new Date() },
		});

		return ended.count > 0;
	}

	private async responsibility(
		tx: Writer,
		input: ResponsibilityInput,
	): Promise<string> {
		const evidence =
			input.evidence === undefined
				? undefined
				: parse(relationshipEvidence, input.evidence, "Assignment evidence");

		const title =
			input.title === undefined ? undefined : blankToNull(input.title ?? "");

		const current = await tx.contactAssignment.findFirst({
			where: {
				contactId: input.contactId,
				companyId: input.companyId,
				scope: AssignmentScope.RESPONSIBLE_FOR,
				validTo: null,
			},
			select: { id: true },
		});

		if (current) {
			await tx.contactAssignment.update({
				where: { id: current.id },
				data: {
					roleType: input.roleType,
					title,
					evidence,
					source: input.source,
				},
				select: { id: true },
			});
			return current.id;
		}

		const created = await tx.contactAssignment.create({
			data: {
				contactId: input.contactId,
				companyId: input.companyId,
				scope: AssignmentScope.RESPONSIBLE_FOR,
				roleType: input.roleType,
				isPrimary: false,
				title: title ?? null,
				evidence,
				source: input.source,
				validFrom: input.validFrom ?? new Date(),
			},
			select: { id: true },
		});

		return created.id;
	}
}
