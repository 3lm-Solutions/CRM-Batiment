import { escapeHtml, layout, type RenderedMail } from './layout';

export function accountCreatedMail(p: {
  prenom: string;
  nom: string;
  email: string;
  temporaryPassword: string;
  appUrl: string;
}): RenderedMail {
  const subject = 'CRM Bâtiment — votre compte a été créé';
  const html = layout(
    'Bienvenue sur CRM Bâtiment',
    `<p>Bonjour ${escapeHtml(p.prenom)} ${escapeHtml(p.nom)},</p>
     <p>Votre compte a été créé par l'administrateur. Vos identifiants :</p>
     <p style="background:#f3f2ef;padding:16px;">
       <strong>Email :</strong> ${escapeHtml(p.email)}<br/>
       <strong>Mot de passe temporaire :</strong>
       <code style="font-size:16px;">${escapeHtml(p.temporaryPassword)}</code>
     </p>
     <p>Vous devrez choisir un nouveau mot de passe à la première connexion.</p>
     <p><a href="${escapeHtml(p.appUrl)}" style="color:#1f3a5f;">Se connecter</a></p>`,
  );
  const text = [
    `Bonjour ${p.prenom} ${p.nom},`,
    '',
    "Votre compte CRM Bâtiment a été créé par l'administrateur.",
    `Email : ${p.email}`,
    `Mot de passe temporaire : ${p.temporaryPassword}`,
    '',
    'Vous devrez choisir un nouveau mot de passe à la première connexion.',
    `Connexion : ${p.appUrl}`,
  ].join('\n');
  return { subject, html, text };
}

export function temporaryPasswordResetMail(p: {
  prenom: string;
  temporaryPassword: string;
  appUrl: string;
}): RenderedMail {
  const subject = 'CRM Bâtiment — nouveau mot de passe temporaire';
  const html = layout(
    'Nouveau mot de passe temporaire',
    `<p>Bonjour ${escapeHtml(p.prenom)},</p>
     <p>L'administrateur a réinitialisé votre mot de passe.</p>
     <p style="background:#f3f2ef;padding:16px;">
       <strong>Mot de passe temporaire :</strong>
       <code style="font-size:16px;">${escapeHtml(p.temporaryPassword)}</code>
     </p>
     <p>Vous devrez en choisir un nouveau à la connexion. Vos autres sessions ont été fermées.</p>
     <p><a href="${escapeHtml(p.appUrl)}" style="color:#1f3a5f;">Se connecter</a></p>`,
  );
  const text = [
    `Bonjour ${p.prenom},`,
    '',
    "L'administrateur a réinitialisé votre mot de passe.",
    `Mot de passe temporaire : ${p.temporaryPassword}`,
    `Connexion : ${p.appUrl}`,
  ].join('\n');
  return { subject, html, text };
}

export function passwordResetCodeMail(p: { code: string; validityMinutes: number }): RenderedMail {
  const subject = 'CRM Bâtiment — code de réinitialisation';
  const html = layout(
    'Réinitialisation du mot de passe',
    `<p>Votre code de vérification :</p>
     <p style="font-size:30px;font-weight:bold;letter-spacing:8px;color:#1f3a5f;">${escapeHtml(p.code)}</p>
     <p>Ce code expire dans ${p.validityMinutes} minutes.</p>
     <p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email : votre mot de passe reste inchangé.</p>`,
  );
  const text = [
    `Votre code de vérification : ${p.code}`,
    `Il expire dans ${p.validityMinutes} minutes.`,
    "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.",
  ].join('\n');
  return { subject, html, text };
}
