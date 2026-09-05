import { z } from "zod";

export const verticalListInput = z.object({
	includeArchived: z.boolean().default(false),
});

export type VerticalListInput = z.infer<typeof verticalListInput>;

export const verticalOutput = z.object({
	id: z.string(),
	key: z.string(),
	label: z.string(),
	position: z.number(),
	archived: z.boolean(),
	companyCount: z.number(),
});

export const verticalListOutput = z.array(verticalOutput);
