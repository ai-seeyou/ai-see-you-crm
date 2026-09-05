import { Module } from "@nestjs/common";
import { TrpcModule } from "../trpc/trpc.module";
import { VerticalsRouter } from "./verticals.router";
import { VerticalsService } from "./verticals.service";

@Module({
	imports: [TrpcModule],
	providers: [VerticalsService, VerticalsRouter],
	exports: [VerticalsService],
})
export class VerticalsModule {}
