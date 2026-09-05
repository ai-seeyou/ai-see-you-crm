import type { Db } from "@crm/db";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ContactAssignmentService } from "../contacts/contact-assignment.service";
import { blankToNull } from "../crm/values";
import { InjectDatabase } from "../database/database.constants";
import {
	COMPANY_ASSIGNMENT_SELECT,
	CONTACT_ASSIGNMENT_SELECT,
	serializeCompanyAssignment,
	serializeContactAssignment,
} from "./assignment-rows";
import type {
	AssignInput,
	AssignManyInput,
	AssignmentsForCompanyInput,
	AssignmentsForContactInput,
	EndAssignmentInput,
} from "./assignments.contracts";

@Injectable()
export class AssignmentsService {
	private readonly logger = new Logger(AssignmentsService.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly writer: ContactAssignmentService,
	) {}

	async forCompany(input: AssignmentsForCompanyInput) {
		const company = await this.db.company.findUnique({
			where: { id: input.companyId },
			select: { id: true },
		});
		if (!company) {
			throw new NotFoundException(`No business with id ${input.companyId}.`);
		}

		const rows = await this.db.contactAssignment.findMany({
			where: {
				companyId: input.companyId,
				scope: { in: input.scope },
				validTo: input.includeEnded ? undefined : null,
			},
			orderBy: [
				{ roleType: "asc" },
				{ contact: { lastName: "asc" } },
				{ contact: { firstName: "asc" } },
			],
			select: COMPANY_ASSIGNMENT_SELECT,
		});

		return {
			companyId: input.companyId,
			rows: rows.map(serializeCompanyAssignment),
		};
	}

	async forContact(input: AssignmentsForContactInput) {
		const contact = await this.db.contact.findUnique({
			where: { id: input.contactId },
			select: { id: true },
		});
		if (!contact) {
			throw new NotFoundException(`No contact with id ${input.contactId}.`);
		}

		const rows = await this.db.contactAssignment.findMany({
			where: {
				contactId: input.contactId,
				scope: { in: input.scope },
				validTo: input.includeEnded ? undefined : null,
			},
			orderBy: [{ company: { name: "asc" } }],
			select: CONTACT_ASSIGNMENT_SELECT,
		});

		return {
			contactId: input.contactId,
			rows: rows.map(serializeContactAssignment),
		};
	}

	async assign(input: AssignInput) {
		await this.requireContact(input.contactId);
		await this.requireCompanies([input.companyId]);

		const id = await this.writer.assignResponsibility({
			contactId: input.contactId,
			companyId: input.companyId,
			roleType: input.roleType,
			title: blankToNull(input.title ?? ""),
			validFrom: input.validFrom ? new Date(input.validFrom) : undefined,
		});

		this.logger.log({
			message: "Responsibility assigned",
			contactId: input.contactId,
			companyId: input.companyId,
		});

		return {
			id,
			contactId: input.contactId,
			companyId: input.companyId,
			roleType: input.roleType,
		};
	}

	async assignMany(input: AssignManyInput) {
		await this.requireContact(input.contactId);
		const companyIds = [...new Set(input.companyIds)];
		await this.requireCompanies(companyIds);

		const ids = await this.writer.assignResponsibilities({
			contactId: input.contactId,
			companyIds,
			roleType: input.roleType,
			title: blankToNull(input.title ?? ""),
			validFrom: input.validFrom ? new Date(input.validFrom) : undefined,
		});

		this.logger.log({
			message: "Responsibilities assigned",
			contactId: input.contactId,
			count: ids.length,
		});

		return {
			contactId: input.contactId,
			ids,
			requested: companyIds.length,
			succeeded: ids.length,
		};
	}

	async end(input: EndAssignmentInput) {
		const ended = await this.writer.endResponsibility({
			contactId: input.contactId,
			companyId: input.companyId,
			at: input.at ? new Date(input.at) : undefined,
		});

		if (!ended) {
			throw new NotFoundException(
				"That contact is not currently responsible for this business.",
			);
		}

		this.logger.log({
			message: "Responsibility ended",
			contactId: input.contactId,
			companyId: input.companyId,
		});

		return {
			contactId: input.contactId,
			companyId: input.companyId,
			ended: true,
		};
	}

	private async requireContact(contactId: string): Promise<void> {
		const contact = await this.db.contact.findUnique({
			where: { id: contactId },
			select: { id: true },
		});
		if (!contact) {
			throw new NotFoundException(`No contact with id ${contactId}.`);
		}
	}

	private async requireCompanies(companyIds: string[]): Promise<void> {
		const found = await this.db.company.findMany({
			where: { id: { in: companyIds } },
			select: { id: true },
		});
		if (found.length === companyIds.length) return;

		const known = new Set(found.map((row) => row.id));
		const missing = companyIds.filter((id) => !known.has(id));
		throw new NotFoundException(`No business with id ${missing.join(", ")}.`);
	}
}
