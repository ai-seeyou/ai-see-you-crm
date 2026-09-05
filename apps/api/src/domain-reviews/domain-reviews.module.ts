import { Module } from "@nestjs/common";
import { CompaniesModule } from "../companies/companies.module";
import { TrpcModule } from "../trpc/trpc.module";
import { DomainReviewsRouter } from "./domain-reviews.router";
import { DomainReviewsService } from "./domain-reviews.service";

@Module({
	imports: [TrpcModule, CompaniesModule],
	providers: [DomainReviewsService, DomainReviewsRouter],
	exports: [DomainReviewsService],
})
export class DomainReviewsModule {}
