import { ContactRoleType } from "@crm/db/enums";

export const CONTACT_ROLE_ORDER: readonly ContactRoleType[] = [
	ContactRoleType.EXECUTIVE,
	ContactRoleType.OWNER,
	ContactRoleType.GENERAL_MANAGER,
	ContactRoleType.COMMERCIAL,
	ContactRoleType.REVENUE,
	ContactRoleType.DISTRIBUTION,
	ContactRoleType.MARKETING,
	ContactRoleType.DIGITAL,
	ContactRoleType.PROCUREMENT,
	ContactRoleType.OTHER,
];

const PRESENTATION: Record<ContactRoleType, string> = {
	EXECUTIVE: "Executive",
	OWNER: "Owner",
	GENERAL_MANAGER: "General manager",
	COMMERCIAL: "Commercial",
	REVENUE: "Revenue",
	DISTRIBUTION: "Distribution",
	MARKETING: "Marketing",
	DIGITAL: "Digital",
	PROCUREMENT: "Procurement",
	OTHER: "Other",
};

const UNKNOWN = "Unknown role";

export const CONTACT_ROLE_OPTIONS = CONTACT_ROLE_ORDER.map((value) => ({
	value,
	label: PRESENTATION[value],
}));

export function contactRoleLabel(roleType: ContactRoleType): string {
	return PRESENTATION[roleType] ?? UNKNOWN;
}
