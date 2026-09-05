import type { Prisma } from "./generated/prisma/client";

export const CANONICAL_EXTERNAL_REF = {
	confirmedAt: { not: null },
} as const satisfies Prisma.ExternalRefWhereInput;

export function isCanonicalRef(ref: { confirmedAt: Date | null }): boolean {
	return ref.confirmedAt !== null;
}
