// Sentry MUST be imported and initialized FIRST, before any other imports
import { initSentry } from './instrument';
initSentry();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SentryExceptionFilter } from './common/filters/sentry-exception.filter';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // SECURITY: Cookie parser for JWT tokens in HttpOnly cookies
  const cookieSecret = process.env.COOKIE_SECRET || 'fallback-dev-secret-please-change';
  app.use(cookieParser(cookieSecret));

  // SECURITY: Apply security headers with Helmet
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      hsts: {
        maxAge: 31536000, // 1 year in seconds
        includeSubDomains: true,
        preload: true,
      },
      frameguard: {
        action: 'deny',
      },
      xssFilter: true,
      noSniff: true,
      referrerPolicy: {
        policy: 'strict-origin-when-cross-origin',
      },
    }),
  );

  // SECURITY: Strict CORS configuration
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map((origin) => origin.trim()) || [
    'https://admin.kindswap.world',
    'https://kindswap.world',
    'https://pre.kindswap.world',
  ];

  // Allow localhost in development
  if (process.env.NODE_ENV === 'development') {
    allowedOrigins.push('http://localhost:5173', 'http://localhost:3000', 'http://localhost:5000', 'http://localhost:8080');
  }

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (like mobile apps, Postman, curl)
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`[CORS] Blocked request from unauthorized origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Accept',
      'Authorization',
      'X-Admin-Wallet',
      'X-Admin-Signature',
      'X-Admin-Message',
    ],
    credentials: true,
    maxAge: 3600, // Cache preflight requests for 1 hour
  });

  // Global exception filter for Sentry error tracking
  app.useGlobalFilters(new SentryExceptionFilter());

  const port = process.env.PORT ?? 5000;
  await app.listen(port);
  console.log(`[Server] Running on port ${port}`);
  console.log(`[CORS] Allowed origins: ${allowedOrigins.join(', ')}`);
}
bootstrap();
