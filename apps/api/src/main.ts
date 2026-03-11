import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./modules/app.module";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log"]
  });

  app.enableCors({
    origin: true,
    credentials: true
  });

  // OpenAPI / Swagger documentation
  const config = new DocumentBuilder()
    .setTitle("CivicStat API")
    .setDescription(
      "CivicStat tracks whether Dutch political parties do what they promise. " +
      "This API exposes party scorecards, motion data, vote records, promise matching, " +
      "coalition dynamics, and municipal parliament data."
    )
    .setVersion("1.0")
    .setContact("CivicStat", "https://civicstat.nl", "info@civicstat.nl")
    .addTag("parties", "Party list, scorecards, and MCS computation")
    .addTag("motions", "Parliamentary motions (Tweede Kamer)")
    .addTag("votes", "Vote records per motion")
    .addTag("members", "Members of Parliament (Kamerleden)")
    .addTag("promises", "Election promises and their motion matches")
    .addTag("coalitions", "Coalition dynamics: CAI, vrije stemmen, coalitieverwatering")
    .addTag("parliaments", "Parliament registry (national + municipal)")
    .addTag("parliament-scoped", "Parliament-scoped endpoints (motions, votes, parties, etc.)")
    .addTag("stats", "Platform-level statistics")
    .addTag("insights", "Automated insights and anomaly detection")
    .addTag("campaign", "Municipal election campaign data")
    .addTag("health", "Health check")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("docs", app, document, {
    customSiteTitle: "CivicStat API Docs",
    swaggerOptions: {
      persistAuthorization: true,
      defaultModelsExpandDepth: -1, // collapse schemas by default
    },
  });

  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  await app.listen(port);
  console.log(`API listening on port ${port}`);
  console.log(`OpenAPI docs available at http://localhost:${port}/docs`);
}

bootstrap();
