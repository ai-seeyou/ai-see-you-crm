import type { Prisma } from "@crm/db";

const ASSIGNMENT_CONTACT_SELECT = {
	id: true,
	firstName: true,
	lastName: true,
	email: true,
	title: true,
	imageUrl: true,
	company: { select: { id: true, name: true } },
} as const;

const ASSIGNMENT_COMPANY_SELECT = {
	id: true,
	name: true,
	domain: true,
	entityType: true,
	iconUrl: true,
	iconDarkUrl: true,
	iconTone: true,
} as const;

export const COMPANY_ASSIGNMENT_SELECT = {
	id: true,
	scope: true,
	roleType: true,
	title: true,
	isPrimary: true,
	validFrom: true,
	validTo: true,
	contact: { select: ASSIGNMENT_CONTACT_SELECT },
} as const;

export const CONTACT_ASSIGNMENT_SELECT = {
	id: true,
	scope: true,
	roleType: true,
	title: true,
	isPrimary: true,
	validFrom: true,
	validTo: true,
	company: { select: ASSIGNMENT_COMPANY_SELECT },
} as const;

type CompanyAssignmentRow = Prisma.ContactAssignmentGetPayload<{
	select: typeof COMPANY_ASSIGNMENT_SELECT;
}>;

type ContactAssignmentRow = Prisma.ContactAssignmentGetPayload<{
	select: typeof CONTACT_ASSIGNMENT_SELECT;
}>;

function period(row: { validFrom: Date | null; validTo: Date | null }) {
	return {
		validFrom: row.validFrom?.toISOString() ?? null,
		validTo: row.validTo?.toISOString() ?? null,
	};
}

export function serializeCompanyAssignment(row: CompanyAssignmentRow) {
	const { contact, ...rest } = row;
	return {
		...rest,
		...period(row),
		contact: {
			id: contact.id,
			firstName: contact.firstName,
			lastName: contact.lastName,
			email: contact.email,
			title: contact.title,
			imageUrl: contact.imageUrl,
			employerId: contact.company?.id ?? null,
			employerName: contact.company?.name ?? null,
		},
	};
}

export function serializeContactAssignment(row: ContactAssignmentRow) {
	return { ...row, ...period(row) };
}
