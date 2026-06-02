export async function buildPDFBlob(pageEl: HTMLElement, filename: string): Promise<Blob> {
  if (!pageEl) return Promise.reject(new Error('Aucune page à générer.'));

  const html2pdf = (await import('html2pdf.js')).default;

  return html2pdf()
    .set({
      margin:      0,
      filename,
      image:       { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 4,
        useCORS: true,
        allowTaint: true,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        height: 1123,
      },
      pagebreak: { mode: [] },
      jsPDF: { unit: 'px', format: [794, 1123], orientation: 'portrait' },
    })
    .from(pageEl)
    .output('blob');
}

export function buildFilename(docType: string, docNum: string, clientName?: string): string {
  const type   = (docType || 'FACTURE').toUpperCase();
  const num    = (docNum || '').replace(/\//g, '-');
  const client = (clientName || 'Client').replace(/\s+/g, '_');
  return `${type}-${num}-${client}.pdf`;
}
