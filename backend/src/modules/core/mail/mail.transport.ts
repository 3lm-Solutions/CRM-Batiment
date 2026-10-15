import { Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  /** Plain-text version: better deliverability, and readable in logs/tests */
  text: string;
}

/** Abstraction over "how an email leaves the app" — swapped for a fake in tests. */
export interface MailTransport {
  send(message: MailMessage): Promise<void>;
}

export const MAIL_TRANSPORT = Symbol('MAIL_TRANSPORT');

export class SmtpMailTransport implements MailTransport {
  private readonly transporter: Transporter;

  constructor(
    options: { host: string; port: number; secure: boolean; user?: string; pass?: string },
    private readonly from: string,
  ) {
    this.transporter = createTransport({
      host: options.host,
      port: options.port,
      secure: options.secure,
      auth: options.user ? { user: options.user, pass: options.pass } : undefined,
      connectionTimeout: 8_000,
      greetingTimeout: 8_000,
      socketTimeout: 12_000,
    });
  }

  async send(message: MailMessage): Promise<void> {
    await this.transporter.sendMail({ from: this.from, ...message });
  }
}

/** Used when MAIL_HOST is empty: prints the email (text version) in the API console. */
export class ConsoleMailTransport implements MailTransport {
  private readonly logger = new Logger('Mail');

  send(message: MailMessage): Promise<void> {
    this.logger.log(
      `\n──── EMAIL (non envoyé, MAIL_HOST vide) ────\nÀ     : ${message.to}\nSujet : ${message.subject}\n\n${message.text}\n────────────────────────────────────────────`,
    );
    return Promise.resolve();
  }
}
