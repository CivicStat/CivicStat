import { Module } from "@nestjs/common";
import { PromisesController } from "./promises.controller";
import { ScopedPromisesController } from "./scoped-promises.controller";
import { PromisesService } from "./promises.service";
import { ParliamentModule } from "../parliament/parliament.module";

@Module({
  imports: [ParliamentModule],
  controllers: [PromisesController, ScopedPromisesController],
  providers: [PromisesService],
  exports: [PromisesService],
})
export class PromisesModule {}
