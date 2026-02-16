import { Module } from "@nestjs/common";
import { LangfuseController } from "./langfuse.controller";
import { LangfuseService } from "./langfuse.service";

@Module({
  controllers: [LangfuseController],
  providers: [LangfuseService],
})
export class LangfuseModule {}
