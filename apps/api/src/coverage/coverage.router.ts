import { Inject } from "@nestjs/common";
import { Input, Query, Router, UseMiddlewares } from "nestjs-trpc";
import type { z } from "zod";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import { restMeta } from "../trpc/openapi";
import { coverageInput, coverageOutput } from "./coverage.contracts";
import { CoverageService } from "./coverage.service";

@Router({ alias: "coverage" })
@UseMiddlewares(AuthMiddleware)
export class CoverageRouter {
	constructor(
		@Inject(CoverageService) private readonly coverage: CoverageService,
	) {}

	@Query({
		input: coverageInput,
		output: coverageOutput,
		meta: restMeta("POST", "/coverage/gaps", ["Coverage"]),
	})
	async gaps(@Input() input: z.infer<typeof coverageInput>) {
		return this.coverage.gaps(input);
	}
}
