import type { Db, Prisma } from "@crm/db";
import { Injectable } from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";
import type { VerticalListInput } from "./verticals.contracts";

@Injectable()
export class VerticalsService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async list(input: VerticalListInput) {
		const where: Prisma.VerticalWhereInput = input.includeArchived
			? {}
			: { archivedAt: null };

		const verticals = await this.db.vertical.findMany({
			where,
			orderBy: [{ position: "asc" }, { label: "asc" }],
			select: {
				id: true,
				key: true,
				label: true,
				position: true,
				archivedAt: true,
				_count: { select: { companies: true } },
			},
		});

		return verticals.map((vertical) => ({
			id: vertical.id,
			key: vertical.key,
			label: vertical.label,
			position: vertical.position,
			archived: vertical.archivedAt !== null,
			companyCount: vertical._count.companies,
		}));
	}
}
