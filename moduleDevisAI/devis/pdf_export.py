from __future__ import annotations

from io import BytesIO
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def _money(value: float) -> str:
    return f"{value:,.2f}".replace(",", " ").replace(".", ",") + " EUR"

def render_quote_pdf(document: dict[str, Any]) -> bytes:
    """Render a reviewed quotation into a French, downloadable PDF."""
    output = BytesIO()
    pdf = SimpleDocTemplate(output, pagesize=A4, rightMargin=16 * mm, leftMargin=16 * mm, topMargin=15 * mm, bottomMargin=15 * mm, title=f"Devis {document['reference']}")
    styles = getSampleStyleSheet()
    title = ParagraphStyle("QuoteTitle", parent=styles["Title"], textColor=colors.black, fontSize=22, leading=26)
    heading = ParagraphStyle("QuoteHeading", parent=styles["Heading2"], textColor=colors.black, fontSize=11, spaceBefore=10, spaceAfter=5)
    body = ParagraphStyle("QuoteBody", parent=styles["BodyText"], fontSize=8.5, leading=11)
    company = document["company"]
    customer = document["customer"]
    company_details = ParagraphStyle("CompanyDetails", parent=body, alignment=1)
    service = ParagraphStyle("ServiceLine", parent=body, fontName="Helvetica-Bold")
    story = [Paragraph(company["name"], title), Paragraph(" - ".join(filter(None, [company.get("address"), company.get("phone"), company.get("email"), company.get("siret")])), company_details), Spacer(1, 8 * mm)]
    customer_name = " ".join(filter(None, [customer.get("first_name"), customer.get("last_name")])) or "Client non renseigne"
    summary = Table([[Paragraph("<b>DEVIS</b>", heading), Paragraph("<b>CLIENT</b>", heading)], [Paragraph(f"Reference : <b>{document['reference']}</b><br/>Date : {document['date']}<br/>TVA : {document['vat_rate']:.2f} %", body), Paragraph(f"<b>{customer_name}</b><br/>{customer.get('address') or 'Adresse non renseignee'}<br/>{' - '.join(filter(None, [customer.get('phone'), customer.get('email')]))}", body)]], colWidths=[88 * mm, 88 * mm])
    summary.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 0.5, colors.black), ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.black), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("PADDING", (0, 0), (-1, -1), 8)]))
    story += [summary, Spacer(1, 7 * mm)]
    data = [["N°", "Description", "Qté", "Unité", "PU HT", "Montant HT"]]
    for index, line in enumerate(document["lines"], start=1):
        data.append([str(index), Paragraph(line["label"], service), str(line["quantity"]), line["unit"], _money(line["unit_price"]), _money(line["total_ht"])])
        for component in line.get("components", []):
            kind = "Materiau" if component.get("type") == "materiau" else "Main d oeuvre"
            quantity = component.get("quantite_totale", component.get("quantite_par_unite", ""))
            data.append(["", Paragraph(f"- {kind} : {component.get('label', 'Composant')}", body), str(quantity), component.get("unite", ""), "", ""])
    table = Table(data, colWidths=[9 * mm, 74 * mm, 18 * mm, 20 * mm, 28 * mm, 30 * mm], repeatRows=1)
    table.setStyle(TableStyle([("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, -1), 8), ("GRID", (0, 0), (-1, -1), 0.35, colors.black), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("ALIGN", (2, 1), (-1, -1), "RIGHT"), ("PADDING", (0, 0), (-1, -1), 6)]))
    story += [table, Spacer(1, 6 * mm)]
    totals = Table([["Total HT", _money(document["total_ht"])], [f"TVA ({document['vat_rate']:.2f} %)", _money(document["total_vat"])], ["Total TTC", _money(document["total_ttc"])]], colWidths=[40 * mm, 45 * mm], hAlign="RIGHT")
    totals.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 0.5, colors.black), ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.black), ("FONTNAME", (0, 2), (-1, 2), "Helvetica-Bold"), ("ALIGN", (1, 0), (1, -1), "RIGHT"), ("PADDING", (0, 0), (-1, -1), 7)]))
    story += [totals]
    if document.get("notes"):
        story += [Paragraph("Conditions et remarques", heading), Paragraph(document["notes"].replace("\n", "<br/>"), body)]
    story += [Spacer(1, 12 * mm), Paragraph("Bon pour accord - Date et signature du client : _________________________________", body)]
    pdf.build(story)
    return output.getvalue()
