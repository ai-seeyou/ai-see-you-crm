import {
	AssignmentScope,
	type ContactRoleType,
	db,
	type EntityType,
	type RelationshipType,
} from "@crm/db";
import {
	ENTITY,
	ENTITY_TYPE_LABELS,
	RELATIONSHIP_LABELS,
	ROLE_TYPE_LABELS,
} from "./entity-config";

const UNREADABLE =
	"The CRM's record of what this business belongs to, who manages it and who " +
	"covers it could not be read, so this session cannot see it. Treat the " +
	"structure as unknown rather than absent, say so in what you write, and do " +
	"not describe this business as standalone.";

const MISSING =
	"There is no such business on file, so there is no structure to read.";

const NOTHING_RECORDED =
	"The CRM records no group, no brand, no manager, no owner and nobody " +
	"covering this business from elsewhere. That is a gap in our records, not " +
	"evidence that the business is independent. Say what we do not know rather " +
	"than describing it as a standalone business.";

const ONLY_CURRENT =
	"Only current records are listed here. A relationship or an assignment that " +
	"has ended is left out, and must never be described as current.";

export type Capped<T> = {
	listed: T[];
	total: number;
	truncated: boolean;
};

export type EntityCompanyRef = {
	id: string;
	name: string;
	domain: string | null;
	entityType: EntityType;
	archived: boolean;
};

export type EntityLink = {
	id: string;
	type: RelationshipType;
	reads: string;
	company: EntityCompanyRef;
	note: string | null;
	since: string | null;
};

export type ResponsiblePerson = {
	id: string;
	name: string;
	title: string | null;
	email: string | null;
	roleType: ContactRoleType;
	role: string;
	employer: { id: string; name: string } | null;
	employedHere: boolean;
	since: string | null;
};

export type CoveredBusiness = {
	id: string;
	name: string;
	domain: string | null;
	entityType: EntityType;
	archived: boolean;
	roleType: ContactRoleType;
	role: string;
	title: string | null;
	since: string | null;
};

export type BusinessStructure =
	| {
			readable: true;
			entityType: EntityType;
			entityTypeLabel: string;
			vertical: { id: string; key: string; label: string } | null;
			partOf: Capped<EntityLink>;
			contains: Capped<EntityLink>;
			responsible: Capped<ResponsiblePerson>;
			recorded: boolean;
			note: string;
	  }
	| { readable: false; reason: string };

export type ContactCoverage =
	| {
			readable: true;
			employer: {
				companyId: string;
				companyName: string;
				roleType: ContactRoleType;
				role: string;
				title: string | null;
				since: string | null;
			} | null;
			responsibleFor: Capped<CoveredBusiness>;
			note: string;
	  }
	| { readable: false; reason: string };

const LINK_COMPANY_SELECT = {
	id: true,
	name: true,
	domain: true,
	entityType: true,
	archivedAt: true,
} as const;

const LINK_SELECT = {
	id: true,
	type: true,
	note: true,
	validFrom: true,
	fromCompany: { select: LINK_COMPANY_SELECT },
	toCompany: { select: LINK_COMPANY_SELECT },
} as const;

