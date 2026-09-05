import type { ContactRoleType, Db, Prisma } from "@crm/db";
import { Injectable } from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";
import { FACET_UNASSIGNED, splitSentinel } from "../trpc/list-input";
import type { CoverageInput } from "./coverage.contracts";
import { COVERAGE, requiredRolesFor } from "./coverage-config";

const EMPTY = {
	configured: false,
	targetFieldKey: COVERAGE.target.fieldKey,
	targetLabels: [...COVERAGE.target.optionLabels],
	truncated: false,
	examined: 0,
	summary: { targets: 0, covered: 0, gaps: 0 },
	rows: [],
};

@Injectable()
export class CoverageService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async gaps(input: CoverageInput) {
		const target = await this.targetField();
		if (!target) return EMPTY;

		const where = this.buildWhere(input, target);

		// The summary counts the population, not the page. Counting the page made
		// both numbers understate the moment the target list passed the cap, and a
		// coverage figure that quietly shrinks is worse than no figure.
		const total = await this.db.company.count({ where });

		const companies = await this.db.company.findMany({
			where,
			orderBy: [{ name: "asc" }],
			take: COVERAGE.page.maxBusinesses + 1,
			select: {
				id: true,
				name: true,
				domain: true,
				entityType: true,
				iconUrl: true,
				iconDarkUrl: true,
				iconTone: true,
				vertical: { select: { id: true, key: true, label: true } },
			},
		});

		const truncated = companies.length > COVERAGE.page.maxBusinesses;
		const page = truncated
			? companies.slice(0, COVERAGE.page.maxBusinesses)
			: companies;

		const assignments = await this.db.contactAssignment.findMany({
			where: {
				companyId: { in: page.map((company) => company.id) },
				validTo: null,
			},
			select: {
				companyId: true,
				roleType: true,
				scope: true,
				contact: {
					select: {
						id: true,
						firstName: true,
						lastName: true,
						email: true,
						archivedAt: true,
					},
				},
			},
		});

		const held = new Map<string, Map<ContactRoleType, CoverageHolder[]>>();
		for (const row of assignments) {
			if (row.contact.archivedAt !== null) continue;
			const byRole = held.get(row.companyId) ?? new Map();
			held.set(row.companyId, byRole);
			const holders = byRole.get(row.roleType) ?? [];
			byRole.set(row.roleType, holders);
			holders.push({
				id: row.contact.id,
				name: [row.contact.firstName, row.contact.lastName]
					.filter(Boolean)
					.join(" "),
				email: row.contact.email,
				scope: row.scope,
			});
		}

		const rows = page.map((company) => {
			const byRole = held.get(company.id);
			const roles = requiredRolesFor(company.entityType).map((roleType) => {
				const holders = byRole?.get(roleType) ?? [];
				return { roleType, filled: holders.length > 0, holders };
			});
			const missing = roles
				.filter((role) => !role.filled)
				.map((role) => role.roleType);

			return {
				...company,
				roles,
				missing,
				covered: missing.length === 0,
			};
		});

		const visible = input.includeCovered
			? rows
			: rows.filter((row) => !row.covered);

		return {
			configured: true,
			targetFieldKey: COVERAGE.target.fieldKey,
			targetLabels: [...COVERAGE.target.optionLabels],
			truncated,
			examined: rows.length,
			summary: {
				targets: total,
				covered: rows.filter((row) => row.covered).length,
				gaps: rows.filter((row) => !row.covered).length,
			},
			rows: visible,
		};
	}

	private async targetField(): Promise<TargetField | null> {
		const definition = await this.db.fieldDefinition.findFirst({
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

		if (!definition || definition.options.length === 0) return null;

		return {
			fieldId: definition.id,
			optionIds: definition.options.map((option) => option.id),
		};
	}

	private buildWhere(
		input: CoverageInput,
		target: TargetField,
	): Prisma.CompanyWhereInput {
		const and: Prisma.CompanyWhereInput[] = [
			{ archivedAt: null },
			{
				fieldValues: {
					some: {
						fieldId: target.fieldId,
						optionId: { in: target.optionIds },
					},
				},
			},
		];

		if (input.entityType.length > 0) {
			and.push({ entityType: { in: input.entityType } });
		}

		if (input.vertical.length > 0) {
			const { ids, includesSentinel } = splitSentinel(
				input.vertical,
				FACET_UNASSIGNED,
			);
			if (includesSentinel && ids.length === 0) {
				and.push({ verticalId: null });
			} else if (includesSentinel) {
				and.push({ OR: [{ verticalId: { in: ids } }, { verticalId: null }] });
			} else {
				and.push({ verticalId: { in: ids } });
			}
		}

		return { AND: and };
	}
}

type TargetField = { fieldId: string; optionIds: string[] };

type CoverageHolder = {
	id: string;
	name: string;
	email: string | null;
	scope: "EMPLOYER" | "RESPONSIBLE_FOR";
};
