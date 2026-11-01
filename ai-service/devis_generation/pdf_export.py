"""PDF contractuel envoyé au client, aligné sur l'aperçu du frontend."""
from __future__ import annotations

from datetime import datetime
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


SLATE = colors.HexColor("#0f172a")
MUTED = colors.HexColor("#475569")
LIGHT = colors.HexColor("#f8fafc")
BORDER = colors.HexColor("#cbd5e1")
AMBER = colors.HexColor("#d97706")
AMBER_LIGHT = colors.HexColor("#fef3c7")


def _eur(value: object) -> str:
    return f"{float(value or 0):,.2f} EUR".replace(",", " ").replace(".", ",")


def _quantity(value: object, unit: object) -> str:
    amount = float(value or 0)
    text = f"{amount:.2f}".rstrip("0").rstrip(".").replace(".", ",")
    return f"{text} {unit or ''}".strip()


def _on_page(canvas, doc) -> None:
    """Pied discret, proche du document aperçu à l'écran."""
    canvas.saveState()
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.4)
    canvas.line(18 * mm, 14 * mm, A4[0] - 18 * mm, 14 * mm)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(18 * mm, 9 * mm, "Devis contractuel - Artisan & Compagnie")
    canvas.drawRightString(A4[0] - 18 * mm, 9 * mm, f"Page {doc.page}")
    canvas.restoreState()


