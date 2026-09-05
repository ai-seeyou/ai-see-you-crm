import { type Db, DomainReviewStatus, type EntityType } from "@crm/db";
import {
	ConflictException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { CompaniesService } from "../companies/companies.service";
import { InjectDatabase } from "../database/database.constants";
import type {
	DomainReviewCreateCompanyInput,
	DomainReviewFileInput,
	DomainReviewListInput,
} from "./domain-reviews.contracts";

@Injectable()
export class DomainReviewsService {
	private readonly logger = new Logger(DomainReviewsService.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly companies: CompaniesService,
	) {}

	async list(input: DomainReviewListInput) {
		const [reviews, openCount] = await Promise.all([
			this.db.domainReview.findMany({
				where: { status: { in: input.status } },
				orderBy: [{ lastSeenAt: "desc" }],
				take: input.limit,
				select: {
					id: true,
					domain: true,
					email: true,
					reason: true,
					status: true,
					source: true,
					seenCount: true,
					firstSeenAt: true,
					lastSeenAt: true,
					decidedAt: true,
					company: { select: { id: true, name: true } },
				},
			}),
			this.db.domainReview.count({
				where: { status: DomainReviewStatus.PROPOSED },
			}),
		]);

		const domains = [...new Set(reviews.map((review) => review.domain))];
		const [candidates, waiting] = await Promise.all([
			this.candidatesFor(domains),
			this.waitingFor(domains),
		]);

		return {
			rows: reviews.map((review) => ({
				...review,
				firstSeenAt: review.firstSeenAt.toISOString(),
				lastSeenAt: review.lastSeenAt.toISOString(),
				decidedAt: review.decidedAt?.toISOString() ?? null,
				candidates: candidates.get(review.domain) ?? [],
				waitingContacts: waiting.get(review.domain) ?? 0,
			})),
			openCount,
		};
	}

	async fileToCompany(input: DomainReviewFileInput, actingUserId: string) {
		const review = await this.require(input.id);

		const company = await this.db.company.findFirst({
			where: { id: input.companyId, archivedAt: null },
			select: { id: true },
		});
		if (!company) {
			throw new NotFoundException(
				`No business with id ${input.companyId}. An archived business cannot take a domain.`,
			);
		}

		return this.file(review.id, review.domain, input.companyId, actingUserId);
	}

	async fileToNewCompany(
		input: DomainReviewCreateCompanyInput,
		actingUserId: string,
	) {
		const review = await this.require(input.id);

		// Phase 2 dropped domain uniqueness, so nothing at the database stops a
		// retry, the REST door, or two people at once making a second business on
		// one domain. The review is claimed before anything is created, so a second
		// caller is refused before it builds an orphan, and if a business already
		// owns the domain we file to that one rather than making a rival.
		const owner = await this.db.company.findFirst({
			where: { domain: review.domain, archivedAt: null },
			select: { id: true, name: true },
			orderBy: { createdAt: "asc" },
		});

		if (owner) {
			const filed = await this.file(
				review.id,
				review.domain,
				owner.id,
				actingUserId,
			);
			return { ...filed, takenBy: owner.name };
		}

		await this.claim(review.id, review.domain, actingUserId);

		const created = await this.companies.create({
			name: input.name,
			domain: review.domain,
			ownerId: null,
		});

		if (input.entityType !== undefined || input.verticalId !== undefined) {
			await this.companies.update(created.id, {
				entityType: input.entityType,
				verticalId: input.verticalId,
			});
		}

		return this.attach(review.id, review.domain, created.id);
	}

	async dismiss(id: string, actingUserId: string) {
		const review = await this.require(id);

		const dismissed = await this.db.domainReview.update({
			where: { id: review.id },
			data: {
				status: DomainReviewStatus.DISMISSED,
				decidedById: actingUserId,
				decidedAt: new Date(),
			},
			select: { id: true, domain: true, status: true, companyId: true },
		});

		this.logger.log({
			message: "Sending domain dismissed",
			domain: dismissed.domain,
		});

		return { ...dismissed, contactsMoved: 0 };
	}

	// The contacts already sitting on this domain with no business move with the
	// decision. Their employer assignment follows, because the database trigger on
	// Contact.companyId writes it. Do not write contactAssignment here.
	// Take the review before anything is created. Two callers racing to make a
	// business for the same domain both found no owner, both created one, and only
	// then did one lose the claim, leaving its business behind with nobody's name
	// on it. The loser is now refused before it builds anything.
	private async claim(
		id: string,
		domain: string,
		actingUserId: string,
	): Promise<void> {
		const claimed = await this.db.domainReview.updateMany({
			where: { id, status: DomainReviewStatus.PROPOSED },
			data: {
				status: DomainReviewStatus.APPLIED,
				decidedById: actingUserId,
				decidedAt: new Date(),
			},
		});

		if (claimed.count === 0) {
			throw new ConflictException(
				`${domain} was decided by somebody else while you were deciding it.`,
			);
		}
	}

	private async attach(id: string, domain: string, companyId: string) {
		const attached = await this.db.$transaction(async (tx) => {
			const review = await tx.domainReview.update({
				where: { id },
				data: { companyId },
				select: { id: true, domain: true, status: true, companyId: true },
			});

			const moved = await tx.contact.updateMany({
				where: {
					companyId: null,
					archivedAt: null,
					email: { endsWith: `@${domain}`, mode: "insensitive" },
				},
				data: { companyId },
			});

			return { review, moved: moved.count };
		});

		this.logger.log({
			message: "Sending domain filed to a new business",
			domain,
			companyId,
			contactsMoved: attached.moved,
		});

		return { ...attached.review, contactsMoved: attached.moved };
	}

	private async file(
		id: string,
		domain: string,
		companyId: string,
		actingUserId: string,
	) {
		const filed = await this.db.$transaction(async (tx) => {
			// Conditional on the status, so two people deciding at once produce one
			// decision rather than the second quietly overwriting the first.
			const claimed = await tx.domainReview.updateMany({
				where: { id, status: DomainReviewStatus.PROPOSED },
				data: {
					status: DomainReviewStatus.APPLIED,
					companyId,
					decidedById: actingUserId,
					decidedAt: new Date(),
				},
			});

			if (claimed.count === 0) {
				throw new ConflictException(
					`${domain} was decided by somebody else while you were deciding it.`,
				);
			}

			const review = await tx.domainReview.findUniqueOrThrow({
				where: { id },
				select: { id: true, domain: true, status: true, companyId: true },
			});

			const moved = await tx.contact.updateMany({
				where: {
					companyId: null,
					archivedAt: null,
					email: { endsWith: `@${domain}`, mode: "insensitive" },
				},
				data: { companyId },
			});

			return { review, moved: moved.count };
		});

		this.logger.log({
			message: "Sending domain filed to a business",
			domain,
			companyId,
			contactsMoved: filed.moved,
		});

		return { ...filed.review, contactsMoved: filed.moved };
	}

	// A review is decided once. Without this, filing an already filed domain to a
	// second business overwrote the first decision and the person who made it, and
	// split one domain's contacts across two businesses with nothing to say so.
	private async require(id: string) {
		const review = await this.db.domainReview.findUnique({
			where: { id },
			select: { id: true, domain: true, status: true },
		});
		if (!review) {
			throw new NotFoundException(`No domain review with id ${id}.`);
		}
		if (review.status !== DomainReviewStatus.PROPOSED) {
			throw new ConflictException(
				review.status === DomainReviewStatus.APPLIED
					? `${review.domain} is already filed. Move the people instead, or raise it again by adding it as a business.`
					: `${review.domain} was already dismissed.`,
			);
		}
		return review;
	}

	private async candidatesFor(domains: string[]) {
		const byDomain = new Map<string, Candidate[]>();
		if (domains.length === 0) return byDomain;

		const rows = await this.db.company.findMany({
			where: { domain: { in: domains }, archivedAt: null },
			orderBy: [{ name: "asc" }],
			select: {
				id: true,
				name: true,
				domain: true,
				entityType: true,
				iconUrl: true,
			},
		});

		for (const row of rows) {
			if (!row.domain) continue;
			const bucket = byDomain.get(row.domain) ?? [];
			byDomain.set(row.domain, bucket);
			bucket.push({
				id: row.id,
				name: row.name,
				entityType: row.entityType,
				iconUrl: row.iconUrl,
			});
		}

		return byDomain;
	}

	private async waitingFor(domains: string[]) {
		const counts = new Map<string, number>();
		if (domains.length === 0) return counts;

		const contacts = await this.db.contact.findMany({
			where: {
				companyId: null,
				archivedAt: null,
				OR: domains.map((domain) => ({
					email: { endsWith: `@${domain}`, mode: "insensitive" as const },
				})),
			},
			select: { email: true },
		});

		for (const contact of contacts) {
			const at = contact.email?.lastIndexOf("@") ?? -1;
			if (at < 0) continue;
			const domain = contact.email?.slice(at + 1).toLowerCase() ?? "";
			counts.set(domain, (counts.get(domain) ?? 0) + 1);
		}

		return counts;
	}
}

type Candidate = {
	id: string;
	name: string;
	entityType: EntityType;
	iconUrl: string | null;
};
