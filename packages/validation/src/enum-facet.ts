import { z } from "zod";

// A list facet backed by a database enum. The client sends strings, because a
// facet value arrives from a URL and a URL holds strings, so the input type has
// to stay string[] or every caller has to cast. The output type is the enum, so
// the service can hand it straight to Prisma without a cast that nothing checks.
//
// An unknown value is an error, not something to drop. A dropped value is a
// filter that quietly does nothing, which reads as "no results" and teaches the
// reader the wrong thing. The client filters URL values against the same list
// before sending, so a stale bookmark never reaches this.
export function enumFacet<Value extends string>(
	values: readonly Value[],
	subject: string,
) {
	const allowed = new Set<string>(values);

	return z
		.array(z.string())
		.default([])
		.superRefine((chosen, ctx) => {
			for (const value of chosen) {
				if (allowed.has(value)) continue;
				ctx.addIssue({
					code: "custom",
					message: `${value} is not a ${subject}.`,
				});
			}
		})
		.transform((chosen) => chosen as Value[]);
}