export async function readBusinessStructure(
	companyId: string,
): Promise<BusinessStructure> {
	try {
		const company = await db.company.findUnique({
			where: { id: companyId },
			select: {
				entityType: true,
				vertical: { select: { id: true, key: true, label: true } },
			},
		});

		if (!company) return { readable: false, reason: MISSING };

		const current = { validTo: null } as const;

		const [
			partOfRows,
			partOfTotal,
			containsRows,
			containsTotal,
			responsibleRows,
			responsibleTotal,
		] = await Promise.all([
			db.entityRelationship.findMany({
				where: { fromCompanyId: companyId, ...current },
				orderBy: [{ type: "asc" }, { toCompany: { name: "asc" } }],
				take: ENTITY.relationships.partOf,
				select: LINK_SELECT,
			}),
			db.entityRelationship.count({
				where: { fromCompanyId: companyId, ...current },
			}),
			db.entityRelationship.findMany({
				where: { toCompanyId: companyId, ...current },
				orderBy: [{ type: "asc" }, { fromCompany: { name: "asc" } }],
				take: ENTITY.relationships.contains,
				select: LINK_SELECT,
			}),
			db.entityRelationship.count({
				where: { toCompanyId: companyId, ...current },
			}),
			db.contactAssignment.findMany({
				where: {
					companyId,
					scope: AssignmentScope.RESPONSIBLE_FOR,
					contact: { archivedAt: null },
					...current,
				},
				orderBy: [{ roleType: "asc" }, { contact: { firstName: "asc" } }],
				take: ENTITY.responsible.listed,
				select: {
					roleType: true,
					title: true,
					validFrom: true,
					contact: {
						select: {
							id: true,
							firstName: true,
							lastName: true,
							email: true,
							title: true,
							companyId: true,
							company: { select: { id: true, name: true } },
						},
					},
				},
			}),
			db.contactAssignment.count({
				where: {
					companyId,
					scope: AssignmentScope.RESPONSIBLE_FOR,
					contact: { archivedAt: null },
					...current,
				},
			}),
		]);

		const partOf = capped(
			partOfRows.map((row) => toLink(row, row.toCompany)),
			partOfTotal,
		);
		const contains = capped(
			containsRows.map((row) => toLink(row, row.fromCompany)),
			containsTotal,
		);
		const responsible = capped(
			responsibleRows.map((row) => ({
				id: row.contact.id,
				name: fullName(row.contact),
				title: row.title ?? row.contact.title,
				email: row.contact.email,
				roleType: row.roleType,
				role: ROLE_TYPE_LABELS[row.roleType],
				employer: row.contact.company,
				employedHere: row.contact.companyId === companyId,
				since: row.validFrom?.toISOString() ?? null,
			})),
			responsibleTotal,
		);

		const recorded =
			company.entityType !== "OTHER" ||
			company.vertical !== null ||
			partOf.total > 0 ||
			contains.total > 0 ||
			responsible.total > 0;

		return {
			readable: true,
			entityType: company.entityType,
			entityTypeLabel: ENTITY_TYPE_LABELS[company.entityType],
			vertical: company.vertical,
			partOf,
			contains,
			responsible,
			recorded,
			note: recorded ? ONLY_CURRENT : NOTHING_RECORDED,
		};
	} catch (error) {
		report("business structure", companyId, error);
		return { readable: false, reason: UNREADABLE };
	}
}

export async function readContactCoverage(
	contactId: string,
): Promise<ContactCoverage> {
	try {
		const current = { validTo: null } as const;

		const [employerRow, coveredRows, coveredTotal] = await Promise.all([
			db.contactAssignment.findFirst({
				where: {
					contactId,
					scope: AssignmentScope.EMPLOYER,
					isPrimary: true,
					...current,
				},
				select: {
					roleType: true,
					title: true,
					validFrom: true,
					company: { select: { id: true, name: true } },
				},
			}),
			db.contactAssignment.findMany({
				where: {
					contactId,
					scope: AssignmentScope.RESPONSIBLE_FOR,
					company: { archivedAt: null },
					...current,
				},
				orderBy: [{ company: { name: "asc" } }],
				take: ENTITY.coverage.listed,
				select: {
					roleType: true,
					title: true,
					validFrom: true,
					company: {
						select: {
							id: true,
							name: true,
							domain: true,
							entityType: true,
							archivedAt: true,
						},
					},
				},
			}),
			db.contactAssignment.count({
				where: {
					contactId,
					scope: AssignmentScope.RESPONSIBLE_FOR,
					company: { archivedAt: null },
					...current,
				},
			}),
		]);

		const responsibleFor = capped(
			coveredRows.map((row) => ({
				id: row.company.id,
				name: row.company.name,
				domain: row.company.domain,
				entityType: row.company.entityType,
				archived: row.company.archivedAt !== null,
				roleType: row.roleType,
				role: ROLE_TYPE_LABELS[row.roleType],
				title: row.title,
				since: row.validFrom?.toISOString() ?? null,
			})),
			coveredTotal,
		);

		return {
			readable: true,
			employer: employerRow
				? {
						companyId: employerRow.company.id,
						companyName: employerRow.company.name,
						roleType: employerRow.roleType,
						role: ROLE_TYPE_LABELS[employerRow.roleType],
						title: employerRow.title,
						since: employerRow.validFrom?.toISOString() ?? null,
					}
				: null,
			responsibleFor,
			note:
				responsibleFor.total > 0
					? `${ONLY_CURRENT} Anything you learn about one of the businesses they cover is recorded against that business, not against this person.`
					: ONLY_CURRENT,
		};
	} catch (error) {
		report("contact coverage", contactId, error);
		return { readable: false, reason: UNREADABLE };
	}
}

