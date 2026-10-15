/**
 * Every value coming from users (names, company, client data…) MUST go through escapeHtml.
 * The old templates inserted them raw: a client named `<img src=x onerror=…>` (e.g. typed
 * into the public chatbot) ended up as live HTML in emails sent by the company.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface RenderedMail {
  subject: string;
  html: string;
  text: string;
}

/** Shared HTML frame. `bodyHtml` must already be escaped by the caller. */
export function layout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:24px;background:#f3f2ef;font-family:Arial,Helvetica,sans-serif;color:#1c1f24;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-top:4px solid #1f3a5f;padding:32px;">
      <h1 style="margin:0 0 24px;font-size:20px;color:#1f3a5f;">${escapeHtml(title)}</h1>
      ${bodyHtml}
      <p style="margin-top:32px;font-size:12px;color:#6b7280;">
        Cet email a été envoyé automatiquement par CRM Bâtiment. Merci de ne pas y répondre.
      </p>
    </div>
  </body>
</html>`;
}
