import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

interface DevisValidationEmailPayload {
  to: string;
  clientName: string;
  devisReference: string;
  totalTTC: number;
  conseillerName: string;
  companyName: string;
  validationUrl: string;
  acceptUrl: string;
  rejectUrl: string;
  companyEmail?: string;
  companyTelephone?: string;
  companyAdresse?: string;
  companySiret?: string;
  clientAdresse?: string;
  clientEmail?: string;
  clientTelephone?: string;
  lines: {
    description: string;
    quantite: number;
    unite: string;
    prixUnitaireHT: number;
    totalHT: number;
    tauxTVA: number;
  }[];
}

interface SupplierOrderEmailPayload {
  to: string;
  supplierName: string;
  reference: string;
  companyName: string;
  devisReference: string;
  lines: {
    materiauNom: string;
    quantite: number;
    unite: string;
    prixUnitaire: number;
    totalHT: number;
  }[];
}

interface InvoiceEmailPayload {
  to: string;
  clientName: string;
  invoiceReference: string;
  devisReference: string;
  companyName: string;
  amountTTC: number;
  dueDate?: string;
  customMessage?: string;
  companyEmail?: string;
  companyTelephone?: string;
  companyAdresse?: string;
  companySiret?: string;
  clientAdresse?: string;
  clientEmail?: string;
  clientTelephone?: string;
  referencePaiement?: string;
  notesLegales?: string;
  lines: {
    description: string;
    quantite: number;
    unite: string;
    prixUnitaireHT: number;
    montantHT: number;
    tauxTVA: number;
  }[];
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly appEnv: string;
  private transporter: nodemailer.Transporter | null = null;

