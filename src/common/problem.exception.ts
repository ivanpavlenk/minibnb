import { HttpException, HttpStatus } from '@nestjs/common';

export type ProblemBody = {
  type: string;
  title: string;
  status: number;
  detail: string;
};

export class ProblemException extends HttpException {
  constructor(status: HttpStatus, title: string, detail: string, type = 'about:blank') {
    super({ type, title, status, detail } satisfies ProblemBody, status);
  }
}
