import { Module } from "@nestjs/common";
import { ParliamentController } from "./parliament.controller";
import { ParliamentService } from "./parliament.service";

/**
 * ParliamentModule provides ParliamentService which resolves parliament slugs
 * to IDs. Other modules import this to add parliament-scoped routes.
 *
 * Parliament-scoped data routes live in each domain's controller to avoid
 * ESM circular imports (e.g., /parliament/:slug/motions is in MotionsController).
 */
@Module({
  controllers: [ParliamentController],
  providers: [ParliamentService],
  exports: [ParliamentService],
})
export class ParliamentModule {}
