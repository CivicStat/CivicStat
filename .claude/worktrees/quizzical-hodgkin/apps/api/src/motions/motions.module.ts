import { Module } from "@nestjs/common";
import { MotionsController } from "./motions.controller";
import { ScopedMotionsController } from "./scoped-motions.controller";
import { MotionsService } from "./motions.service";
import { PredictionsModule } from "../predictions/predictions.module";
import { ParliamentModule } from "../parliament/parliament.module";

@Module({
  imports: [PredictionsModule, ParliamentModule],
  controllers: [MotionsController, ScopedMotionsController],
  providers: [MotionsService],
  exports: [MotionsService],
})
export class MotionsModule {}
