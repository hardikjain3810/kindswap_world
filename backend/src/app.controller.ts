import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('health')
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'KindSwap Backend',
      version: '0.1.0',
    };
  }

  @Get('test-sentry')
  testSentry() {
    throw new Error('Test Sentry error from local');
  }
}
