import { Injectable } from '@nestjs/common';
import { CanalEnvoi } from '../../../../generated/prisma/client';
import { MailService } from '../../../core/mail/mail.service';
import { signatureOtpMail } from '../../../core/mail/templates/devis.templates';

/**
 * How the one-time signature code reaches the client.
 * Email today; an SMS implementation (Twilio, OVH, Brevo…) can be registered under
 * OTP_SENDERS later without touching the signature logic.
 *
 * v2: the old `sendSms` was a placeholder that only wrote the code to the server log —
 * a real client never received it.
 */
export interface OtpSender {
  readonly canal: CanalEnvoi;
  send(
    destinataire: string,
    code: string,
    context: { reference: string; validityMinutes: number },
  ): Promise<boolean>;
}

export const OTP_SENDERS = Symbol('OTP_SENDERS');

@Injectable()
export class EmailOtpSender implements OtpSender {
  readonly canal = CanalEnvoi.EMAIL;

  constructor(private readonly mail: MailService) {}

  send(
    destinataire: string,
    code: string,
    context: { reference: string; validityMinutes: number },
  ) {
    return this.mail.send(destinataire, signatureOtpMail({ code, ...context }));
  }
}
