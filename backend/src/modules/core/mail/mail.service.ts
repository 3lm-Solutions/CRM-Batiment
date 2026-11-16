import { Inject, Injectable, Logger } from '@nestjs/common';
import { MAIL_TRANSPORT, type MailTransport } from './mail.transport';
import type { RenderedMail } from './templates/layout';

/**
 * Sends rendered templates. Templates live in ./templates (one file per domain);
 * quote, invoice and supplier-order templates are ported with their modules (Steps 6–8).
 *
 * `send` never throws: it returns false on failure and logs. The caller decides what to do
 * (e.g. user creation succeeds and tells the admin the email could not be sent).
 * The old service swallowed errors in dev but threw in prod, after the DB write.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(@Inject(MAIL_TRANSPORT) private readonly transport: MailTransport) {}

  async send(to: string, mail: RenderedMail): Promise<boolean> {
    try {
      await this.transport.send({ to, ...mail });
      this.logger.log(`Email « ${mail.subject} » envoyé à ${to}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Échec d'envoi de « ${mail.subject} » à ${to}`,
        error instanceof Error ? error.stack : String(error),
      );
      return false;
    }
  }
}
