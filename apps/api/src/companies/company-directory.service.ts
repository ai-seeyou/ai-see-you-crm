import {
	type Db,
	DomainReviewReason,
	DomainReviewStatus,
	Prisma as PrismaNamespace,
	type RecordSource,
} from "@crm/db";
import { Injectable, Logger } from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";
import { domainFromEmail } from "./domain";

export type DomainMatch =
	| { companyId: string; reason: null }
	| { companyId: null; reason: DomainReviewReason };

export type DirectoryOptions = { source?: RecordSource };

@Injectable()
export class CompanyDirectoryService {
	private readonly logger = new Logger(CompanyDirectoryService.name);

	constructor(@InjectDatabase() private readonly db: Db) {}

	async companyForEmail(
		email: string,
		options: DirectoryOptions = {},
	): Promise<string | null> {
		const domain = domainFromEmail(email);
		if (!domain) return null;

		const match = await this.companyForDomain(domain);
		if (match.companyId !== null) return match.companyId;

		await this.review({
			domain,
			email,
			reason: match.reason,
			source: options.source,
		});

		return null;
	}

	async companyForDomain(domain: string): Promise<DomainMatch> {
		const companies = await this.db.company.findMany({
			where: { domain, archivedAt: null },
			select: { id: true },
			orderBy: { createdAt: "asc" },
			take: 2,
		});

		const only = companies.length === 1 ? companies[0] : undefined;
		if (only) return { companyId: only.id, reason: null };

		return {
			companyId: null,
			reason:
				companies.length === 0
					? DomainReviewReason.UNRECOGNISED
					: DomainReviewReason.AMBIGUOUS,
		};
	}

	async review(input: {
		domain: string;
		email?: string | null;
		reason: DomainReviewReason;
		source?: RecordSource;
	}): Promise<void> {
		const seenAt = new Date();

		const open = await this.db.domainReview.findFirst({
			where: { domain: input.domain, status: DomainReviewStatus.PROPOSED },
			select: { id: true },
		});

		if (open) {
			await this.db.domainReview.update({
				where: { id: open.id },
				data: {
					reason: input.reason,
					lastSeenAt: seenAt,
					seenCount: { increment: 1 },
				},
				select: { id: true },
			});
			return;
		}

		try {
			await this.db.domainReview.create({
				data: {
					domain: input.domain,
					email: input.email ?? null,
					reason: input.reason,
					source: input.source,
					firstSeenAt: seenAt,
					lastSeenAt: seenAt,
				},
				select: { id: true },
			});
		} catch (cause) {
			if (!raced(cause)) throw cause;
			return;
		}

		this.logger.log({
			message: "Unfiled sending domain raised for review",
			domain: input.domain,
			reason: input.reason,
		});
	}
}

function raced(cause: unknown): boolean {
	return (
		cause instanceof PrismaNamespace.PrismaClientKnownRequestError &&
		cause.code === "P2002"
	);
}
