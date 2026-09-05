import { z } from "zod";

// EntityRelationship and ContactAssignment are temporal, and every query asks
// "is validTo null" to mean "is this current". That is what the partial unique
// indexes enforce, so it is the model's definition and not an accident.
//
// It only holds while the dates describe the past. A validFrom in the future
// reads as current before it starts, and a validTo in the future frees the
// uniqueness slot while still reading as ended, which lets a second current row
// exist. Both dates are refused here, at the boundary, rather than making every
// reader carry a clock.
export const pastOrPresent = z.iso
	.datetime()
	.refine(
		(value) => new Date(value).getTime() <= Date.now(),
		"That date is in the future. Record it when it happens.",
	);

export type PastOrPresent = z.infer<typeof pastOrPresent>;
