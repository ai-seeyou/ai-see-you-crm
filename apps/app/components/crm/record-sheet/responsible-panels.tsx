"use client";

import Add from "@carbon/icons-react/es/Add";
import Close from "@carbon/icons-react/es/Close";
import UserRole from "@carbon/icons-react/es/UserRole";
import { ContactRoleType } from "@crm/db/enums";
import { Button } from "@crm/ui/components/button";
import { EmptyCellValue } from "@crm/ui/components/empty-cell";
import {
	EntityLogo,
	type EntityLogoTone,
} from "@crm/ui/components/entity-logo";
import { Field, FieldLabel } from "@crm/ui/components/field";
import { Icon } from "@crm/ui/components/icon";
import { PersonAvatar } from "@crm/ui/components/person-avatar";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { SimpleTable, SimpleTableRow } from "@crm/ui/components/simple-table";
import { TableCell } from "@crm/ui/components/table";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@crm/ui/components/tooltip";
import { useMutation } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { CompanyPicker } from "@/components/crm/company-picker";
import { DetailSheetEmpty } from "@/components/detail-sheet";
import { LocalDay } from "@/components/local-date-time";
import { CONTACT_ROLE_OPTIONS, contactRoleLabel } from "@/lib/contact-role";
import { entityTypeLabel } from "@/lib/entity-type";
import { BUSINESS, CONTACT } from "@/lib/labels";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { ContactPicker } from "../contact-picker";
import { QuickAddForm } from "./quick-add";
import { AddRow } from "./record-parts";
import { useOpenRecord } from "./record-stack";

type Company = RouterOutputs["companies"]["byId"];
type CompanyAssignment = Company["assignments"][number];
type Contact = RouterOutputs["contacts"]["byId"];
type ContactAssignment = Contact["responsibleFor"][number];

const ADD_BUSINESS_LABEL = `Add ${BUSINESS.oneLower}`;

const ADD_PERSON_LABEL = `Add ${CONTACT.oneLower}`;

const PEOPLE_COLUMNS = [
	{ id: "name", header: "Name", width: "w-[28%]", className: "pl-5" },
	{ id: "role", header: "Role", width: "w-[20%]" },
	{ id: "employer", header: "Works at", width: "w-[26%]" },
	{ id: "since", header: "Since", width: "w-[16%]" },
	{ id: "end", srLabel: "End responsibility", width: "w-10" },
];

const BUSINESS_COLUMNS = [
	{ id: "company", header: BUSINESS.one, width: "w-[32%]", className: "pl-5" },
	{ id: "kind", header: "Type", width: "w-[20%]" },
	{ id: "role", header: "Role", width: "w-[20%]" },
	{ id: "since", header: "Since", width: "w-[16%]" },
	{ id: "end", srLabel: "End responsibility", width: "w-10" },
];

function personName(contact: { firstName: string; lastName: string | null }) {
	return [contact.firstName, contact.lastName].filter(Boolean).join(" ");
}

export function CompanyResponsible({
	company,
	adding,
	onAdd,
	onDone,
}: {
	company: Company;
	adding: boolean;
	onAdd: () => void;
	onDone: () => void;
}) {
	const openRecord = useOpenRecord();

	const form = adding ? (
		<AddResponsiblePerson company={company} onDone={onDone} />
	) : null;

	if (company.assignments.length === 0) {
		return (
			<>
				{form}
				{adding ? null : (
					<DetailSheetEmpty
						icon={UserRole}
						title="Nobody is responsible yet"
						description={`People who cover ${company.name} from somewhere else, a group office or a management company, appear here. They keep their own employer.`}
						action={
							<Button variant="outline" size="sm" onClick={onAdd}>
								<Icon icon={Add} data-icon="inline-start" />
								{ADD_PERSON_LABEL}
							</Button>
						}
					/>
				)}
			</>
		);
	}

	return (
		<>
			{form}
			<SimpleTable variant="panel" columns={PEOPLE_COLUMNS}>
				{company.assignments.map((assignment) => (
					<PersonRow
						key={assignment.id}
						companyId={company.id}
						assignment={assignment}
						onOpen={() =>
							openRecord({ kind: "contact", id: assignment.contact.id })
						}
					/>
				))}

				<AddRow
					label={ADD_PERSON_LABEL}
					columns={PEOPLE_COLUMNS.length}
					onClick={onAdd}
				/>
			</SimpleTable>
		</>
	);
}

