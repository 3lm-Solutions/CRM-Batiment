import { PDFDocument, type PDFFont, type PDFPage, rgb, StandardFonts } from 'pdf-lib';
import * as QRCode from 'qrcode';

/**
 * Quote / invoice PDF (16/11, mobile lot B1): sent as an email attachment and downloadable
 * (GET /devis/:id/pdf, GET /factures/:id/pdf). Pure function: no database, easy to test.
 *
 * Standard fonts only (Helvetica = WinAnsi encoding): no font file to ship. Every text goes
 * through `pdfTexte`, which replaces the characters WinAnsi cannot encode (pdf-lib would throw).
 */

export interface PdfPartie {
  nom: string;
  lignes: (string | null | undefined)[];
}

export interface PdfLigne {
  description: string;
  quantite: string;
  unite: string;
  prixUnitaire: string;
  total: string;
}

export interface PdfTotal {
  label: string;
  valeur: string;
  gras?: boolean;
}

export interface PdfSignature {
  titre: string;
  /** data URL or bare base64 of a PNG / JPEG (signature pad) */
  image?: string | null;
  legende?: string | null;
}

export interface PdfDocumentData {
  titre: string;
  reference: string;
  infos: { label: string; valeur: string }[];
  emetteur: PdfPartie;
  destinataire: PdfPartie;
  lignes: PdfLigne[];
  totaux: PdfTotal[];
  mentions?: string[];
  signatures?: PdfSignature[];
  /** QR code drawn bottom-right (devis: verification code) */
  qr?: { contenu: string; legende: string } | null;
}

const REMPLACEMENTS: Record<string, string> = {
  '’': "'",
  '‘': "'",
  '“': '"',
  '”': '"',
  ' ': ' ',
  ' ': ' ',
  ' ': ' ',
  '–': '-',
  '—': '-',
  '…': '...',
  œ: 'oe',
  Œ: 'OE',
  '≤': '<=',
  '≥': '>=',
};

/** Characters Helvetica (WinAnsi) can draw: Latin-1 + € and a few typographic signs. */
const WIN_ANSI_EXTRA = new Set([
  '€',
  '‚',
  'ƒ',
  '„',
  '†',
  '‡',
  'ˆ',
  '‰',
  'Š',
  '‹',
  'Ž',
  '•',
  '˜',
  '™',
  'š',
  '›',
  'ž',
  'Ÿ',
]);

export function pdfTexte(value: string | null | undefined): string {
  if (!value) return '';
  let out = '';
  for (const ch of value.replace(/\r\n?/g, '\n')) {
    if (REMPLACEMENTS[ch] !== undefined) out += REMPLACEMENTS[ch];
    else if (ch === '\n' || ch === '\t') out += ' ';
    else {
      const code = ch.codePointAt(0)!;
      if (
        (code >= 0x20 && code <= 0x7e) ||
        (code >= 0xa0 && code <= 0xff) ||
        WIN_ANSI_EXTRA.has(ch)
      )
        out += ch;
      else out += '?';
    }
  }
  return out;
}

