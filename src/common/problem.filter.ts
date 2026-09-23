import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ProblemBody, ProblemException } from './problem.exception';

@Catch()
export class ProblemExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    if (exception instanceof ProblemException) {
      const body = exception.getResponse() as ProblemBody;
      res.status(exception.getStatus()).type('application/problem+json').json({
        ...body,
        instance: req.originalUrl,
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const detail =
        typeof payload === 'string'
          ? payload
          : Array.isArray((payload as { message?: unknown }).message)
            ? ((payload as { message: string[] }).message).join('; ')
            : String((payload as { message?: unknown }).message ?? exception.message);

      res.status(status).type('application/problem+json').json({
        type: 'about:blank',
        title: status >= 500 ? 'Internal Server Error' : 'Bad Request',
        status,
        detail,
        instance: req.originalUrl,
      });
      return;
    }

    const err = exception as { status?: number; message?: string };
    const status = err.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
    res.status(status).type('application/problem+json').json({
      type: 'about:blank',
      title: status >= 500 ? 'Internal Server Error' : 'Bad Request',
      status,
      detail: err.message ?? 'Unexpected error',
      instance: req.originalUrl,
    });
  }
}
