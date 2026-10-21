import { Controller, Get } from '@nestjs/common';
import { Pool } from 'pg';

@Controller()
export class HealthController {
    constructor(private readonly pool: Pool) {}

    @Get('health')
    async health() {
        await this.pool.query('SELECT note FROM health_check WHERE id = 1');
        return {
            uptime: process.uptime(),
            db: 'ok',
        };
    }
}