import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { configureApp } from '../../src/app.setup';

export async function createNestApp(): Promise<INestApplication> {
    const { AppModule } = await import('../../src/app.module');
    const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
    }).compile();
    const app = moduleRef.createNestApplication({ bodyParser: false });
    configureApp(app);
    await app.init();
    return app;
}