export type SearchStructure = {
	entityType: EntityType;
	entityTypeLabel: string;
	vertical: string | null;
	partOf: { id: string; name: string; reads: string }[];
	partOfTotal: number;
};

export async function structureForHits(
	companyIds: string[],
): Promise<Map<string, SearchStructure["partOf"]>> {
	const found = new Map<string, SearchStructure["partOf"]>();
	if (companyIds.length === 0) return found;

	try {
		const rows = await db.entityRelationship.findMany({
			where: { fromCompanyId: { in: companyIds }, validTo: null },
			orderBy: [{ type: "asc" }, { toCompany: { name: "asc" } }],
			select: {
				fromCompanyId: true,
				type: true,
				toCompany: { select: { id: true, name: true } },
			},
		});

		for (const row of rows) {
			const listed = found.get(row.fromCompanyId) ?? [];
			found.set(row.fromCompanyId, listed);
			if (listed.length >= ENTITY.search.partOf) continue;
			listed.push({
				id: row.toCompany.id,
				name: row.toCompany.name,
				reads: RELATIONSHIP_LABELS[row.type],
			});
		}
	} catch (error) {
		report("search structure", companyIds.join(","), error);
	}

	return found;
}

export async function employerMoveBlock(
	fromCompanyId: string | null,
	toCompanyId: string,
): Promise<string | null> {
	if (!fromCompanyId || fromCompanyId === toCompanyId) return null;

	try {
		const edge = await db.entityRelationship.findFirst({
			where: {
				validTo: null,
				OR: [
					{ fromCompanyId, toCompanyId },
					{ fromCompanyId: toCompanyId, toCompanyId: fromCompanyId },
				],
			},
			select: { type: true },
		});

		if (!edge) return null;

		return (
			"The move was not made. These two businesses are already related in the " +
			`CRM (${RELATIONSHIP_LABELS[edge.type]}), so moving somebody between ` +
			"them is a claim about which entity inside a group employs them, and " +
			"that is a commercial fact a person confirms. A property is not its " +
			"group and a group is not its management company. The change is on the " +
			"timeline for their owner to decide."
		);
	} catch (error) {
		report(
			"relationship between two businesses",
			`${fromCompanyId} and ${toCompanyId}`,
			error,
		);

		return (
			"The move was not made. The CRM's record of how these two businesses " +
			"are related could not be read, so this could not be checked, and an " +
			"unchecked move is the one that puts a property manager on a group. " +
			"The change is on the timeline for their owner to decide."
		);
	}
}

export const NEVER_INVENT =
	"You cannot create or change any of this structure, and no tool here will " +
	"let you. A group, a brand, an owner, a manager, or a person covering a " +
	"business from elsewhere is a commercial fact that a person confirms. " +
	"Record what you find as a fact or in a brief, name the evidence, and leave " +
	"the structure to them.";

export function structureNote(structure: BusinessStructure): string {
	if (!structure.readable) return `${structure.reason} ${NEVER_INVENT}`;
	if (!structure.recorded) return `${NOTHING_RECORDED} ${NEVER_INVENT}`;

	return (
		"`structure` says what kind of business this is, what it is part of, what " +
		"sits under it and who is responsible for it, and it lists only current " +
		"records. Read a property as a property: name its group and its manager " +
		`rather than writing about it as though it stood alone. ${NEVER_INVENT}`
	);
}

export function coverageNote(coverage: ContactCoverage): string {
	if (!coverage.readable) return `${coverage.reason} ${NEVER_INVENT}`;
	if (coverage.responsibleFor.total === 0) return "";

	return (
		`They are recorded as responsible for ${coverage.responsibleFor.total} ` +
		"business(es) they are not employed at. Anything you learn about one of " +
		`those is recorded against that business, not against them. ${NEVER_INVENT}`
	);
}