  constructor(private configService: ConfigService) {
    this.appEnv = (
      this.configService.get<string>('APP_ENV') || 'development'
    ).toLowerCase();

    const host = this.configService.get<string>('MAIL_HOST');
    const port = this.configService.get<number>('MAIL_PORT');
    const user = this.configService.get<string>('MAIL_USER');
    const pass = this.configService.get<string>('MAIL_PASS');
    const hasPlaceholderCredentials =
      !user ||
      !pass ||
      pass.includes('votre_') ||
      pass.includes('your_') ||
      pass.includes('16_caracteres');

    if (host && port && !hasPlaceholderCredentials) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 12000,
      });
      return;
    }

    this.logger.warn(
      'Configuration email absente ou incomplete, les emails seront affiches dans la console',
    );
  }

  async sendTemporaryPassword(
    to: string,
    nom: string,
    prenom: string,
    tempPassword: string,
  ): Promise<void> {
    const subject = 'CRM Batiment - Votre compte a ete cree';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2c3e50;">Bienvenue sur CRM Batiment</h2>
        <p>Bonjour <strong>${prenom} ${nom}</strong>,</p>
        <p>Votre compte a ete cree par l'administrateur. Voici vos identifiants de connexion :</p>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Email :</strong> ${to}</p>
          <p style="margin: 5px 0;"><strong>Mot de passe temporaire :</strong> <code style="background:#e9ecef; padding:4px 8px; border-radius:4px;">${tempPassword}</code></p>
        </div>
        <p style="color: #e74c3c;"><strong>Important :</strong> Vous devrez changer ce mot de passe lors de votre premiere connexion.</p>
        <p>Connectez-vous a l'adresse : <a href="${this.configService.get('APP_URL', 'http://localhost:5173')}">CRM Batiment</a></p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
        <p style="color: #999; font-size: 12px;">Cet email a ete envoye automatiquement. Ne repondez pas a ce message.</p>
      </div>
    `;

    await this.sendOrLog({
      to,
      subject,
      html,
      devLogs: [`Mot de passe temporaire : ${tempPassword}`],
    });
  }

  async sendDevisValidationEmail(
    payload: DevisValidationEmailPayload,
  ): Promise<void> {
    const subject = `Votre devis ${payload.devisReference} est pret a etre valide`;
    const totalFormatted = new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(payload.totalTTC);

    const totalHT = payload.lines.reduce((sum, line) => sum + line.totalHT, 0);

    const tvaGroupsMap: Record<number, number> = {};
    payload.lines.forEach((line) => {
      const rate = line.tauxTVA;
      const lineHT = line.totalHT;
      const lineTVA = lineHT * (rate / 100);
      tvaGroupsMap[rate] = (tvaGroupsMap[rate] || 0) + lineTVA;
    });

    const tvaHtml = Object.entries(tvaGroupsMap)
      .map(([rate, amount]) => {
        const amtFormatted = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
        return `
          <tr style="color: #64748b; font-size: 11px;">
            <td style="padding: 3px 0; text-align: left;">TVA ${Number(rate).toFixed(2)}%</td>
            <td style="padding: 3px 0; text-align: right; color: #0f172a;">${amtFormatted}</td>
          </tr>`;
      })
      .join('');

    const linesHtml = payload.lines
      .map(
        (line, index) => `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 12px; text-align: left; vertical-align: top; color: #94a3b8;">${index + 1}.</td>
            <td style="padding: 12px; text-align: left; vertical-align: top;">
              <p style="margin: 0; font-weight: bold; color: #0f172a;">${line.description}</p>
            </td>
            <td style="padding: 12px; text-align: right; vertical-align: top; white-space: nowrap; color: #334155;">${line.quantite} ${line.unite}</td>
            <td style="padding: 12px; text-align: right; vertical-align: top; color: #334155;">${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(line.prixUnitaireHT)}</td>
            <td style="padding: 12px; text-align: right; vertical-align: top; color: #334155;">${line.tauxTVA.toFixed(2)}%</td>
            <td style="padding: 12px; text-align: right; vertical-align: top; font-weight: bold; color: #0f172a;">${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(line.totalHT)}</td>
          </tr>`,
      )
      .join('');

    const html = `
      <div style="background-color: #f4f1eb; padding: 40px 10px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; min-height: 100%;">
        
        <!-- PAGE 1 : PRÉSENTATION & REMERCIEMENTS -->
        <div style="background-color: #ffffff; max-width: 720px; margin: 0 auto 30px; padding: 40px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; box-sizing: border-box;">
          <table style="width: 100%; border-collapse: collapse; border-bottom: 1px solid #e2e8f0; margin-bottom: 35px;">
            <tr>
              <td style="vertical-align: top; width: 50%; padding-bottom: 20px;">
                <p style="margin: 0; font-size: 9px; font-weight: bold; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.1em;">Coordonnées entreprise</p>
                <p style="margin: 4px 0 0; font-size: 15px; font-weight: bold; color: #0f172a;">${payload.companyName}</p>
                <div style="font-size: 12px; color: #64748b; margin-top: 6px; line-height: 1.5;">
                  <p style="margin: 0;">${payload.companyAdresse || ''}</p>
                  <p style="margin: 2px 0 0;">${payload.companyEmail || ''} | ${payload.companyTelephone || ''}</p>
                  ${payload.companySiret ? `<p style="margin: 2px 0 0;">SIRET: ${payload.companySiret}</p>` : ''}
                </div>
              </td>
              <td style="vertical-align: top; width: 50%; text-align: right; padding-bottom: 20px;">
                <p style="margin: 0; font-size: 9px; font-weight: bold; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.1em;">Coordonnées prospect</p>
                <p style="margin: 4px 0 0; font-size: 15px; font-weight: bold; color: #0f172a;">${payload.clientName}</p>
                <div style="font-size: 12px; color: #64748b; margin-top: 6px; line-height: 1.5;">
                  <p style="margin: 0;">${payload.clientAdresse || ''}</p>
                  <p style="margin: 2px 0 0;">${payload.clientEmail || payload.to || ''} ${payload.clientTelephone ? `| ${payload.clientTelephone}` : ''}</p>
                </div>
              </td>
            </tr>
          </table>

          <div style="margin-top: 20px;">
            <h2 style="margin: 0; font-size: 20px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: -0.02em;">
              Devis ${payload.devisReference} / ${new Date().getFullYear()}
            </h2>
            <p style="margin: 6px 0 0; font-size: 11px; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">
              DEVIS À L'ATTENTION DE : ${payload.clientName}
            </p>
          </div>

          <div style="margin-top: 25px; font-size: 13px; color: #475569; line-height: 1.7;">
            <p style="margin: 0 0 15px;">
              Merci pour l'intérêt que vous portez à nos solutions en énergies renouvelables et rénovations.
              Chez <strong>${payload.companyName}</strong>, nous sommes spécialisés dans la conception et l'installation
              de solutions durables à haute efficacité énergétique.
            </p>
            <p style="margin: 0 0 15px;">
              Ce devis comprend une analyse détaillée de votre demande et une estimation précise des coûts associés.
              Nous vous offrons des solutions clé en main, écologiques et économiques, configurées sur mesure.
            </p>
            <p style="margin: 0;">
              Notre équipe reste à votre entière disposition pour vous guider et vous accompagner tout au long du projet.
              N'hésitez pas à solliciter votre conseiller commercial <strong>${payload.conseillerName}</strong> pour toute question.
            </p>
          </div>
        </div>

        <!-- PAGE 2 : TABLEAU DES MATÉRIAUX & PRESTATIONS -->
        <div style="background-color: #ffffff; max-width: 720px; margin: 0 auto 30px; padding: 40px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; box-sizing: border-box;">
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
            <tr>
              <td>
                <h3 style="margin: 0; font-size: 14px; font-weight: bold; color: #0f172a; text-transform: uppercase;">Détail du devis</h3>
              </td>
              <td style="text-align: right; font-size: 11px; color: #64748b;">
                Réf devis : <strong>${payload.devisReference}</strong>
              </td>
            </tr>
          </table>

          <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
            <thead>
              <tr style="background-color: #1e293b; color: #ffffff;">
                <th style="padding: 10px 12px; text-align: left; font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; border-radius: 6px 0 0 6px;">N°</th>
                <th style="padding: 10px 12px; text-align: left; font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em;">Description</th>
                <th style="padding: 10px 12px; text-align: right; font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em;">Qte</th>
                <th style="padding: 10px 12px; text-align: right; font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em;">PU HT</th>
                <th style="padding: 10px 12px; text-align: right; font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em;">TVA</th>
                <th style="padding: 10px 12px; text-align: right; font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; border-radius: 0 6px 6px 0;">Total HT</th>
              </tr>
            </thead>
            <tbody>
              ${linesHtml}
            </tbody>
          </table>

          <table style="width: 100%; border-collapse: collapse; margin-top: 25px;">
            <tr>
              <td style="width: 55%;"></td>
              <td style="width: 45%;">
                <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; background-color: #f8fafc; border-radius: 8px; padding: 12px; font-size: 11px;">
                  <tr style="color: #64748b; font-weight: 500;">
                    <td style="padding: 4px; text-align: left;">Total HT</td>
                    <td style="padding: 4px; text-align: right; color: #0f172a;">${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(totalHT)}</td>
                  </tr>
                  ${tvaHtml}
                </table>
              </td>
            </tr>
          </table>
        </div>

        <!-- PAGE 3 : BANDEAU TTC & ACTIONS -->
        <div style="background-color: #ffffff; max-width: 720px; margin: 0 auto 30px; padding: 40px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; box-sizing: border-box;">
          <table style="width: 100%; border-collapse: collapse; background-color: #0f172a; color: #ffffff; border-radius: 16px; padding: 24px; font-size: 13px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); margin-bottom: 30px;">
            <tr>
              <td style="padding: 20px; border-radius: 16px;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr style="font-weight: bold; font-size: 14px; color: #cbd5e1;">
                    <td style="text-align: left; padding-bottom: 4px;">Total TTC</td>
                    <td style="text-align: right; padding-bottom: 4px;">${totalFormatted}</td>
                  </tr>
                  <tr style="font-weight: 800; font-size: 18px; color: #facc15; border-top: 1px solid #334155;">
                    <td style="text-align: left; padding-top: 8px;">Montant total</td>
                    <td style="text-align: right; padding-top: 8px;">${totalFormatted}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <p style="text-align: center; font-size: 12px; font-style: italic; color: #64748b; margin-bottom: 35px;">
            Les deux parties acceptent le contenu du devis et des conditions générales.
          </p>

          <div style="text-align: center; margin-bottom: 10px;">
            <a href="${payload.validationUrl}" style="display: inline-block; padding: 14px 28px; border-radius: 12px; background: #3b82f6; color: white; text-decoration: none; font-weight: bold; font-size: 14px; box-shadow: 0 4px 6px rgba(59,130,246,0.2);">
              Signer le devis en ligne
            </a>
          </div>

          <div style="text-align: center; margin-top: 15px; border-top: 1px solid #f1f5f9; padding-top: 20px;">
            <a href="${payload.acceptUrl}" style="display: inline-block; margin-right: 12px; padding: 10px 20px; border-radius: 8px; background: #059669; color: white; text-decoration: none; font-weight: bold; font-size: 12px;">Accepter</a>
            <a href="${payload.rejectUrl}" style="display: inline-block; padding: 10px 20px; border-radius: 8px; background: #dc2626; color: white; text-decoration: none; font-weight: bold; font-size: 12px;">Refuser</a>
          </div>
        </div>

        <!-- PAGE 4 & 5 : CGV -->
        <div style="background-color: #ffffff; max-width: 720px; margin: 0 auto 30px; padding: 40px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; box-sizing: border-box; font-size: 10px; color: #475569; line-height: 1.5;">
          <h3 style="margin: 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; font-size: 12px; font-weight: bold; color: #0f172a; text-transform: uppercase;">Conditions Générales de Ventes (1)</h3>
          <div style="margin-top: 15px;">
            <p><strong>1. Préambule :</strong> Les présentes CGV régissent les relations contractuelles entre <strong>${payload.companyName}</strong>, sise au <strong>${payload.companyAdresse || ''}</strong>, et ses clients. Toute commande implique l'adhésion sans réserve.</p>
            <p><strong>2. Commande :</strong> Confirmation écrite obligatoire via devis signé par le client.</p>
            <p><strong>3. Prix :</strong> Fermes et non révisables pendant la durée de validité du devis. Hors taxes (HT) avec TVA applicable en vigueur.</p>
            <p><strong>4. Modalités de paiement :</strong> Par virement bancaire. Standard : 20% à la commande, 30% à mi-chantier, 50% à la réception.</p>
            <p><strong>5. Délais :</strong> Donnés à titre indicatif. Sujets aux aléas climatiques et techniques.</p>
            <p><strong>6. Garantie :</strong> Décennale (10 ans) sur les travaux et pose de matériel, hors usure anormale ou défaut d'entretien.</p>
          </div>
        </div>

        <div style="background-color: #ffffff; max-width: 720px; margin: 0 auto; padding: 40px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; box-sizing: border-box; font-size: 10px; color: #475569; line-height: 1.5;">
          <h3 style="margin: 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; font-size: 12px; font-weight: bold; color: #0f172a; text-transform: uppercase;">Conditions Générales de Ventes (2)</h3>
          <div style="margin-top: 15px;">
            <p><strong>7. Responsabilité :</strong> Limitée au montant total de la commande pour les dommages directs.</p>
            <p><strong>8. Réception :</strong> Effectuée en présence du client, donnant lieu à procès-verbal de réception.</p>
            <p><strong>9. Rétractation :</strong> Délai légal de 14 jours pour les clients particuliers.</p>
            <p><strong>10. Litiges :</strong> Recherche d'accord amiable avant tout recours aux tribunaux compétents.</p>
          </div>
          <div style="margin-top: 30px; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; background-color: #f8fafc; font-size: 11px; text-align: center; color: #64748b;">
            Pour toute question, contactez notre service client à <strong style="color: #3b82f6;">${payload.companyEmail || 'support@batiflow.fr'}</strong> ou au <strong>${payload.companyTelephone || ''}</strong>.
          </div>
        </div>

      </div>
    `;

    await this.sendOrLog({
      to: payload.to,
      subject,
      html,
      devLogs: [
        `Voir devis   : ${payload.validationUrl}`,
        `Accepter     : ${payload.acceptUrl}`,
        `Refuser      : ${payload.rejectUrl}`,
      ],
    });
  }

  async sendSupplierOrderEmail(
    payload: SupplierOrderEmailPayload,
  ): Promise<void> {
    const subject = `Nouvelle commande fournisseur ${payload.reference}`;
    const linesHtml = payload.lines
      .map(
        (line) => `
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${line.materiauNom}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">${line.quantite} ${line.unite}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(line.prixUnitaire)}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(line.totalHT)}</td>
          </tr>`,
      )
      .join('');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 720px; margin: 0 auto; color: #0f172a;">
        <div style="padding: 28px; background: linear-gradient(135deg, #0f172a, #1e293b); border-radius: 20px 20px 0 0; color: white;">
          <p style="margin: 0; font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: #cbd5e1;">${payload.companyName}</p>
          <h1 style="margin: 12px 0 0; font-size: 28px;">Commande fournisseur</h1>
        </div>
        <div style="border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 20px 20px; padding: 28px; background: #ffffff;">
          <p>Bonjour <strong>${payload.supplierName}</strong>,</p>
          <p>Une nouvelle commande fournisseur a ete generee automatiquement depuis le devis <strong>${payload.devisReference}</strong>.</p>
          <div style="margin: 20px 0; padding: 16px; border-radius: 16px; background: #f8fafc; border: 1px solid #e2e8f0;">
            <p style="margin: 0;"><strong>Reference commande :</strong> ${payload.reference}</p>
          </div>
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
            <thead>
              <tr style="background: #0f172a; color: white;">
                <th style="padding: 10px; text-align: left;">Materiau</th>
                <th style="padding: 10px; text-align: right;">Quantite</th>
                <th style="padding: 10px; text-align: right;">Prix U.</th>
                <th style="padding: 10px; text-align: right;">Total HT</th>
              </tr>
            </thead>
            <tbody>${linesHtml}</tbody>
          </table>
        </div>
      </div>
    `;

    await this.sendOrLog({
      to: payload.to,
      subject,
      html,
      devLogs: [
        `Commande fournisseur : ${payload.reference}`,
        ...payload.lines.map(
          (line) =>
            `${line.materiauNom} - ${line.quantite} ${line.unite} - ${new Intl.NumberFormat(
              'fr-FR',
              {
                style: 'currency',
                currency: 'EUR',
              },
            ).format(line.totalHT)}`,
        ),
      ],
    });
  }

  async sendInvoiceEmail(payload: InvoiceEmailPayload): Promise<void> {
    const subject = `Facture ${payload.invoiceReference}`;
    const amountFormatted = new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(payload.amountTTC);

    const issueDateLabel = new Date().toLocaleDateString('fr-FR');
    const dueDateLabel = payload.dueDate
      ? new Date(payload.dueDate).toLocaleDateString('fr-FR')
      : 'A reception';

    const totalHT = payload.lines.reduce((sum, line) => sum + line.montantHT, 0);

    const tvaGroupsMap: Record<number, number> = {};
    payload.lines.forEach((line) => {
      const rate = line.tauxTVA;
      const lineHT = line.montantHT;
      const lineTVA = lineHT * (rate / 100);
      tvaGroupsMap[rate] = (tvaGroupsMap[rate] || 0) + lineTVA;
    });

    const tvaHtml = Object.entries(tvaGroupsMap)
      .map(([rate, amount]) => {
        const amtFormatted = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
        return `
          <tr style="color: #cbd5e1; font-size: 11px;">
            <td style="padding: 3px 0; text-align: left;">TVA ${Number(rate).toFixed(2)}%</td>
            <td style="padding: 3px 0; text-align: right;">${amtFormatted}</td>
          </tr>`;
      })
      .join('');

    const linesHtml = payload.lines
      .map(
        (line, index) => `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 12px; text-align: left; vertical-align: top; color: #94a3b8;">${index + 1}.</td>
            <td style="padding: 12px; text-align: left; vertical-align: top;">
              <p style="margin: 0; font-weight: bold; color: #0f172a;">${line.description}</p>
            </td>
            <td style="padding: 12px; text-align: right; vertical-align: top; white-space: nowrap; color: #334155;">${line.quantite} ${line.unite}</td>
            <td style="padding: 12px; text-align: right; vertical-align: top; color: #334155;">${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(line.prixUnitaireHT)}</td>
            <td style="padding: 12px; text-align: right; vertical-align: top; color: #334155;">${line.tauxTVA.toFixed(2)}%</td>
            <td style="padding: 12px; text-align: right; vertical-align: top; font-weight: bold; color: #0f172a;">${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(line.montantHT)}</td>
          </tr>`,
      )
      .join('');

    const html = `
      <div style="background-color: #f4f1eb; padding: 40px 10px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; min-height: 100%;">
        <div style="background-color: #ffffff; max-width: 720px; margin: 0 auto; padding: 40px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; box-sizing: border-box;">
          
          <!-- En-tête : Infos Entreprise / Client -->
          <table style="width: 100%; border-collapse: collapse; border-bottom: 1px solid #e2e8f0; margin-bottom: 30px;">
            <tr>
              <td style="vertical-align: top; width: 50%; padding-bottom: 20px;">
                <p style="margin: 0; font-size: 9px; font-weight: bold; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.1em;">Entreprise</p>
                <p style="margin: 4px 0 0; font-size: 15px; font-weight: bold; color: #0f172a;">${payload.companyName || 'BATIFLOW'}</p>
                <div style="font-size: 12px; color: #64748b; margin-top: 6px; line-height: 1.5;">
                  <p style="margin: 0;">${payload.companyAdresse || ''}</p>
                  <p style="margin: 2px 0 0;">${payload.companyEmail || ''} | ${payload.companyTelephone || ''}</p>
                  ${payload.companySiret ? `<p style="margin: 2px 0 0;">SIRET: ${payload.companySiret}</p>` : ''}
                </div>
              </td>
              <td style="vertical-align: top; width: 50%; text-align: right; padding-bottom: 20px;">
                <p style="margin: 0; font-size: 9px; font-weight: bold; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.1em;">Coordonnées client</p>
                <p style="margin: 4px 0 0; font-size: 15px; font-weight: bold; color: #0f172a;">${payload.clientName}</p>
                <div style="font-size: 12px; color: #64748b; margin-top: 6px; line-height: 1.5;">
                  <p style="margin: 0;">${payload.clientAdresse || ''}</p>
                  <p style="margin: 2px 0 0;">${payload.clientEmail || payload.to || ''} ${payload.clientTelephone ? `| ${payload.clientTelephone}` : ''}</p>
                </div>
              </td>
            </tr>
          </table>

          <!-- Message customisé (s'il existe) -->
          ${
            payload.customMessage
              ? `
              <div style="margin-bottom: 30px; padding: 16px; border-left: 4px solid #3b82f6; background-color: #eff6ff; border-radius: 0 12px 12px 0; font-size: 13px; color: #1e3a8a; line-height: 1.6;">
                <strong>Message de votre conseiller :</strong><br/>
                <span style="white-space: pre-line;">${payload.customMessage}</span>
              </div>`
              : ''
          }

          <!-- Titre Facture & Infos d'émission -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
            <tr>
              <td style="vertical-align: middle;">
                <h2 style="margin: 0; font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em;">FACTURE</h2>
                <p style="margin: 2px 0 0; font-size: 12px; color: #64748b; font-weight: bold;">Réf: ${payload.invoiceReference}</p>
              </td>
              <td style="vertical-align: middle; text-align: right; font-size: 12px; color: #64748b; line-height: 1.5;">
                <p style="margin: 0;">Date d'émission: <strong style="color: #0f172a;">${issueDateLabel}</strong></p>
                <p style="margin: 2px 0 0;">Échéance: <strong style="color: #0f172a;">${dueDateLabel}</strong></p>
                <p style="margin: 2px 0 0;">Conditions: <strong style="color: #0f172a;">${payload.dueDate ? 'Paiement à échéance' : 'Paiement comptant'}</strong></p>
              </td>
            </tr>
          </table>

          <!-- Lignes de facturation -->
          <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
            <thead>
              <tr style="background-color: #1e293b; color: #ffffff;">
                <th style="padding: 10px 12px; text-align: left; font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; border-radius: 6px 0 0 6px;">N°</th>
                <th style="padding: 10px 12px; text-align: left; font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em;">Description</th>
                <th style="padding: 10px 12px; text-align: right; font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em;">Qte</th>
                <th style="padding: 10px 12px; text-align: right; font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em;">PU HT</th>
                <th style="padding: 10px 12px; text-align: right; font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em;">TVA</th>
                <th style="padding: 10px 12px; text-align: right; font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; border-radius: 0 6px 6px 0;">Total HT</th>
              </tr>
            </thead>
            <tbody>
              ${linesHtml}
            </tbody>
          </table>

          <!-- Séparateur bas de page / Totaux -->
          <table style="width: 100%; border-collapse: collapse; margin-top: 40px;">
            <tr>
              <!-- Gauche: Banques & Paiement -->
              <td style="vertical-align: top; width: 55%; padding-right: 25px;">
                <div style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; background-color: #f8fafc; font-size: 11px; color: #475569; line-height: 1.5; margin-bottom: 12px;">
                  <strong style="color: #0f172a; font-size: 12px; display: block; margin-bottom: 4px;">Informations bancaires :</strong>
                  Veuillez effectuer votre virement sur le compte bancaire de la société.<br/>
                  <strong>IBAN :</strong> LU96 0123 4567 8901 2345<br/>
                  <strong>BIC/SWIFT :</strong> BATIFLLX
                </div>
                <div style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; background-color: #f8fafc; font-size: 11px; color: #475569; line-height: 1.5;">
                  <strong style="color: #0f172a; font-size: 12px; display: block; margin-bottom: 4px;">Références de paiement :</strong>
                  Veuillez indiquer : <strong style="color: #0f172a;">${payload.referencePaiement || payload.invoiceReference}</strong><br/>
                  Dossier : <strong style="color: #0f172a;">${payload.devisReference}</strong>
                </div>
              </td>
              
              <!-- Droite: Récapitulatif -->
              <td style="vertical-align: top; width: 45%;">
                <table style="width: 100%; border-collapse: collapse; background-color: #0f172a; color: #ffffff; border-radius: 16px; padding: 20px; font-size: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                  <tr>
                    <td style="padding: 16px; border-radius: 16px;">
                      <table style="width: 100%; border-collapse: collapse;">
                        <tr style="color: #cbd5e1; font-weight: 500;">
                          <td style="padding: 3px 0; text-align: left;">Total HT</td>
                          <td style="padding: 3px 0; text-align: right;">${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(totalHT)}</td>
                        </tr>
                        ${tvaHtml}
                        <tr style="font-weight: bold; font-size: 13px; border-top: 1px solid #334155;">
                          <td style="padding: 8px 0 3px; text-align: left;">Total TTC</td>
                          <td style="padding: 8px 0 3px; text-align: right;">${amountFormatted}</td>
                        </tr>
                        <tr style="font-weight: 800; font-size: 15px; border-top: 1px solid #334155; color: #facc15;">
                          <td style="padding: 8px 0 0; text-align: left;">Montant total</td>
                          <td style="padding: 8px 0 0; text-align: right;">${amountFormatted}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <!-- Mentions Légales -->
          ${
            payload.notesLegales
              ? `
              <div style="margin-top: 40px; padding-top: 15px; border-top: 1px solid #e2e8f0; font-size: 9px; color: #94a3b8; line-height: 1.4; text-align: justify;">
                <strong style="color: #64748b;">Mentions légales & TVA :</strong><br/>
                ${payload.notesLegales}
              </div>`
              : ''
          }

        </div>
      </div>
    `;

    await this.sendOrLog({
      to: payload.to,
      subject,
      html,
      devLogs: [
        `Facture: ${payload.invoiceReference}`,
        `Devis origine: ${payload.devisReference}`,
        `Montant TTC: ${amountFormatted}`,
      ],
    });
  }

  private async sendOrLog({
    to,
    subject,
    html,
    devLogs = [],
  }: {
    to: string;
    subject: string;
    html: string;
    devLogs?: string[];
  }) {
    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from: this.configService.get(
            'MAIL_FROM',
            '"CRM Batiment" <noreply@crm-batiment.fr>',
          ),
          to,
          subject,
          html,
        });
        this.logger.log(`Email envoye a ${to}`);
        return;
      } catch (error) {
        if (this.appEnv === 'production') {
          throw error;
        }

        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Envoi email impossible (${message}). Email simule en mode developpement.`,
        );
      }
    }

    this.logger.log('===============================================');
    this.logger.log('EMAIL SIMULE (mode developpement)');
    this.logger.log(`Destinataire : ${to}`);
    this.logger.log(`Sujet        : ${subject}`);
    devLogs.forEach((line) => this.logger.log(line));
    this.logger.log('===============================================');
  }

  async sendPasswordResetCode(to: string, code: string): Promise<void> {
    await this.sendOrLog({
      to,
      subject: 'CRM Batiment - Code de reinitialisation',
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><h2>Reinitialisation du mot de passe</h2><p>Votre code de verification est :</p><p style="font-size: 28px; font-weight: bold; letter-spacing: 8px;">${code}</p><p>Ce code expire dans 10 minutes.</p></div>`,
      devLogs: [`Code de reinitialisation pour ${to} : ${code}`],
    });
  }
}