function AddResponsiblePerson({
	company,
	onDone,
}: {
	company: Company;
	onDone: () => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();

	const [contactId, setContactId] = useState("");
	const [roleType, setRoleType] = useState<ContactRoleType>(
		ContactRoleType.COMMERCIAL,
	);

	const contactFieldId = useId();
	const roleFieldId = useId();

	const assign = useMutation(
		trpc.assignments.assign.mutationOptions({
			onSuccess: async (row) => {
				await cache.assignment(row.contactId, row.companyId);
				toast.success("Responsibility recorded.");
				onDone();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<QuickAddForm
			submitLabel={ADD_PERSON_LABEL}
			pending={assign.isPending}
			ready={contactId !== ""}
			onCancel={onDone}
			onSubmit={() =>
				assign.mutate({ contactId, companyId: company.id, roleType })
			}
		>
			<Field>
				<FieldLabel htmlFor={contactFieldId}>{CONTACT.one}</FieldLabel>
				<ContactPicker
					id={contactFieldId}
					value={contactId}
					onValueChange={setContactId}
				/>
			</Field>
			<Field>
				<FieldLabel htmlFor={roleFieldId}>Role</FieldLabel>
				<Select
					value={roleType}
					onValueChange={(next) => setRoleType(next as ContactRoleType)}
				>
					<SelectTrigger id={roleFieldId}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{CONTACT_ROLE_OPTIONS.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</Field>
		</QuickAddForm>
	);
}

function PersonRow({
	companyId,
	assignment,
	onOpen,
}: {
	companyId: string;
	assignment: CompanyAssignment;
	onOpen: () => void;
}) {
	const end = useEndAssignment(assignment.contact.id, companyId);
	const contact = assignment.contact;

	return (
		<SimpleTableRow clickable onClick={onOpen}>
			<TableCell className="truncate py-2.5 pr-3 pl-5 font-medium">
				<span className="flex min-w-0 items-center gap-2">
					<PersonAvatar
						src={contact.imageUrl}
						name={personName(contact)}
						email={contact.email}
						size="sm"
					/>
					<span className="truncate">{personName(contact)}</span>
				</span>
			</TableCell>
			<TableCell className="truncate px-3 py-2.5">
				{contactRoleLabel(assignment.roleType)}
			</TableCell>
			<TableCell className="truncate px-3 py-2.5 text-muted-foreground">
				{contact.employerName ?? <EmptyCellValue />}
			</TableCell>
			<TableCell className="px-3 py-2.5 text-muted-foreground">
				{assignment.validFrom ? (
					<LocalDay date={assignment.validFrom} />
				) : (
					<EmptyCellValue />
				)}
			</TableCell>
			<TableCell className="w-10 py-2.5 pr-3">
				<EndButton pending={end.isPending} onEnd={() => end.mutate()} />
			</TableCell>
		</SimpleTableRow>
	);
}

export function ContactResponsibleFor({
	contact,
	adding,
	onAdd,
	onDone,
}: {
	contact: Contact;
	adding: boolean;
	onAdd: () => void;
	onDone: () => void;
}) {
	const form = adding ? (
		<AddResponsibility contact={contact} onDone={onDone} />
	) : null;

	if (contact.responsibleFor.length === 0) {
		return (
			<>
				{form}
				{adding ? null : (
					<DetailSheetEmpty
						icon={UserRole}
						title={`Not responsible for any ${BUSINESS.oneLower}`}
						description={`A group director covers properties that do not employ them. Record those here and each property shows this person under People responsible.`}
						action={
							<Button variant="outline" size="sm" onClick={onAdd}>
								<Icon icon={Add} data-icon="inline-start" />
								{ADD_BUSINESS_LABEL}
							</Button>
						}
					/>
				)}
			</>
		);
	}

	return (
		<>
			{form}
			<SimpleTable variant="panel" columns={BUSINESS_COLUMNS}>
				{contact.responsibleFor.map((assignment) => (
					<BusinessRow
						key={assignment.id}
						contactId={contact.id}
						assignment={assignment}
					/>
				))}

				<AddRow
					label={ADD_BUSINESS_LABEL}
					columns={BUSINESS_COLUMNS.length}
					onClick={onAdd}
				/>
			</SimpleTable>
		</>
	);
}

function BusinessRow({
	contactId,
	assignment,
}: {
	contactId: string;
	assignment: ContactAssignment;
}) {
	const openRecord = useOpenRecord();
	const end = useEndAssignment(contactId, assignment.company.id);
	const company = assignment.company;

	return (
		<SimpleTableRow
			clickable
			onClick={() => openRecord({ kind: "company", id: company.id })}
		>
			<TableCell className="truncate py-2.5 pr-3 pl-5 font-medium">
				<span className="flex min-w-0 items-center gap-2">
					<EntityLogo
						src={company.iconUrl}
						darkSrc={company.iconDarkUrl}
						tone={company.iconTone as EntityLogoTone | null | undefined}
						name={company.name}
						size="sm"
					/>
					<span className="truncate">{company.name}</span>
				</span>
			</TableCell>
			<TableCell className="truncate px-3 py-2.5 text-muted-foreground">
				{entityTypeLabel(company.entityType)}
			</TableCell>
			<TableCell className="truncate px-3 py-2.5">
				{contactRoleLabel(assignment.roleType)}
			</TableCell>
			<TableCell className="px-3 py-2.5 text-muted-foreground">
				{assignment.validFrom ? (
					<LocalDay date={assignment.validFrom} />
				) : (
					<EmptyCellValue />
				)}
			</TableCell>
			<TableCell className="w-10 py-2.5 pr-3">
				<EndButton pending={end.isPending} onEnd={() => end.mutate()} />
			</TableCell>
		</SimpleTableRow>
	);
}

function EndButton({
	pending,
	onEnd,
}: {
	pending: boolean;
	onEnd: () => void;
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					variant="ghost"
					size="icon-xs"
					disabled={pending}
					onClick={(event) => {
						event.stopPropagation();
						onEnd();
					}}
				>
					<Icon icon={Close} />
					<span className="sr-only">End this responsibility</span>
				</Button>
			</TooltipTrigger>
			<TooltipContent>End this responsibility</TooltipContent>
		</Tooltip>
	);
}

function useEndAssignment(contactId: string, companyId: string) {
	const trpc = useTRPC();
	const cache = useCrmCache();

	const mutation = useMutation(
		trpc.assignments.end.mutationOptions({
			onSuccess: async () => {
				await cache.assignment(contactId, companyId);
				toast.success("Responsibility ended.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return {
		isPending: mutation.isPending,
		mutate: () => mutation.mutate({ contactId, companyId }),
	};
}

function AddResponsibility({
	contact,
	onDone,
}: {
	contact: Contact;
	onDone: () => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();

	const [companyId, setCompanyId] = useState("");
	const [roleType, setRoleType] = useState<ContactRoleType>(
		ContactRoleType.COMMERCIAL,
	);

	const companyFieldId = useId();
	const roleFieldId = useId();

	const assign = useMutation(
		trpc.assignments.assign.mutationOptions({
			onSuccess: async (row) => {
				await cache.assignment(row.contactId, row.companyId);
				toast.success("Responsibility recorded.");
				onDone();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<QuickAddForm
			submitLabel={ADD_BUSINESS_LABEL}
			pending={assign.isPending}
			ready={companyId !== ""}
			onCancel={onDone}
			onSubmit={() =>
				assign.mutate({ contactId: contact.id, companyId, roleType })
			}
		>
			<Field>
				<FieldLabel htmlFor={companyFieldId}>{BUSINESS.one}</FieldLabel>
				<CompanyPicker
					id={companyFieldId}
					value={companyId}
					onValueChange={setCompanyId}
				/>
			</Field>
			<Field>
				<FieldLabel htmlFor={roleFieldId}>Role</FieldLabel>
				<Select
					value={roleType}
					onValueChange={(next) => setRoleType(next as ContactRoleType)}
				>
					<SelectTrigger id={roleFieldId}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{CONTACT_ROLE_OPTIONS.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</Field>
		</QuickAddForm>
	);
}
