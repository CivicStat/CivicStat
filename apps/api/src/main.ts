import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./modules/app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log"]
  });

  app.enableCors({
    origin: true,
    credentials: true
  });

  await app.listen(process.env.PORT ? Number(process.env.PORT) : 4000);
}

bootstrap();
