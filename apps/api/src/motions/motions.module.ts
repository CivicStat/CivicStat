import { Module } from "@nestjs/common";
import { MotionsController } from "./motions.controller";
import { MotionsService } from "./motions.service";
import { PredictionsModule } from "../predictions/predictions.module";

@Module({
  imports: [PredictionsModule],
  controllers: [MotionsController],
  providers: [MotionsService],
})
export class MotionsModule {}
