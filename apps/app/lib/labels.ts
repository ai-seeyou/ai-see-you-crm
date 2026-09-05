import type { RecordKind } from "@/components/crm/record-sheet/record-stack";

export type RecordNoun = {
	one: string;
	many: string;
	oneLower: string;
	manyLower: string;
};

// The record kinds keep their inherited identifiers everywhere a machine reads
// them: the route segment, the RecordKind union in the ?record= stack, the tRPC
// aliases, the REST paths, the Prisma models and every persisted facet id. Only
// the words a person reads change, and they change here.
export const RECORD_LABEL = {
	company: {
		one: "Business",
		many: "Businesses",
		oneLower: "business",
		manyLower: "businesses",
	},
	contact: {
		one: "Contact",
		many: "Contacts",
		oneLower: "contact",
		manyLower: "contacts",
	},
	deal: {
		one: "Opportunity",
		many: "Opportunities",
		oneLower: "opportunity",
		manyLower: "opportunities",
	},
} as const satisfies Record<RecordKind, RecordNoun>;

export const BUSINESS = RECORD_LABEL.company;
export const CONTACT = RECORD_LABEL.contact;
export const OPPORTUNITY = RECORD_LABEL.deal;

export function recordLabel(kind: RecordKind): string {
	return RECORD_LABEL[kind].one;
}

export function recordLabelPlural(kind: RecordKind): string {
	return RECORD_LABEL[kind].many;
}

export function recordLabelLower(kind: RecordKind): string {
	return RECORD_LABEL[kind].oneLower;
}

export function recordLabelPluralLower(kind: RecordKind): string {
	return RECORD_LABEL[kind].manyLower;
}

export const NEW_OPPORTUNITY = `New ${OPPORTUNITY.oneLower}`;
export const ADD_CONTACT = `Add ${CONTACT.oneLower}`;
export const OPEN_OPPORTUNITIES = `Open ${OPPORTUNITY.manyLower}`;
export const NO_BUSINESS = `No ${BUSINESS.oneLower}`;
export const UNASSIGNED_OWNER = "Unassigned";
