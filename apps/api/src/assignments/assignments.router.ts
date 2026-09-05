import { Inject } from "@nestjs/common";
import { Input, Mutation, Query, Router, UseMiddlewares } from "nestjs-trpc";
import type { z } from "zod";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import { restMeta } from "../trpc/openapi";
import {
	assignInput,
	assignManyInput,
	assignManyOutput,
	assignmentsForCompanyInput,
	assignmentsForCompanyOutput,
	assignmentsForContactInput,
	assignmentsForContactOutput,
	assignOutput,
	endAssignmentInput,
	endAssignmentOutput,
} from "./assignments.contracts";
import { AssignmentsService } from "./assignments.service";

@Router({ alias: "assignments" })
@UseMiddlewares(AuthMiddleware)
export class AssignmentsRouter {
	constructor(
		@Inject(AssignmentsService)
		private readonly assignments: AssignmentsService,
	) {}

	@Query({
		input: assignmentsForCompanyInput,
		output: assignmentsForCompanyOutput,
		meta: restMeta("GET", "/companies/{companyId}/assignments", [
			"Assignments",
		]),
	})
	async forCompany(@Input() input: z.infer<typeof assignmentsForCompanyInput>) {
		return this.assignments.forCompany(input);
	}

	@Query({
		input: assignmentsForContactInput,
		output: assignmentsForContactOutput,
		meta: restMeta("GET", "/contacts/{contactId}/assignments", ["Assignments"]),
	})
	async forContact(@Input() input: z.infer<typeof assignmentsForContactInput>) {
		return this.assignments.forContact(input);
	}

	@Mutation({
		input: assignInput,
		output: assignOutput,
		meta: restMeta("POST", "/assignments", ["Assignments"]),
	})
	async assign(@Input() input: z.infer<typeof assignInput>) {
		return this.assignments.assign(input);
	}

	@Mutation({
		input: assignManyInput,
		output: assignManyOutput,
		meta: restMeta("POST", "/assignments/bulk", ["Assignments"]),
	})
	async assignMany(@Input() input: z.infer<typeof assignManyInput>) {
		return this.assignments.assignMany(input);
	}

	@Mutation({
		input: endAssignmentInput,
		output: endAssignmentOutput,
		meta: restMeta("POST", "/assignments/end", ["Assignments"]),
	})
	async end(@Input() input: z.infer<typeof endAssignmentInput>) {
		return this.assignments.end(input);
	}
}
