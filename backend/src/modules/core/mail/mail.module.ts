import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env.validation';
import { MailService } from './mail.service';
import { ConsoleMailTransport, MAIL_TRANSPORT, SmtpMailTransport } from './mail.transport';

@Global()
@Module({
  providers: [
    MailService,
    {
      provide: MAIL_TRANSPORT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const host = config.get('MAIL_HOST', { infer: true });
        // Demo sandbox (visitors type any address) and CLI sample data (example.com addresses):
        // nothing ever leaves the server
        if (!host || config.get('DEMO_MODE', { infer: true }) || process.env.CRM_CLI) return new ConsoleMailTransport();
        return new SmtpMailTransport(
          {
            host,
            port: config.get('MAIL_PORT', { infer: true }),
            secure: config.get('MAIL_SECURE', { infer: true }),
            user: config.get('MAIL_USER', { infer: true }),
            pass: config.get('MAIL_PASS', { infer: true }),
          },
          config.get('MAIL_FROM', { infer: true }),
        );
      },
    },
  ],
  exports: [MailService],
})
export class MailModule {}
