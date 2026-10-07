import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { Env } from './config/env.schema';

async function bootstrap(): Promise<void> {
    const app = await NestFactory.create(AppModule, { bodyParser: false });
    configureApp(app);

    const config = app.get(ConfigService<Env, true>);
    const port = config.get('PORT', { infer: true });
    await app.listen(port);
    console.log(`MiniBnB API listening on http://localhost:${port}`);
}

void bootstrap();