/** 1234.5 → « 1 234,50 € » (plain spaces: WinAnsi has no narrow no-break space). */
export function pdfMontant(value: number | { toNumber(): number } | null | undefined): string {
  const n = value == null ? 0 : typeof value === 'number' ? value : value.toNumber();
  const [ent, dec] = Math.abs(n).toFixed(2).split('.');
  const groupes = ent.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${n < 0 ? '-' : ''}${groupes},${dec} €`;
}

export function pdfDate(d: Date | null | undefined): string {
  if (!d) return '';
  const p = (x: number) => String(x).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Splits a text into lines fitting `largeur` points. */
export function couper(texte: string, font: PDFFont, taille: number, largeur: number): string[] {
  const mots = pdfTexte(texte).split(' ').filter(Boolean);
  const lignes: string[] = [];
  let courante = '';
  for (const mot of mots) {
    const essai = courante ? `${courante} ${mot}` : mot;
    if (font.widthOfTextAtSize(essai, taille) <= largeur) courante = essai;
    else {
      if (courante) lignes.push(courante);
      // a single word longer than the column: cut it
      let reste = mot;
      while (font.widthOfTextAtSize(reste, taille) > largeur && reste.length > 1) {
        let i = reste.length - 1;
        while (i > 1 && font.widthOfTextAtSize(reste.slice(0, i), taille) > largeur) i--;
        lignes.push(reste.slice(0, i));
        reste = reste.slice(i);
      }
      courante = reste;
    }
  }
  if (courante) lignes.push(courante);
  return lignes.length ? lignes : [''];
}

const A4: [number, number] = [595.28, 841.89];
const MARGE = 40;
const NOIR = rgb(0.1, 0.1, 0.12);
const GRIS = rgb(0.42, 0.42, 0.46);
const TRAIT = rgb(0.85, 0.85, 0.88);
const FOND = rgb(0.95, 0.96, 0.97);

export async function construirePdf(data: PdfDocumentData): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.setTitle(pdfTexte(`${data.titre} ${data.reference}`));
  doc.setProducer('BATIFLOW');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const gras = await doc.embedFont(StandardFonts.HelveticaBold);
  const largeurUtile = A4[0] - 2 * MARGE;

  let page: PDFPage = doc.addPage(A4);
  let y = A4[1] - MARGE;

  const texte = (t: string, x: number, taille = 9, f: PDFFont = font, couleur = NOIR) =>
    page.drawText(pdfTexte(t), { x, y, size: taille, font: f, color: couleur });
  const nouvellePage = () => {
    page = doc.addPage(A4);
    y = A4[1] - MARGE;
  };
  const place = (hauteur: number) => {
    if (y - hauteur < MARGE + 20) nouvellePage();
  };

  // ── header: title + reference / infos on the right ──
  texte(data.titre.toUpperCase(), MARGE, 18, gras);
  y -= 16;
  texte(data.reference, MARGE, 11, gras, GRIS);
  let yInfos = A4[1] - MARGE;
  for (const info of data.infos) {
    const ligne = pdfTexte(`${info.label} : ${info.valeur}`);
    page.drawText(ligne, {
      x: A4[0] - MARGE - font.widthOfTextAtSize(ligne, 9),
      y: yInfos,
      size: 9,
      font,
      color: NOIR,
    });
    yInfos -= 12;
  }
  y = Math.min(y, yInfos) - 24;

  // ── issuer / recipient boxes ──
  const colonne = (largeurUtile - 20) / 2;
  const bloc = (p: PdfPartie, x: number, titre: string) => {
    let yy = y;
    page.drawText(pdfTexte(titre), { x, y: yy, size: 8, font: gras, color: GRIS });
    yy -= 13;
    page.drawText(pdfTexte(p.nom), { x, y: yy, size: 10, font: gras, color: NOIR });
    yy -= 12;
    for (const l of p.lignes.filter(Boolean) as string[]) {
      for (const morceau of couper(l, font, 9, colonne)) {
        page.drawText(morceau, { x, y: yy, size: 9, font, color: NOIR });
        yy -= 11;
      }
    }
    return yy;
  };
  const yGauche = bloc(data.emetteur, MARGE, 'ÉMETTEUR');
  const yDroite = bloc(data.destinataire, MARGE + colonne + 20, 'CLIENT');
  y = Math.min(yGauche, yDroite) - 18;

  // ── lines table ──
  const cols = {
    desc: MARGE + 4,
    qte: MARGE + 290,
    unite: MARGE + 340,
    pu: MARGE + 400,
    total: A4[0] - MARGE - 4,
  };
  const largeurDesc = cols.qte - cols.desc - 10;
  const enTete = () => {
    page.drawRectangle({ x: MARGE, y: y - 5, width: largeurUtile, height: 17, color: FOND });
    texte('Désignation', cols.desc, 8, gras, GRIS);
    texte('Qté', cols.qte, 8, gras, GRIS);
    texte('Unité', cols.unite, 8, gras, GRIS);
    texte('P.U. HT', cols.pu, 8, gras, GRIS);
    const t = 'Total HT';
    page.drawText(t, {
      x: cols.total - gras.widthOfTextAtSize(t, 8),
      y,
      size: 8,
      font: gras,
      color: GRIS,
    });
    y -= 18;
  };
  const droite = (t: string, x: number, taille = 9, f: PDFFont = font) => {
    const s = pdfTexte(t);
    page.drawText(s, {
      x: x - f.widthOfTextAtSize(s, taille),
      y,
      size: taille,
      font: f,
      color: NOIR,
    });
  };
  enTete();
  for (const l of data.lignes) {
    const morceaux = couper(l.description, font, 9, largeurDesc);
    place(morceaux.length * 11 + 8);
    if (y === A4[1] - MARGE) enTete();
    texte(l.quantite, cols.qte);
    texte(l.unite, cols.unite);
    texte(l.prixUnitaire, cols.pu);
    droite(l.total, cols.total);
    for (const m of morceaux) {
      texte(m, cols.desc);
      y -= 11;
    }
    // separator 4 pt under the last baseline, then room for the next row's capitals
    page.drawLine({
      start: { x: MARGE, y: y + 7 },
      end: { x: A4[0] - MARGE, y: y + 7 },
      thickness: 0.5,
      color: TRAIT,
    });
    y -= 6;
  }
  if (!data.lignes.length) {
    texte('Aucune ligne.', cols.desc, 9, font, GRIS);
    y -= 14;
  }

  // ── totals (right) ──
  y -= 8;
  place(data.totaux.length * 15 + 10);
  for (const t of data.totaux) {
    const f = t.gras ? gras : font;
    droite(t.label, cols.pu + 40, 9, f);
    droite(t.valeur, cols.total, t.gras ? 11 : 9, f);
    y -= t.gras ? 16 : 13;
  }

  // ── legal mentions ──
  if (data.mentions?.length) {
    y -= 10;
    for (const m of data.mentions) {
      for (const morceau of couper(m, font, 8, largeurUtile)) {
        place(11);
        texte(morceau, MARGE, 8, font, GRIS);
        y -= 10;
      }
    }
  }

  // ── signatures + QR ──
  const signatures = data.signatures ?? [];
  if (signatures.length || data.qr) {
    y -= 14;
    place(110);
    const yHaut = y;
    let x = MARGE;
    for (const s of signatures) {
      y = yHaut;
      texte(s.titre, x, 8, gras, GRIS);
      page.drawRectangle({
        x,
        y: yHaut - 72,
        width: 150,
        height: 64,
        borderColor: TRAIT,
        borderWidth: 0.8,
      });
      const image = await imageSignature(doc, s.image);
      if (image) {
        const echelle = Math.min(140 / image.width, 56 / image.height, 1);
        page.drawImage(image, {
          x: x + 5,
          y: yHaut - 68,
          width: image.width * echelle,
          height: image.height * echelle,
        });
      }
      if (s.legende) {
        y = yHaut - 84;
        texte(s.legende, x, 7, font, GRIS);
      }
      x += 165;
    }
    if (data.qr) {
      const taille = 80;
      const x0 = A4[0] - MARGE - taille;
      const y0 = yHaut - taille;
      dessinerQr(page, data.qr.contenu, x0, y0, taille);
      const legende = pdfTexte(data.qr.legende);
      page.drawText(legende, {
        x: A4[0] - MARGE - font.widthOfTextAtSize(legende, 7),
        y: y0 - 10,
        size: 7,
        font,
        color: GRIS,
      });
    }
    y = yHaut - 100;
  }

  // ── page numbers ──
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const t = `${pdfTexte(data.reference)} - page ${i + 1}/${pages.length}`;
    p.drawText(t, {
      x: A4[0] - MARGE - font.widthOfTextAtSize(t, 7),
      y: 22,
      size: 7,
      font,
      color: GRIS,
    });
  });

  return Buffer.from(await doc.save());
}

async function imageSignature(doc: PDFDocument, base64: string | null | undefined) {
  if (!base64) return null;
  try {
    const brut = base64.includes(',') ? base64.slice(base64.indexOf(',') + 1) : base64;
    const bytes = Buffer.from(brut, 'base64');
    if (bytes[0] === 0x89 && bytes[1] === 0x50) return await doc.embedPng(bytes);
    if (bytes[0] === 0xff && bytes[1] === 0xd8) return await doc.embedJpg(bytes);
  } catch {
    // an unreadable signature never blocks the PDF
  }
  return null;
}

/** Draws the QR code as squares (no PNG round trip). */
function dessinerQr(page: PDFPage, contenu: string, x: number, y: number, taille: number) {
  const qr = QRCode.create(contenu, { errorCorrectionLevel: 'M' });
  const n = qr.modules.size;
  const cellule = taille / n;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.modules.get(r, c)) {
        page.drawRectangle({
          x: x + c * cellule,
          y: y + taille - (r + 1) * cellule,
          width: cellule,
          height: cellule,
          color: NOIR,
        });
      }
    }
  }
}