export function structureMarkdown(
	name: string,
	structure: BusinessStructure,
): string {
	if (!structure.readable) {
		return [`### ${name}, in our records`, "", structure.reason].join("\n");
	}

	const lines = [`### ${name}, in our records`, ""];

	lines.push(
		`Kind of business: **${structure.entityTypeLabel}**.${
			structure.vertical ? ` Vertical: **${structure.vertical.label}**.` : ""
		}`,
	);

	if (structure.partOf.total > 0) {
		lines.push("", `**${name}** is:`, "");
		for (const link of structure.partOf.listed) {
			lines.push(
				`- ${link.reads} **${link.company.name}** \`${link.company.id}\`${suffix(link)}`,
			);
		}
		lines.push(...more(structure.partOf, "more"));
	} else {
		lines.push(
			"",
			`The CRM records no group, brand, manager or owner above **${name}**.`,
		);
	}

	if (structure.contains.total > 0) {
		lines.push(
			"",
			`**${structure.contains.total}** business(es) sit under **${name}**${
				structure.contains.truncated
					? `, of which ${structure.contains.listed.length} are listed`
					: ""
			}:`,
			"",
		);
		for (const link of structure.contains.listed) {
			lines.push(
				`- **${link.company.name}** \`${link.company.id}\` ${link.reads} it${suffix(link)}`,
			);
		}
		lines.push(
			...more(
				structure.contains,
				"more; `read_company_history` on this id returns the same list",
			),
		);
	}

	if (structure.responsible.total > 0) {
		lines.push(
			"",
			`**${structure.responsible.total}** person(s) are recorded as responsible for **${name}**:`,
			"",
		);
		for (const person of structure.responsible.listed) {
			lines.push(
				`- **${person.name}** \`${person.id}\`, ${person.role}${
					person.title ? `, ${person.title}` : ""
				}${
					person.employedHere
						? ", employed here"
						: person.employer
							? `, employed at ${person.employer.name} \`${person.employer.id}\``
							: ", employer not recorded"
				}`,
			);
		}
		lines.push(...more(structure.responsible, "more"));
		lines.push(
			"",
			"Somebody responsible for this business from another payroll is the",
			"person to write to about it. Do not treat their employer as this",
			"business, and do not move them onto it.",
		);
	}

	lines.push("", structure.note);

	return lines.join("\n");
}

export function coverageMarkdown(
	name: string,
	coverage: ContactCoverage,
): string {
	if (!coverage.readable) return coverage.reason;

	const lines: string[] = [];

	if (coverage.employer) {
		lines.push(
			`Their employer is recorded as **${coverage.employer.companyName}** \`${coverage.employer.companyId}\`, role ${coverage.employer.role}${
				coverage.employer.title ? `, ${coverage.employer.title}` : ""
			}.`,
		);
	}

	if (coverage.responsibleFor.total === 0) return lines.join("\n");

	lines.push(
		`**${name}** is recorded as responsible for **${coverage.responsibleFor.total}** business(es)${
			coverage.responsibleFor.truncated
				? `, of which ${coverage.responsibleFor.listed.length} are listed`
				: ""
		}:`,
		"",
	);

	for (const business of coverage.responsibleFor.listed) {
		lines.push(
			`- **${business.name}** \`${business.id}\`${
				business.domain ? ` (${business.domain})` : ""
			}, ${ENTITY_TYPE_LABELS[business.entityType]}, ${business.role}`,
		);
	}

	lines.push(...more(coverage.responsibleFor, "more"));
	lines.push("", coverage.note);

	return lines.join("\n");
}

function more(page: Capped<unknown>, tail: string): string[] {
	if (!page.truncated) return [];
	return [`- …and ${page.total - page.listed.length} ${tail}.`];
}

function suffix(link: EntityLink): string {
	const parts: string[] = [];
	if (link.company.archived) parts.push("archived business");
	if (link.note) parts.push(link.note);
	return parts.length > 0 ? ` (${parts.join("; ")})` : "";
}

function capped<T>(listed: T[], total: number): Capped<T> {
	return { listed, total, truncated: total > listed.length };
}

function toLink(
	row: {
		id: string;
		type: RelationshipType;
		note: string | null;
		validFrom: Date | null;
	},
	company: {
		id: string;
		name: string;
		domain: string | null;
		entityType: EntityType;
		archivedAt: Date | null;
	},
): EntityLink {
	return {
		id: row.id,
		type: row.type,
		reads: RELATIONSHIP_LABELS[row.type],
		company: {
			id: company.id,
			name: company.name,
			domain: company.domain,
			entityType: company.entityType,
			archived: company.archivedAt !== null,
		},
		note: row.note,
		since: row.validFrom?.toISOString() ?? null,
	};
}

function fullName(person: {
	firstName: string;
	lastName: string | null;
}): string {
	return [person.firstName, person.lastName].filter(Boolean).join(" ");
}

function report(what: string, id: string, error: unknown): void {
	console.error(
		`[agent] could not read the ${what} for ${id}: ${
			error instanceof Error ? error.message : String(error)
		}`,
	);
}
