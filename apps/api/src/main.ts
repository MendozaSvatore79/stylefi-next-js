import "reflect-metadata";

import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module.js";
import { leerConfig } from "./config.js";

const config = leerConfig();
const app = await NestFactory.create(AppModule);
app.enableCors({ origin: config.webOrigin, credentials: true });
app.enableShutdownHooks();
await app.listen(config.port);
console.log(`API escuchando en http://localhost:${config.port}`);
