import { Module } from "@nestjs/common";
import { ContactsModule } from "../contacts/contacts.module";
import { TrpcModule } from "../trpc/trpc.module";
import { AssignmentsRouter } from "./assignments.router";
import { AssignmentsService } from "./assignments.service";

@Module({
	imports: [TrpcModule, ContactsModule],
	providers: [AssignmentsService, AssignmentsRouter],
	exports: [AssignmentsService],
})
export class AssignmentsModule {}
