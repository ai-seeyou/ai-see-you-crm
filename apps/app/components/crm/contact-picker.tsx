"use client";

import { Combobox, type ComboboxOption } from "@crm/ui/components/combobox";
import { useSearchInput } from "@crm/ui/hooks/use-search-input";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CONTACT } from "@/lib/labels";
import { useTRPC } from "@/lib/trpc/client";

export function ContactPicker({
	id,
	value,
	onValueChange,
	placeholder = `Choose a ${CONTACT.oneLower}`,
	disabled,
	variant,
	className,
}: {
	id?: string;
	value: string;
	onValueChange: (value: string) => void;
	placeholder?: string;
	disabled?: boolean;
	variant?: "default" | "ghost";
	className?: string;
}) {
	const trpc = useTRPC();

	const [query, setQuery] = useState("");
	const [text, setText] = useSearchInput(query, setQuery);
	const [chosen, setChosen] = useState<ComboboxOption | null>(null);

	const contacts = useQuery({
		...trpc.contacts.options.queryOptions({ q: query }),
		placeholderData: (previous) => previous,
	});

	const options: ComboboxOption[] = (contacts.data ?? []).map((contact) => ({
		value: contact.id,
		label: contact.name,
		hint: contact.employer ?? contact.title ?? contact.email ?? undefined,
		keywords: [contact.email, contact.employer, contact.title].filter(
			(keyword): keyword is string => Boolean(keyword),
		),
	}));

	const stale = contacts.isFetching || text.trim() !== query.trim();

	const current =
		chosen?.value === value
			? chosen
			: options.find((option) => option.value === value);

	return (
		<Combobox
			id={id}
			value={value}
			onValueChange={(next) => {
				setChosen(options.find((option) => option.value === next) ?? null);
				onValueChange(next);
			}}
			options={options}
			selectedOption={current}
			disabled={disabled}
			placeholder={placeholder}
			searchPlaceholder={`Search ${CONTACT.manyLower}…`}
			empty={
				contacts.isFetching ? "Searching…" : `No ${CONTACT.oneLower} matches.`
			}
			search={text}
			onSearchChange={setText}
			stale={stale}
			variant={variant}
			className={className}
		/>
	);
}
