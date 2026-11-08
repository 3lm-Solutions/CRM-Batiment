import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env.validation';
import { MailService } from './mail.service';
import {
  ConsoleMailTransport,
  MAIL_TRANSPORT,
  ResendMailTransport,
  SmtpMailTransport,
} from './mail.transport';

@Global()
@Module({
  providers: [
    MailService,
    {
      provide: MAIL_TRANSPORT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        // Demo sandbox (visitors type any address) and CLI sample data (example.com addresses):
        // nothing ever leaves the server
        if (config.get('DEMO_MODE', { infer: true }) || process.env.CRM_CLI) {
          return new ConsoleMailTransport();
        }

        const resendApiKey = config.get('RESEND_API_KEY', { infer: true });
        if (resendApiKey) {
          const from =
            config.get('RESEND_FROM', { infer: true }) || 'CRM Bâtiment <onboarding@resend.dev>';
          return new ResendMailTransport(resendApiKey, from);
        }

        const host = config.get('MAIL_HOST', { infer: true });
        if (!host) return new ConsoleMailTransport();

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
