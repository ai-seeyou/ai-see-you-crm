import type { RecordKind } from "@/components/crm/record-sheet/record-stack";
import { RECORD_LABEL, recordLabelPlural } from "@/lib/labels";
import { type FieldEntity, kindOf } from "./fields-entity";

export const SHEET_TITLE = "Fields";

export function subtitleFor(kind: RecordKind): string {
	return `This shapes every ${RECORD_LABEL[kind].oneLower} in your CRM.`;
}

export const STANDARD_ROW = "Standard fields";
export const STANDARD_NOTE = "reorder and hide only";
export const SUGGESTED_ROW = "Suggested fields";
export const SUGGESTED_NOTE = "one click to add";
export const ADD = "Add";
export const CUSTOM_GROUP = "Custom fields";
export const DRAG_NOTE = "Drag to order";
export const ARCHIVED_ROW = "Archived";
export const ARCHIVED_NOTE = "values kept, hidden everywhere";
export const NEW_FIELD = "New field";
export const ORDER_NOTE = "Order here is the order on the sheet";
export const MANUAL_ONLY = "Manual only";
export const TABLE_NOTE = "also a column on the table";
export const FILTER_NOTE = "also a filter";

export const EMPTY_TITLE = "No custom fields yet";
export const EMPTY_BODY =
	"Create dynamic fields that your agents can research and pre-fill.";

export const ERROR_TITLE = "We could not load your fields";
export const ERROR_BODY =
	"Your fields are still there. Try again in a moment, before you create anything new.";
export const RETRY = "Try again";

export const LABEL_LABEL = "Label";
export const KEY_LABEL = "Key";
export const KEY_HELP =
	"What the API and your agents call it. Set from the label, fixed once saved — renaming the label later never breaks a caller.";
export const AGENT_LABEL = "Let your agents fill this";
export const AGENT_HELP =
	"They propose a value with a source, and never overwrite yours.";
export const BRIEF_LABEL = "What counts as an answer";
export const BRIEF_HELP =
	"Leave it empty and your agents work from the label and type alone.";
export const TYPE_LABEL = "Type";
export const OPTIONS_LABEL = "Options";
export const ADD_OPTION = "Add option";
export const ALL_FILLED = "Nothing left to fill";

export function optionLabel(index: number): string {
	return `Option ${index + 1}`;
}
export const ADD_FIELD = "Create field";
export const CANCEL = "Cancel";
export const SAVE = "Save changes";
export const ARCHIVE = "Archive";
export const FILL_REST = "Fill the rest";

export function sheetPlacement(entity: FieldEntity): string {
	return `Show on the ${RECORD_LABEL[kindOf(entity)].oneLower} sheet`;
}

export function tablePlacement(entity: FieldEntity): string {
	return `Offer as a column on the ${recordLabelPlural(kindOf(entity))} table`;
}

export function filterPlacement(entity: FieldEntity): string {
	return `Offer as a filter on the ${recordLabelPlural(kindOf(entity))} table`;
}

export const ENTITY_TABS: readonly { kind: RecordKind; label: string }[] = (
	["company", "contact", "deal"] as const
).map((kind) => ({ kind, label: recordLabelPlural(kind) }));
