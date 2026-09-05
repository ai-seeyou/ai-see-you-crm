import { Inject } from "@nestjs/common";
import { Input, Query, Router, UseMiddlewares } from "nestjs-trpc";
import type { z } from "zod";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import { restMeta } from "../trpc/openapi";
import { verticalListInput, verticalListOutput } from "./verticals.contracts";
import { VerticalsService } from "./verticals.service";

@Router({ alias: "verticals" })
@UseMiddlewares(AuthMiddleware)
export class VerticalsRouter {
	constructor(
		@Inject(VerticalsService) private readonly verticals: VerticalsService,
	) {}

	@Query({
		input: verticalListInput,
		output: verticalListOutput,
		meta: restMeta("GET", "/verticals", ["Verticals"]),
	})
	async list(@Input() input: z.infer<typeof verticalListInput>) {
		return this.verticals.list(input);
	}
}
