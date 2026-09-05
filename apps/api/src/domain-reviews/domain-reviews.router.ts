import { Inject } from "@nestjs/common";
import {
	Ctx,
	Input,
	Mutation,
	Query,
	Router,
	UseMiddlewares,
} from "nestjs-trpc";
import type { z } from "zod";
import type { AuthedTrpcContext } from "../trpc/context.types";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import { restMeta } from "../trpc/openapi";
import {
	domainReviewCreateCompanyInput,
	domainReviewDecisionOutput,
	domainReviewFileInput,
	domainReviewIdInput,
	domainReviewListInput,
	domainReviewListOutput,
} from "./domain-reviews.contracts";
import { DomainReviewsService } from "./domain-reviews.service";

@Router({ alias: "domainReviews" })
@UseMiddlewares(AuthMiddleware)
export class DomainReviewsRouter {
	constructor(
		@Inject(DomainReviewsService)
		private readonly reviews: DomainReviewsService,
	) {}

	@Query({
		input: domainReviewListInput,
		output: domainReviewListOutput,
		meta: restMeta("POST", "/domain-reviews/search", ["Domain reviews"]),
	})
	async list(@Input() input: z.infer<typeof domainReviewListInput>) {
		return this.reviews.list(input);
	}

	@Mutation({
		input: domainReviewFileInput,
		output: domainReviewDecisionOutput,
		meta: restMeta("POST", "/domain-reviews/{id}/file", ["Domain reviews"]),
	})
	async file(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof domainReviewFileInput>,
	) {
		return this.reviews.fileToCompany(input, ctx.user.id);
	}

	@Mutation({
		input: domainReviewCreateCompanyInput,
		output: domainReviewDecisionOutput,
		meta: restMeta("POST", "/domain-reviews/{id}/file-new", ["Domain reviews"]),
	})
	async fileToNew(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof domainReviewCreateCompanyInput>,
	) {
		return this.reviews.fileToNewCompany(input, ctx.user.id);
	}

	@Mutation({
		input: domainReviewIdInput,
		output: domainReviewDecisionOutput,
		meta: restMeta("POST", "/domain-reviews/{id}/dismiss", ["Domain reviews"]),
	})
	async dismiss(@Ctx() ctx: AuthedTrpcContext, @Input("id") id: string) {
		return this.reviews.dismiss(id, ctx.user.id);
	}
}
