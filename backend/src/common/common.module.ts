import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { type Env } from '../config/env.validation';
import { SessionValidator } from './auth/session-validator.service';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { DecimalSerializerInterceptor } from './interceptors/decimal-serializer.interceptor';
import { ReferenceService } from './references/reference.service';

/**
 * Cross-cutting infrastructure, registered once for the whole app.
 *
 * Request pipeline:
 *   request-context middleware (configureApp) → ThrottlerGuard → JwtAuthGuard → RolesGuard
 *   → ValidationPipe → controller → DecimalSerializerInterceptor
 *   → AllExceptionsFilter (on any error)
 */
@Global()
@Module({
  imports: [
    // Global rate limit per IP; auth endpoints set stricter limits with @Throttle().
    // Disabled in tests, which fire many requests in a few milliseconds.
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 300 }],
      skipIf: () => process.env.NODE_ENV === 'test',
    }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        signOptions: {
          expiresIn: config.get('JWT_EXPIRES_IN', { infer: true }) as JwtSignOptions['expiresIn'],
        },
      }),
    }),
  ],
  providers: [
    ReferenceService,
    SessionValidator,
    // Order matters: rate limit, then authentication, then authorization
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: DecimalSerializerInterceptor },
  ],
  exports: [ReferenceService, SessionValidator],
})
export class CommonModule {}
