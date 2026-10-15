import { INestApplication } from '@nestjs/common';
import { json, NextFunction, Request, Response, urlencoded } from 'express';
import * as OpenApiValidator from 'express-openapi-validator';
import { join } from 'path';
import { ProblemExceptionFilter } from './common/problem.filter';

export function configureApp(app: INestApplication): void {
    app.use(json());
    app.use(urlencoded({ extended: true }));
    app.use(
        OpenApiValidator.middleware({
            apiSpec: join(__dirname, '..', 'openapi', 'openapi.yaml'),
            validateRequests: true,
            validateResponses: true,
        }),
    );

    app.useGlobalFilters(new ProblemExceptionFilter());

    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.use(
        (err: { status?: number; message?: string }, req: Request, res: Response, _next: NextFunction) => {
            const status = err.status ?? 500;
            res.status(status).type('application/problem+json').json({
                type: 'about:blank',
                title: status >= 500 ? 'Internal Server Error' : 'Bad Request',
                status,
                detail: err.message,
                instance: req.originalUrl,
            });
        },
    );
}
