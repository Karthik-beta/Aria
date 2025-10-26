import { Controller, Get } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @AllowAnonymous()
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'aria-backend',
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
    };
  }

  @Get('health/detailed')
  @AllowAnonymous()
  getDetailedHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'aria-backend',
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      system: {
        platform: process.platform,
        nodeVersion: process.version,
        memory: {
          total: process.memoryUsage().heapTotal,
          used: process.memoryUsage().heapUsed,
          external: process.memoryUsage().external,
        },
        cpu: process.cpuUsage(),
      },
      environment: process.env.NODE_ENV || 'development',
    };
  }
}
