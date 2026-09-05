import { Module } from "@nestjs/common";
import { TrpcModule } from "../trpc/trpc.module";
import { CoverageRouter } from "./coverage.router";
import { CoverageService } from "./coverage.service";

@Module({
	imports: [TrpcModule],
	providers: [CoverageService, CoverageRouter],
	exports: [CoverageService],
})
export class CoverageModule {}
