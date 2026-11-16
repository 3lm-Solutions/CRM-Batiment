// imapflow / mailparser are loaded only when a mailbox is configured (dynamic import): the API
// still starts if they are not installed yet and the feature is not used.
import { objetCorrespond } from './email-rules';

type ImapFlowModule = typeof import('imapflow');
type MailparserModule = typeof import('mailparser');

/** One email read in the mailbox, already decoded. */
export interface EmailRecu {
  uid: number;
  messageId: string | null;
  /** The address to answer: Reply-To when present (website forms send « from » a no-reply address) */
  expediteur: { adresse: string | null; nom: string | null };
  sujet: string;
  texte: string;
  date: Date;
  /** Auto-replies, mailing lists, bounces: never a prospect */
  automatique: boolean;
}

/** Reads the unread emails of a mailbox, then marks them read once handled. */
export interface MailboxReader {
  readonly description: string;
  traiterNonLus(
    max: number,
    traiter: (email: EmailRecu) => Promise<void>,
  ): Promise<{ lus: number; erreurs: number }>;
}

export const MAILBOX_READER = Symbol('MAILBOX_READER');

export interface ImapSettings {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  folder: string;
  /** Subject words (lower case, no accents); empty = every unread email */
  subjects: string[];
}

const stripHtml = (html: string) =>
  html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();

/**
 * IMAP (imapflow + mailparser). Each run: connect, take the unread emails of the folder (oldest
 * first), hand them over one by one, mark them read, log out. Nothing is deleted or moved.
 */
export class ImapMailboxReader implements MailboxReader {
  constructor(private readonly s: ImapSettings) {}

  get description() {
    const objet = this.s.subjects.length
      ? `, objet contenant « ${this.s.subjects.join(' » ou « ')} »`
      : '';
    return `${this.s.user} (${this.s.host}, dossier ${this.s.folder}${objet})`;
  }

  async traiterNonLus(max: number, traiter: (email: EmailRecu) => Promise<void>) {
    const { ImapFlow } = await chargerImap();
    const client = new ImapFlow({
      host: this.s.host,
      port: this.s.port,
      secure: this.s.secure,
      auth: { user: this.s.user, pass: this.s.pass },
      logger: false,
      // A silent server must not block the runs for minutes (defaults: 90 s / 16 s / 5 min)
      connectionTimeout: 20_000,
      greetingTimeout: 15_000,
      socketTimeout: 120_000,
    });
    await client.connect();
    let lus = 0;
    let erreurs = 0;
    try {
      const lock = await client.getMailboxLock(this.s.folder);
      try {
        // Subject filter done by the server first (fewer downloads), checked again below
        const mots = this.s.subjects;
        const query = !mots.length
          ? { seen: false }
          : mots.length === 1
            ? { seen: false, subject: mots[0] }
            : { seen: false, or: mots.map((subject) => ({ subject })) };
        const found = await client.search(query, { uid: true });
        const uids = (Array.isArray(found) ? found : []).sort((a, b) => a - b).slice(0, max);
        if (!uids.length) return { lus, erreurs };

        // Download first: no other IMAP command may run while a FETCH is streaming
        const bruts: { uid: number; source: Buffer }[] = [];
        for await (const msg of client.fetch(uids, { uid: true, source: true }, { uid: true })) {
          if (msg.source) bruts.push({ uid: msg.uid, source: msg.source });
        }

        for (const brut of bruts) {
          let email: EmailRecu | null = null;
          try {
            email = await this.decoder(brut.uid, brut.source);
          } catch {
            // undecodable: handled as an import error below
          }
          // Not the expected subject: left unread and untouched
          if (email && !objetCorrespond(email.sujet, mots)) continue;
          try {
            if (!email) throw new Error('email illisible');
            await traiter(email);
            lus++;
          } catch {
            erreurs++; // logged by the caller; the email is still marked read (no endless retry)
          }
          // Marked read one by one: a run cut short (restart, lost connection) keeps what is done
          await client.messageFlagsAdd(brut.uid, ['\\Seen'], { uid: true });
        }
      } finally {
        lock.release();
      }
    } finally {
      await client.logout().catch(() => undefined);
    }
    return { lus, erreurs };
  }

  private async decoder(uid: number, source: Buffer): Promise<EmailRecu> {
    const { simpleParser } = await chargerMailparser();
    const m = await simpleParser(source);
    const replyTo = m.replyTo?.value?.[0];
    const from = m.from?.value?.[0];
    // Only text headers matter here (Precedence, List-…, Auto-Submitted)
    const header = (name: string) => {
      const v = m.headers.get(name);
      return typeof v === 'string' ? v.toLowerCase() : '';
    };
    const automatique =
      /auto-(replied|generated)/.test(header('auto-submitted')) ||
      /bulk|list|junk/.test(header('precedence')) ||
      m.headers.has('list-unsubscribe') ||
      /^(mailer-daemon|postmaster)@/i.test(from?.address ?? '');
    return {
      uid,
      messageId: m.messageId ?? null,
      expediteur: {
        adresse: (replyTo?.address || from?.address || '').toLowerCase() || null,
        nom: replyTo?.name || from?.name || null,
      },
      sujet: (m.subject ?? '').trim(),
      texte: (m.text?.trim() || (typeof m.html === 'string' ? stripHtml(m.html) : '')).slice(
        0,
        20_000,
      ),
      date: m.date ?? new Date(),
      automatique,
    };
  }
}

async function chargerImap(): Promise<ImapFlowModule> {
  try {
    const mod = (await import('imapflow')) as ImapFlowModule & { default?: ImapFlowModule };
    // CommonJS package: named export, or under « default » depending on the Node version
    return typeof mod.ImapFlow === 'function' ? mod : (mod.default ?? mod);
  } catch {
    throw new Error(
      'librairie « imapflow » absente : lancez « pnpm install » dans le dossier backend',
    );
  }
}

async function chargerMailparser(): Promise<MailparserModule> {
  try {
    const mod = (await import('mailparser')) as MailparserModule & { default?: MailparserModule };
    return typeof mod.simpleParser === 'function' ? mod : (mod.default ?? mod);
  } catch {
    throw new Error(
      'librairie « mailparser » absente : lancez « pnpm install » dans le dossier backend',
    );
  }
}
