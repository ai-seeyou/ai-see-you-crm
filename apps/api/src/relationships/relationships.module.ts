import { Module } from "@nestjs/common";
import { TrpcModule } from "../trpc/trpc.module";
import { RelationshipsRouter } from "./relationships.router";
import { RelationshipsService } from "./relationships.service";

@Module({
	imports: [TrpcModule],
	providers: [RelationshipsService, RelationshipsRouter],
	exports: [RelationshipsService],
})
export class RelationshipsModule {}
