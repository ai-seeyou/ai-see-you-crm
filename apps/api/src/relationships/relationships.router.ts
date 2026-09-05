import { Inject } from "@nestjs/common";
import { Input, Mutation, Query, Router, UseMiddlewares } from "nestjs-trpc";
import type { z } from "zod";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import { restMeta } from "../trpc/openapi";
import {
	relationshipCreateInput,
	relationshipEndInput,
	relationshipMutateOutput,
	relationshipsForCompanyInput,
	relationshipsForCompanyOutput,
} from "./relationships.contracts";
import { RelationshipsService } from "./relationships.service";

@Router({ alias: "relationships" })
@UseMiddlewares(AuthMiddleware)
export class RelationshipsRouter {
	constructor(
		@Inject(RelationshipsService)
		private readonly relationships: RelationshipsService,
	) {}

	@Query({
		input: relationshipsForCompanyInput,
		output: relationshipsForCompanyOutput,
		meta: restMeta("GET", "/companies/{companyId}/relationships", [
			"Relationships",
		]),
	})
	async forCompany(
		@Input() input: z.infer<typeof relationshipsForCompanyInput>,
	) {
		return this.relationships.forCompany(input);
	}

	@Mutation({
		input: relationshipCreateInput,
		output: relationshipMutateOutput,
		meta: restMeta("POST", "/relationships", ["Relationships"]),
	})
	async create(@Input() input: z.infer<typeof relationshipCreateInput>) {
		return this.relationships.create(input);
	}

	@Mutation({
		input: relationshipEndInput,
		output: relationshipMutateOutput,
		meta: restMeta("POST", "/relationships/{id}/end", ["Relationships"]),
	})
	async end(@Input() input: z.infer<typeof relationshipEndInput>) {
		return this.relationships.end(input);
	}
}
