import { Inject } from "@nestjs/common";
import { Ctx, Input, Query, Router, UseMiddlewares } from "nestjs-trpc";
import type { z } from "zod";
import type { AuthedTrpcContext } from "../trpc/context.types";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import { restMeta } from "../trpc/openapi";
import { todaySummaryInput, todaySummaryOutput } from "./today.contracts";
import { TodayService } from "./today.service";

@Router({ alias: "today" })
@UseMiddlewares(AuthMiddleware)
export class TodayRouter {
	constructor(@Inject(TodayService) private readonly today: TodayService) {}

	@Query({
		input: todaySummaryInput,
		output: todaySummaryOutput,
		meta: restMeta("GET", "/today", ["Today"]),
	})
	async summary(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof todaySummaryInput>,
	) {
		return this.today.summary(ctx.user.id, input);
	}
}
