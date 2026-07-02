export type PrintableDocument = {
  number: string
  type: 'po' | 'surat_jalan' | 'picking_list' | 'retur'
  relatedTo: string
  date: string
  status: 'draft' | 'final'
  // Konten tambahan opsional khusus tipe dokumen tertentu (misal alasan retur)
  extraLines?: Array<{ label: string; value: string }>
}

export const documentTypeLabels: Record<PrintableDocument['type'], string> = {
  po: 'Purchase Order',
  surat_jalan: 'Surat Jalan',
  picking_list: 'Picking List',
  retur: 'Surat Retur Barang',
}

const relatedLabels: Record<PrintableDocument['type'], string> = {
  po: 'Dealer',
  surat_jalan: 'No. Pengiriman / Tujuan',
  picking_list: 'No. Pengiriman / Order',
  retur: 'Barang / Referensi Retur',
}

// Membangun konten HTML dokumen untuk preview, cetak, dan download.
export function buildDocumentHtml(doc: PrintableDocument) {
  const title = documentTypeLabels[doc.type]
  const formattedDate = new Date(doc.date).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  const relatedLabel = relatedLabels[doc.type]

  const extraRows = (doc.extraLines || []).map(line => `
        <tr>
          <td style="padding:4px 0; color:#555;">${line.label}</td>
          <td style="padding:4px 0; font-weight:600;">: ${line.value}</td>
        </tr>
  `).join('')

  return `
    <div style="font-family: Arial, Helvetica, sans-serif; color:#111; max-width:760px; margin:0 auto; padding:24px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #111; padding-bottom:12px; margin-bottom:24px;">
        <div>
          <div style="font-size:20px; font-weight:bold;">SupplyTrack</div>
          <div style="font-size:12px; color:#555;">Jl. Logistik Raya No. 1, Jakarta</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:16px; font-weight:bold; text-transform:uppercase;">${title}</div>
          <div style="font-size:12px; color:#555;">No: ${doc.number}</div>
        </div>
      </div>
      <table style="width:100%; font-size:13px; margin-bottom:24px;">
        <tr>
          <td style="padding:4px 0; width:160px; color:#555;">${relatedLabel}</td>
          <td style="padding:4px 0; font-weight:600;">: ${doc.relatedTo}</td>
        </tr>
        <tr>
          <td style="padding:4px 0; color:#555;">Tanggal Dokumen</td>
          <td style="padding:4px 0; font-weight:600;">: ${formattedDate}</td>
        </tr>
        <tr>
          <td style="padding:4px 0; color:#555;">Status</td>
          <td style="padding:4px 0; font-weight:600;">: ${doc.status === 'final' ? 'Final' : 'Draft'}</td>
        </tr>
        ${extraRows}
      </table>
      <div style="border:1px solid #ccc; border-radius:6px; padding:16px; min-height:120px; font-size:13px; color:#555; margin-bottom:32px;">
        Dokumen ini merupakan ${title.toLowerCase()} resmi yang dibuat melalui sistem SupplyTrack
        dan terkait dengan referensi <strong>${doc.relatedTo}</strong>.
      </div>
      <table style="width:100%; font-size:13px; margin-top:48px;">
        <tr>
          <td style="text-align:center; width:33%;">
            Dibuat oleh,<br/><br/><br/><br/>
            (....................)
          </td>
          <td style="text-align:center; width:33%;">
            Diperiksa oleh,<br/><br/><br/><br/>
            (....................)
          </td>
          <td style="text-align:center; width:33%;">
            Diterima oleh,<br/><br/><br/><br/>
            (....................)
          </td>
        </tr>
      </table>
    </div>
  `
}

export function openPrintWindow(doc: PrintableDocument, autoPrint: boolean) {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    alert('Popup diblokir oleh browser. Mohon izinkan popup untuk mencetak/mengunduh dokumen.')
    return
  }
  printWindow.document.write(`
    <html>
      <head>
        <title>${doc.number}</title>
      </head>
      <body>
        ${buildDocumentHtml(doc)}
      </body>
    </html>
  `)
  printWindow.document.close()
  if (autoPrint) {
    printWindow.focus()
    printWindow.onload = () => printWindow.print()
    // Fallback bila onload tidak terpicu (beberapa browser)
    setTimeout(() => printWindow.print(), 300)
  }
}
