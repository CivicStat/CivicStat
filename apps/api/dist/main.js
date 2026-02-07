"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const app_module_1 = require("./modules/app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        logger: ["error", "warn", "log"]
    });
    app.enableCors({
        origin: true,
        credentials: true
    });
    await app.listen(process.env.PORT ? Number(process.env.PORT) : 4000);
}
bootstrap();
