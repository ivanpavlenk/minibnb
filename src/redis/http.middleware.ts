import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { HttpStatus } from '@nestjs/common';
import { RateLimiter } from './rate-limiter';
import { SessionStore } from './session.store';
import { ProblemException } from '../common/problem.exception';

const COOKIE = 'minibnb.sid';

@Injectable()
export class RedisHttpMiddleware implements NestMiddleware {
    constructor(
        private readonly sessions: SessionStore,
        private readonly limiter: RateLimiter,
    ) {}

    async use(req: Request, res: Response, next: NextFunction): Promise<void> {
        if (req.path === '/health') {
            next();
            return;
        }
        const decision = await this.limiter.hit('http');
        if (!decision.allowed) {
            res.setHeader('Retry-After', String(Math.max(1, decision.retryAfterSec)));
            next(
                new ProblemException(
                    HttpStatus.TOO_MANY_REQUESTS,
                    'Too Many Requests',
                    'Rate limit exceeded',
                ),
            );
            return;
        }
        const sid = readCookie(req, COOKIE) ?? randomUUID();
        if (!readCookie(req, COOKIE)) {
            res.setHeader('Set-Cookie', `${COOKIE}=${sid}; Path=/; HttpOnly`);
            await this.sessions.create(sid, JSON.stringify({ sid }));
        } else {
            const live = await this.sessions.read(sid);
            if (!live) {
                await this.sessions.create(sid, JSON.stringify({ sid }));
            }
        }
        next();
    }
}

function readCookie(req: Request, name: string): string | undefined {
    const header = req.headers.cookie;
    if (!header) {
        return undefined;
    }
    for (const part of header.split(';')) {
        const [k, ...rest] = part.trim().split('=');
        if (k === name) {
            return rest.join('=');
        }
    }
    return undefined;
}
