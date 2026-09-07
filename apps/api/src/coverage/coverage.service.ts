import {
	AssignmentScope,
	type ContactRoleType,
	type Db,
	EntityType,
	ExternalRecordType,
	ExternalSystem,
	type Prisma,
} from "@crm/db";
import { Injectable } from "@nestjs/common";
import {
	activeAssignmentWhere,
	businessDimensionFilter,
	hotelGroupMemberships,
} from "../companies/commercial-navigation";
import { InjectDatabase } from "../database/database.constants";
import { FACET_UNASSIGNED, splitSentinel } from "../trpc/list-input";
import { type CoverageInput, coverageInput } from "./coverage.contracts";
import { COVERAGE, requiredRolesFor } from "./coverage-config";

@Injectable()
export class CoverageService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async gaps(input: CoverageInput) {
		input = coverageInput.parse(input) as Required<CoverageInput>;
		const missingRoleTypes = input.missingRoleTypes ?? [];
		const page = input.page ?? 1;
		const pageSize = input.pageSize ?? 25;
		const target =
			input.scope === "TARGET_BUSINESSES" ? await this.targetField() : null;
		const companies = await this.db.company.findMany({
			where: await this.buildWhere(input, target),
			orderBy: [{ name: "asc" }, { id: "asc" }],
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
		const now = new Date();
		const assignments = await this.db.contactAssignment.findMany({
			where: {
				companyId: { in: companies.map(({ id }) => id) },
				...activeAssignmentWhere(now),
			},
			select: {
				companyId: true,
				roleType: true,
				contact: { select: { archivedAt: true } },
			},
		});
		const held = new Map<string, Set<ContactRoleType>>();
		for (const assignment of assignments) {
			if (assignment.contact.archivedAt) continue;
			const roles =
				held.get(assignment.companyId) ?? new Set<ContactRoleType>();
			held.set(assignment.companyId, roles);
			roles.add(assignment.roleType);
		}
		const allRows = companies.map((company) => {
			const evaluatedRoles = [
				...new Set([
					...requiredRolesFor(company.entityType),
					...missingRoleTypes,
				]),
			];
			const roles = evaluatedRoles.map((roleType) => {
				return {
					roleType,
					filled: held.get(company.id)?.has(roleType) ?? false,
					holders: [] as CoverageHolder[],
				};
			});
			const missing = roles
				.filter(({ filled }) => !filled)
				.map(({ roleType }) => roleType);
			return { ...company, roles, missing, covered: missing.length === 0 };
		});
		const gapRows = missingRoleTypes.length
			? allRows.filter((row) =>
					missingRoleTypes.some((role) => row.missing.includes(role)),
				)
			: allRows.filter(({ covered }) => !covered);
		const visible =
			missingRoleTypes.length || !input.includeCovered ? gapRows : allRows;
		const effectivePage = Math.min(
			page,
			Math.max(1, Math.ceil(visible.length / pageSize)),
		);
		const start = (effectivePage - 1) * pageSize;
		const pageRows = visible.slice(start, start + pageSize);
		const pageAssignments = await this.db.contactAssignment.findMany({
			where: {
				companyId: { in: pageRows.map(({ id }) => id) },
				...activeAssignmentWhere(now),
				contact: { archivedAt: null },
			},
			select: {
				companyId: true,
				roleType: true,
				scope: true,
				contact: {
					select: { id: true, firstName: true, lastName: true, email: true },
				},
			},
		});
		for (const row of pageRows)
			for (const role of row.roles) {
				role.holders = pageAssignments
					.filter(
						(assignment) =>
							assignment.companyId === row.id &&
							assignment.roleType === role.roleType,
					)
					.map((assignment) => ({
						id: assignment.contact.id,
						name: [assignment.contact.firstName, assignment.contact.lastName]
							.filter(Boolean)
							.join(" "),
						email: assignment.contact.email,
						scope: assignment.scope,
					}));
			}
		const { memberships, groupById } = await hotelGroupMemberships(
			this.db,
			companies.map(({ id }) => id),
			now,
		);
		const gaps = new Map<
			string,
			{
				hotelCount: number;
				gapCount: number;
				missingByRole: Record<string, number>;
			}
		>();
		for (const row of allRows)
			for (const groupId of memberships.get(row.id) ?? []) {
				const value = gaps.get(groupId) ?? {
					hotelCount: 0,
					gapCount: 0,
					missingByRole: {},
				};
				gaps.set(groupId, value);
				const relevantMissing = missingRoleTypes.length
					? row.missing.filter((role) => missingRoleTypes.includes(role))
					: row.missing;
				value.hotelCount += 1;
				if (relevantMissing.length > 0) value.gapCount += 1;
				for (const role of relevantMissing)
					value.missingByRole[role] = (value.missingByRole[role] ?? 0) + 1;
			}
		return {
			configured: input.scope === "ALL_HOTELS" || target !== null,
			targetFieldKey: COVERAGE.target.fieldKey,
			targetLabels: [...COVERAGE.target.optionLabels],
			truncated: false,
			examined: allRows.length,
			page: effectivePage,
			pageSize,
			total: visible.length,
			summary: {
				targets: allRows.length,
				covered: allRows.length - gapRows.length,
				gaps: gapRows.length,
			},
			rows: pageRows,
			groupGaps: [...gaps]
				.map(([groupId, value]) => ({
					groupId,
					groupName: groupById.get(groupId)?.name ?? groupId,
					...value,
				}))
				.sort(
					(a, b) =>
						b.gapCount - a.gapCount || a.groupName.localeCompare(b.groupName),
				),
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
		return definition?.options.length
			? {
					fieldId: definition.id,
					optionIds: definition.options.map(({ id }) => id),
				}
			: null;
	}

	private async buildWhere(
		input: CoverageInput,
		target: TargetField | null,
	): Promise<Prisma.CompanyWhereInput> {
		const and: Prisma.CompanyWhereInput[] = [{ archivedAt: null }];
		if (input.scope === "ALL_HOTELS") {
			const refs = await this.db.externalRef.findMany({
				where: {
					system: ExternalSystem.PRODUCTION,
					recordType: ExternalRecordType.COMPANY,
					matchMethod: "production-property-id",
					matchedBy: "IMPORT",
					confirmedAt: { not: null },
					staleAt: null,
				},
				select: { recordId: true },
			});
			and.push({
				id: { in: refs.map(({ recordId }) => recordId) },
				entityType: EntityType.HOTEL,
			});
		} else if (target)
			and.push({
				fieldValues: {
					some: { fieldId: target.fieldId, optionId: { in: target.optionIds } },
				},
			});
		else and.push({ id: { in: [] } });
		if (input.entityType.length)
			and.push({ entityType: { in: input.entityType } });
		if (input.vertical.length) {
			const { ids, includesSentinel } = splitSentinel(
				input.vertical,
				FACET_UNASSIGNED,
			);
			and.push(
				includesSentinel
					? { OR: [{ verticalId: { in: ids } }, { verticalId: null }] }
					: { verticalId: { in: ids } },
			);
		}
		and.push(
			await businessDimensionFilter(this.db, {
				countryCodes: input.countryCodes ?? [],
				destinationIds: input.destinationIds ?? [],
				hotelGroupIds: input.hotelGroupIds ?? [],
			}),
		);
		return { AND: and };
	}
}

type TargetField = { fieldId: string; optionIds: string[] };
type CoverageHolder = {
	id: string;
	name: string;
	email: string | null;
	scope: AssignmentScope;
};
