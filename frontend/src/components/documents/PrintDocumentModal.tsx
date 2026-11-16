import type { ReactNode } from 'react';
import { Printer, X } from 'lucide-react';

interface PrintDocumentModalProps {
  title: string;
  subtitle: string;
  onClose: () => void;
  onPrint: () => void;
  children: ReactNode;
}

export function PrintDocumentModal({
  title,
  subtitle,
  onClose,
  onPrint,
  children,
}: PrintDocumentModalProps) {
  return (
    <div className="print-modal-root fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="print-document-zone flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl">
        <div className="print-hidden flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <p className="text-lg font-semibold text-slate-900">{title}</p>
            <p className="text-sm text-slate-500">{subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onPrint}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              <Printer size={16} />
              Imprimer / PDF
            </button>
            <button
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="print-modal-scroll overflow-y-auto bg-[#f4f1eb] px-4 py-5 md:px-8">{children}</div>
      </div>

      <style>{`
        @page {
          size: A4;
          margin: 8mm;
        }

        @media print {
          body * {
            visibility: hidden !important;
          }

          .print-modal-root {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            display: block !important;
            background: white !important;
            backdrop-filter: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .print-document-zone,
          .print-document-zone * {
            visibility: visible !important;
          }

          .print-document-zone {
            display: block !important;
            position: static !important;
            inset: auto !important;
            max-height: none !important;
            max-width: none !important;
            width: 100% !important;
            overflow: visible !important;
            height: auto !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }

          .print-modal-scroll {
            overflow: visible !important;
            max-height: none !important;
            height: auto !important;
            background: white !important;
            padding: 0 !important;
          }

          .print-document-zone article {
            box-shadow: none !important;
            border-radius: 0 !important;
            max-width: none !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 6mm !important;
            font-size: 11px !important;
            line-height: 1.35 !important;
          }

          .print-document-zone .text-4xl {
            font-size: 28px !important;
            line-height: 1.1 !important;
          }

          .print-document-zone .text-3xl {
            font-size: 22px !important;
            line-height: 1.15 !important;
          }

          .print-document-zone .text-2xl {
            font-size: 18px !important;
            line-height: 1.2 !important;
          }

          .print-document-zone .mt-8 {
            margin-top: 3mm !important;
          }

          .print-document-zone .mt-6 {
            margin-top: 2.5mm !important;
          }

          .print-document-zone .p-5,
          .print-document-zone .p-6 {
            padding: 2.8mm !important;
          }

          .print-document-zone table {
            width: 100% !important;
            break-inside: auto;
          }

          .print-document-zone thead {
            display: table-header-group;
          }

          .print-document-zone tr,
          .print-document-zone td,
          .print-document-zone th {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .print-hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
