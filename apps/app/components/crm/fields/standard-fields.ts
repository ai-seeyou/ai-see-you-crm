import { BUSINESS } from "@/lib/labels";
import type { FieldEntity } from "./fields-entity";

export const STANDARD_FIELDS = {
	COMPANY: [
		"Name",
		"Domain",
		"Website",
		"Phone",
		"Email",
		"City",
		"Country",
		"Vertical",
		"Type",
		"Owner",
	],
	CONTACT: [
		"First name",
		"Last name",
		"Title",
		"Email",
		"Phone",
		"LinkedIn",
		"GitHub",
		BUSINESS.one,
		"Owner",
	],
	DEAL: [
		"Name",
		"Amount",
		"Currency",
		"Close date",
		BUSINESS.one,
		"Owner",
		"Stage",
	],
} satisfies Record<FieldEntity, readonly string[]>;