def build_devis_pdf(export: dict) -> bytes:
    """Construit un PDF A4 à partir des composants persistés du devis.

    Les lignes ``lignes_devis`` correspondent aux composants (matériau ou
    main-d'oeuvre), jamais à une prestation agrégée : c'est volontairement le
    même niveau de détail que l'aperçu contractuel du frontend.
    """
    devis = export["devis"]
    lignes = export["lignes"]
    styles = getSampleStyleSheet()
    normal = ParagraphStyle("normal", parent=styles["Normal"], fontName="Helvetica", fontSize=8.5, leading=11, textColor=SLATE)
    small = ParagraphStyle("small", parent=normal, fontSize=7.5, leading=9, textColor=MUTED)
    label = ParagraphStyle("label", parent=normal, fontName="Helvetica-Bold", fontSize=7.5, leading=9, textColor=MUTED, spaceAfter=2)
    title = ParagraphStyle("title", parent=normal, fontName="Helvetica-Bold", fontSize=18, leading=21, textColor=SLATE)
    right = ParagraphStyle("right", parent=normal, alignment=TA_RIGHT)
    table_text = ParagraphStyle("table_text", parent=normal, fontSize=7.5, leading=9)
    table_right = ParagraphStyle("table_right", parent=table_text, alignment=TA_RIGHT)

    date = devis.get("dateCreation")
    date_text = date.strftime("%d/%m/%Y") if isinstance(date, datetime) else str(date or "")[:10]
    client = " ".join(filter(None, [devis.get("client_prenom"), devis.get("client_nom")])) or "Client"
    reference = devis.get("reference") or f"DEV-{devis.get('id', '')}"

    buffer = BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=17 * mm,
        bottomMargin=22 * mm,
        title=f"Devis {reference}",
        author=devis.get("company_nom") or "Artisan & Compagnie",
    )

    company = [
        Paragraph(devis.get("company_nom") or "ARTISAN & COMPAGNIE", title),
        Paragraph("Renovation de l'habitat & travaux tous corps d'etat", normal),
        Paragraph("<font color='#047857'><b>Garantie decennale professionnelle</b></font>", small),
        Paragraph("<br/>".join(filter(None, [devis.get("company_adresse"), devis.get("company_telephone"), devis.get("company_email")])), small),
    ]
    quote_info = [
        Paragraph("<font color='#d97706'><b>DEVIS N° " + str(reference) + "</b></font>", ParagraphStyle("quote", parent=right, fontSize=10)),
        Paragraph(f"Date : <b>{date_text}</b>", right),
        Paragraph("Validite : <b>1 mois</b>", right),
    ]
    header = Table([[company, quote_info]], colWidths=[112 * mm, 67 * mm])
    header.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BACKGROUND", (1, 0), (1, 0), LIGHT),
        ("BOX", (1, 0), (1, 0), 0.5, BORDER),
        ("LEFTPADDING", (1, 0), (1, 0), 10), ("RIGHTPADDING", (1, 0), (1, 0), 10),
        ("TOPPADDING", (1, 0), (1, 0), 9), ("BOTTOMPADDING", (1, 0), (1, 0), 9),
    ]))

    client_block = [Paragraph("CLIENT DESTINATAIRE", label), Paragraph(f"<b>{client}</b>", normal)]
    chantier_block = [Paragraph("LIEU D'EXECUTION DES TRAVAUX", label), Paragraph(devis.get("company_adresse") or "Adresse du chantier a confirmer", normal), Paragraph("Conformite : normes DTU applicables et regles professionnelles du batiment.", small)]
    client_table = Table([[client_block, chantier_block]], colWidths=[89.5 * mm, 89.5 * mm])
    client_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT), ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, BORDER), ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 10), ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))

    line_rows = [[
        Paragraph("REF", table_text), Paragraph("COMPOSANT FACTURE", table_text), Paragraph("QUANTITE", table_right),
        Paragraph("P.U. HT", table_right), Paragraph("TVA", table_right), Paragraph("MONTANT TVA", table_right), Paragraph("TOTAL HT", table_right),
    ]]
    tva = float(devis.get("tauxTVA") or 0)
    for index, line in enumerate(lignes, 1):
        total_ht = float(line.get("totalHT") or 0)
        line_rows.append([
            Paragraph(f"{index:02d}", table_text),
            Paragraph(str(line.get("description") or "Composant de devis"), table_text),
            Paragraph(_quantity(line.get("quantite"), line.get("unite")), table_right),
            Paragraph(_eur(line.get("prixUnitaireVente")), table_right),
            Paragraph(f"{tva:g}%", table_right),
            Paragraph(_eur(total_ht * tva / 100), table_right),
            Paragraph(f"<b>{_eur(total_ht)}</b>", table_right),
        ])
    lines_table = Table(line_rows, colWidths=[10 * mm, 62 * mm, 23 * mm, 24 * mm, 12 * mm, 24 * mm, 24 * mm], repeatRows=1)
    lines_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
        ("TEXTCOLOR", (0, 0), (-1, 0), SLATE),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("LINEBELOW", (0, 0), (-1, 0), 1, SLATE),
        ("GRID", (0, 0), (-1, -1), 0.25, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("BACKGROUND", (0, 1), (-1, -1), colors.white),
    ]))

    total_ht = float(devis.get("totalHT") or 0)
    total_tva = float(devis.get("totalTVA") or 0)
    total_ttc = float(devis.get("totalTTC") or 0)
    payment = [Paragraph("CONDITIONS DE REGLEMENT", label), Paragraph(f"Acompte de 30% a la signature : <b>{_eur(total_ttc * .3)}</b><br/>Solde de 70% a l'achevement des travaux : <b>{_eur(total_ttc * .7)}</b><br/>Mode de reglement : virement bancaire ou cheque.", small)]
    totals = [
        [Paragraph("Total general HT :", normal), Paragraph(f"<b>{_eur(total_ht)}</b>", right)],
        [Paragraph(f"Total TVA ({tva:g}%) :", normal), Paragraph(f"<b>{_eur(total_tva)}</b>", right)],
        [Paragraph("<b>TOTAL TTC :</b>", ParagraphStyle("total_label", parent=normal, fontSize=11)), Paragraph(f"<font color='#d97706'><b>{_eur(total_ttc)}</b></font>", ParagraphStyle("total_value", parent=right, fontSize=14))],
    ]
    totals_table = Table(totals, colWidths=[41 * mm, 48 * mm])
    totals_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT), ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
        ("LINEBELOW", (0, 1), (-1, 1), 0.5, BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    summary = Table([[payment, totals_table]], colWidths=[90 * mm, 89 * mm])
    summary.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))

    signature = Table([[
        [Paragraph("<b>Pour l'entreprise</b>", normal), Paragraph(f"Fait le {date_text}", small), Spacer(1, 20 * mm), Paragraph("Signature et cachet de l'entreprise", small)],
        [Paragraph("<b>Bon pour accord et commande - Signature du client</b>", normal), Paragraph('Mention manuscrite "Lu et approuve, bon pour accord"', small), Spacer(1, 20 * mm)],
    ]], colWidths=[89.5 * mm, 89.5 * mm])
    signature.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT), ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, BORDER), ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 10), ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))

    story = [header, Spacer(1, 7 * mm), HRFlowable(width="100%", thickness=0.6, color=BORDER), Spacer(1, 6 * mm), client_table, Spacer(1, 7 * mm), lines_table, Spacer(1, 7 * mm), KeepTogether([summary, Spacer(1, 7 * mm), signature])]
    document.build(story, onFirstPage=_on_page, onLaterPages=_on_page)
    return buffer.getvalue()
