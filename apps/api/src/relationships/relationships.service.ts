import {
	type Db,
	Prisma as PrismaNamespace,
	RecordSource,
	type RelationshipType,
} from "@crm/db";
import {
	BadRequestException,
	ConflictException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { blankToNull } from "../crm/values";
import { InjectDatabase } from "../database/database.constants";
import { RELATIONSHIP_EDGE_SELECT, serializeEdge } from "./relationship-edge";
import { RELATIONSHIP_LABELS } from "./relationship-labels";
import type {
	RelationshipCreateInput,
	RelationshipEndInput,
	RelationshipsForCompanyInput,
} from "./relationships.contracts";

@Injectable()
export class RelationshipsService {
	private readonly logger = new Logger(RelationshipsService.name);

	constructor(@InjectDatabase() private readonly db: Db) {}

	async forCompany(input: RelationshipsForCompanyInput) {
		const company = await this.db.company.findUnique({
			where: { id: input.companyId },
			select: { id: true },
		});
		if (!company) {
			throw new NotFoundException(`No business with id ${input.companyId}.`);
		}

		const validTo = input.includeEnded ? undefined : null;

		const [outgoing, incoming] = await Promise.all([
			this.db.entityRelationship.findMany({
				where: { fromCompanyId: input.companyId, validTo },
				orderBy: [{ type: "asc" }, { createdAt: "asc" }],
				select: RELATIONSHIP_EDGE_SELECT,
			}),
			this.db.entityRelationship.findMany({
				where: { toCompanyId: input.companyId, validTo },
				orderBy: [{ type: "asc" }, { createdAt: "asc" }],
				select: RELATIONSHIP_EDGE_SELECT,
			}),
		]);

		return {
			companyId: input.companyId,
			outgoing: outgoing.map((edge) => serializeEdge(edge, "outgoing")),
			incoming: incoming.map((edge) => serializeEdge(edge, "incoming")),
		};
	}

	async create(input: RelationshipCreateInput) {
		if (input.fromCompanyId === input.toCompanyId) {
			throw new BadRequestException(
				"A business cannot be related to itself. Pick a different business on one side.",
			);
		}

		const ends = await this.db.company.findMany({
			where: { id: { in: [input.fromCompanyId, input.toCompanyId] } },
			select: { id: true, name: true },
		});
		const from = ends.find((row) => row.id === input.fromCompanyId);
		const to = ends.find((row) => row.id === input.toCompanyId);
		if (!from) {
			throw new NotFoundException(
				`No business with id ${input.fromCompanyId}.`,
			);
		}
		if (!to) {
			throw new NotFoundException(`No business with id ${input.toCompanyId}.`);
		}

		try {
			const created = await this.db.entityRelationship.create({
				data: {
					fromCompanyId: input.fromCompanyId,
					toCompanyId: input.toCompanyId,
					type: input.type,
					note: blankToNull(input.note ?? ""),
					evidence: input.evidence,
					source: RecordSource.MANUAL,
					validFrom: input.validFrom ? new Date(input.validFrom) : new Date(),
				},
				select: {
					id: true,
					fromCompanyId: true,
					toCompanyId: true,
					type: true,
					validFrom: true,
					validTo: true,
				},
			});

			this.logger.log({
				message: "Relationship created",
				relationshipId: created.id,
				type: created.type,
			});

			return {
				...created,
				validFrom: created.validFrom?.toISOString() ?? null,
				validTo: created.validTo?.toISOString() ?? null,
			};
		} catch (cause) {
			throw this.translateDuplicate(cause, from.name, to.name, input.type);
		}
	}

	async end(input: RelationshipEndInput) {
		const at = input.at ? new Date(input.at) : new Date();

		const relationship = await this.db.entityRelationship.findUnique({
			where: { id: input.id },
			select: { id: true, validTo: true },
		});
		if (!relationship) {
			throw new NotFoundException(`No relationship with id ${input.id}.`);
		}
		if (relationship.validTo !== null) {
			throw new ConflictException("That relationship has already ended.");
		}

		const ended = await this.db.entityRelationship.update({
			where: { id: input.id },
			data: { validTo: at },
			select: {
				id: true,
				fromCompanyId: true,
				toCompanyId: true,
				type: true,
				validFrom: true,
				validTo: true,
			},
		});

		this.logger.log({
			message: "Relationship ended",
			relationshipId: ended.id,
		});

		return {
			...ended,
			validFrom: ended.validFrom?.toISOString() ?? null,
			validTo: ended.validTo?.toISOString() ?? null,
		};
	}

	private translateDuplicate(
		cause: unknown,
		fromName: string,
		toName: string,
		type: RelationshipType,
	): never {
		if (
			cause instanceof PrismaNamespace.PrismaClientKnownRequestError &&
			cause.code === "P2002"
		) {
			throw new ConflictException(
				`${fromName} is already ${RELATIONSHIP_LABELS[type]} ${toName}. End that relationship before recording a new one.`,
			);
		}
		throw cause;
	}
}
