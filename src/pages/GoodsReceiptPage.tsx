import { useEffect, useState } from 'react'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api, type GoodsReceiptRecord, type PurchaseOrderRecord } from '@/src/lib/api'
import { useAuth } from '@/lib/auth-context'
import {
  PackageCheck,
  Plus,
  CheckCircle2,
  ClipboardList,
  Truck,
  Eye,
  Trash2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

const statusConfig = {
  draft: { label: 'Draft', class: 'bg-warning/10 text-warning border-warning/20' },
  confirmed: { label: 'Dikonfirmasi', class: 'bg-success/10 text-success border-success/20' },
}

const conditionConfig = {
  baik: { label: 'Baik', class: 'bg-success/10 text-success border-success/20' },
  rusak: { label: 'Rusak', class: 'bg-destructive/10 text-destructive border-destructive/20' },
  expired: { label: 'Expired', class: 'bg-warning/10 text-warning border-warning/20' },
}

type FormItem = {
  itemName: string
  orderedQty: number
  receivedQty: number
  conditionStatus: 'baik' | 'rusak' | 'expired'
  notes: string
}

export default function GoodsReceiptPage() {
  const { user } = useAuth()
  const [receipts, setReceipts] = useState<GoodsReceiptRecord[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [selectedReceipt, setSelectedReceipt] = useState<GoodsReceiptRecord | null>(null)
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())
  const [confirmTarget, setConfirmTarget] = useState<GoodsReceiptRecord | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<GoodsReceiptRecord | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('all')

  // Form state
  const [selectedPO, setSelectedPO] = useState<PurchaseOrderRecord | null>(null)
  const [receivedBy, setReceivedBy] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceUrl, setInvoiceUrl] = useState('')
  const [receiptNotes, setReceiptNotes] = useState('')
  const [formItems, setFormItems] = useState<FormItem[]>([])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = () => {
    setIsLoading(true)
    Promise.allSettled([
      api.goodsReceipts.list(),
      api.purchaseOrders.list(),
    ]).then(([receiptsRes, poRes]) => {
      if (receiptsRes.status === 'fulfilled') setReceipts(receiptsRes.value)
      if (poRes.status === 'fulfilled') setPurchaseOrders(poRes.value)
    }).finally(() => setIsLoading(false))
  }

  // Hanya PO yang statusnya shipped (sudah dikirim) dan belum ada receipt confirmed
  const eligiblePOs = purchaseOrders.filter(po =>
    !receipts.some(r => r.purchaseOrderId === po.id && r.status === 'confirmed')
  )

  const handleSelectPO = (poId: string) => {
    const po = purchaseOrders.find(p => p.id === Number(poId))
    if (!po) return
    setSelectedPO(po)
    // Auto-populate items dari PO
    setFormItems(po.items.map(item => ({
      itemName: item.name,
      orderedQty: item.quantity,
      receivedQty: item.quantity, // default sama dengan yang dipesan
      conditionStatus: 'baik',
      notes: '',
    })))
  }

  const updateFormItem = (index: number, field: keyof FormItem, value: string | number) => {
    setFormItems(prev => prev.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    ))
  }

  const openCreateDialog = () => {
    setSelectedPO(null)
    setReceivedBy(user?.name || '')
    setInvoiceNumber('')
    setInvoiceUrl('')
    setReceiptNotes('')
    setFormItems([])
    setShowCreateDialog(true)
  }

  const handleCreate = async () => {
    if (!selectedPO || !receivedBy.trim() || formItems.length === 0) {
      alert('PO, nama penerima, dan item wajib diisi')
      return
    }
    setIsSaving(true)
    try {
      const created = await api.goodsReceipts.create({
        purchaseOrderId: selectedPO.id,
        receivedBy: receivedBy.trim(),
        invoiceNumber: invoiceNumber.trim() || undefined,
        invoiceUrl: invoiceUrl.trim() || undefined,
        notes: receiptNotes.trim() || undefined,
        items: formItems.map(item => ({
          itemName: item.itemName,
          orderedQty: item.orderedQty,
          receivedQty: Number(item.receivedQty),
          conditionStatus: item.conditionStatus,
          notes: item.notes.trim() || undefined,
        })),
      })
      setReceipts(prev => [created, ...prev])
      setShowCreateDialog(false)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal membuat penerimaan')
    } finally {
      setIsSaving(false)
    }
  }

  const handleConfirm = async () => {
    if (!confirmTarget) return
    setIsSaving(true)
    try {
      await api.goodsReceipts.confirm(confirmTarget.id)
      setReceipts(prev => prev.map(r =>
        r.id === confirmTarget.id ? { ...r, status: 'confirmed' } : r
      ))
      // Update status PO di state juga
      setPurchaseOrders(prev => prev.map(po =>
        po.id === confirmTarget.purchaseOrderId ? { ...po, status: 'delivered' } : po
      ))
      setConfirmTarget(null)
      if (selectedReceipt?.id === confirmTarget.id) {
        setSelectedReceipt(prev => prev ? { ...prev, status: 'confirmed' } : null)
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal mengkonfirmasi penerimaan')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setIsSaving(true)
    try {
      await api.goodsReceipts.remove(deleteTarget.id)
      setReceipts(prev => prev.filter(r => r.id !== deleteTarget.id))
      setDeleteTarget(null)
      if (selectedReceipt?.id === deleteTarget.id) setSelectedReceipt(null)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal menghapus penerimaan')
    } finally {
      setIsSaving(false)
    }
  }

  const toggleExpand = (id: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const filtered = receipts.filter(r => filterStatus === 'all' || r.status === filterStatus)

  const stats = {
    total: receipts.length,
    draft: receipts.filter(r => r.status === 'draft').length,
    confirmed: receipts.filter(r => r.status === 'confirmed').length,
    pending: eligiblePOs.length,
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Penerimaan Barang</h1>
            <p className="text-sm text-muted-foreground mt-1">Verifikasi dan catat barang yang diterima dari supplier</p>
          </div>
          {(user?.role === 'dealer' || user?.role === 'gudang' || user?.role === 'manager') && (
            <Button onClick={openCreateDialog} className="gap-2">
              <Plus className="h-4 w-4" />
              Catat Penerimaan
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Penerimaan</p>
                  <p className="text-3xl font-bold">{stats.total}</p>
                </div>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <ClipboardList className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Menunggu Konfirmasi</p>
                  <p className="text-3xl font-bold">{stats.draft}</p>
                </div>
                <div className="h-12 w-12 rounded-lg bg-warning/10 flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Sudah Dikonfirmasi</p>
                  <p className="text-3xl font-bold">{stats.confirmed}</p>
                </div>
                <div className="h-12 w-12 rounded-lg bg-success/10 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">PO Siap Diterima</p>
                  <p className="text-3xl font-bold">{stats.pending}</p>
                </div>
                <div className="h-12 w-12 rounded-lg bg-chart-4/10 flex items-center justify-center">
                  <Truck className="h-6 w-6 text-chart-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* PO Siap Diterima — alert jika ada */}
        {eligiblePOs.length > 0 && (
          <Card className="border-warning/40 bg-warning/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-warning">
                <Truck className="h-5 w-5" />
                PO Menunggu Penerimaan ({eligiblePOs.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {eligiblePOs.map(po => (
                  <div key={po.id} className="flex items-center justify-between rounded-lg border border-warning/20 bg-background p-3">
                    <div>
                      <span className="font-semibold text-foreground">{po.orderNumber}</span>
                      <span className="text-sm text-muted-foreground ml-2">— {po.dealerName}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">{po.items.length} item · Rp {po.totalAmount.toLocaleString('id-ID')}</p>
                    </div>
                    <Button size="sm" onClick={() => {
                      openCreateDialog()
                      // delay agar dialog kebuka dulu
                      setTimeout(() => handleSelectPO(String(po.id)), 100)
                    }}>
                      <PackageCheck className="h-4 w-4 mr-1" />
                      Terima
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* List */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-lg font-semibold">Riwayat Penerimaan</CardTitle>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="confirmed">Dikonfirmasi</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Memuat data...</p>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center">
                <PackageCheck className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-40" />
                <p className="text-sm text-muted-foreground">Belum ada catatan penerimaan barang.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>No. Penerimaan</TableHead>
                    <TableHead>No. PO</TableHead>
                    <TableHead>Dealer</TableHead>
                    <TableHead>Diterima Oleh</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(receipt => (
                    <>
                      <TableRow
                        key={receipt.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleExpand(receipt.id)}
                      >
                        <TableCell>
                          {expandedRows.has(receipt.id)
                            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          }
                        </TableCell>
                        <TableCell className="font-medium">{receipt.receiptNumber}</TableCell>
                        <TableCell className="text-muted-foreground">{receipt.poNumber}</TableCell>
                        <TableCell>{receipt.dealerName}</TableCell>
                        <TableCell>{receipt.receivedBy}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(receipt.receivedAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusConfig[receipt.status].class}>
                            {statusConfig[receipt.status].label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                            <Button size="sm" variant="ghost" onClick={() => setSelectedReceipt(receipt)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            {receipt.status === 'draft' && (
                              <>
                                <Button size="sm" variant="outline" className="text-success border-success/30 hover:bg-success/10"
                                  onClick={() => setConfirmTarget(receipt)}>
                                  <CheckCircle2 className="h-4 w-4 mr-1" />
                                  Konfirmasi
                                </Button>
                                <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10"
                                  onClick={() => setDeleteTarget(receipt)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Expanded items row */}
                      {expandedRows.has(receipt.id) && (
                        <TableRow key={`${receipt.id}-expanded`} className="bg-muted/30 hover:bg-muted/30">
                          <TableCell colSpan={8} className="py-0">
                            <div className="px-4 py-3">
                              <p className="text-xs font-medium text-muted-foreground mb-2">Detail Item:</p>
                              <div className="space-y-1">
                                {receipt.items.map((item, idx) => {
                                  const selisih = item.receivedQty - item.orderedQty
                                  return (
                                    <div key={idx} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                                      <span className="font-medium">{item.itemName}</span>
                                      <div className="flex items-center gap-4 text-muted-foreground">
                                        <span>Pesan: <strong className="text-foreground">{item.orderedQty}</strong></span>
                                        <span>Terima: <strong className="text-foreground">{item.receivedQty}</strong></span>
                                        {selisih !== 0 && (
                                          <span className={selisih < 0 ? 'text-destructive font-medium' : 'text-success font-medium'}>
                                            {selisih > 0 ? '+' : ''}{selisih}
                                          </span>
                                        )}
                                        <Badge variant="outline" className={conditionConfig[item.conditionStatus].class}>
                                          {conditionConfig[item.conditionStatus].label}
                                        </Badge>
                                        {item.notes && <span className="text-xs italic">{item.notes}</span>}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                              {receipt.invoiceNumber && (
                                <p className="text-xs text-muted-foreground mt-2">
                                  No. Invoice: <span className="font-medium text-foreground">{receipt.invoiceNumber}</span>
                                  {receipt.invoiceUrl && (
                                    <a href={receipt.invoiceUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline ml-2">
                                      Lihat Invoice
                                    </a>
                                  )}
                                </p>
                              )}
                              {receipt.notes && (
                                <p className="text-xs text-muted-foreground mt-2">Catatan: {receipt.notes}</p>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog Buat Penerimaan */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Catat Penerimaan Barang</DialogTitle>
            <DialogDescription>Pilih Purchase Order dan verifikasi barang yang diterima.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Purchase Order <span className="text-destructive">*</span></Label>
              <Select value={selectedPO ? String(selectedPO.id) : ''} onValueChange={handleSelectPO}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih PO yang sudah dikirim..." />
                </SelectTrigger>
                <SelectContent>
                  {eligiblePOs.length === 0
                    ? <SelectItem value="none" disabled>Tidak ada PO yang berstatus shipped</SelectItem>
                    : eligiblePOs.map(po => (
                      <SelectItem key={po.id} value={String(po.id)}>
                        {po.orderNumber} — {po.dealerName} ({po.items.length} item)
                      </SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Diterima Oleh <span className="text-destructive">*</span></Label>
              <Input
                value={receivedBy}
                onChange={e => setReceivedBy(e.target.value)}
                placeholder="Nama petugas penerima"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>No. Invoice</Label>
                <Input
                  value={invoiceNumber}
                  onChange={e => setInvoiceNumber(e.target.value)}
                  placeholder="Contoh: INV-2024-001"
                />
              </div>
              <div className="space-y-2">
                <Label>Tautan Invoice (opsional)</Label>
                <Input
                  value={invoiceUrl}
                  onChange={e => setInvoiceUrl(e.target.value)}
                  placeholder="https://... (scan/foto invoice)"
                />
              </div>
            </div>

            {selectedPO && formItems.length > 0 && (
              <div className="space-y-3">
                <Label>Verifikasi Item</Label>
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Barang</th>
                        <th className="text-center px-3 py-2 font-medium text-muted-foreground w-20">Pesan</th>
                        <th className="text-center px-3 py-2 font-medium text-muted-foreground w-20">Terima</th>
                        <th className="text-center px-3 py-2 font-medium text-muted-foreground w-28">Kondisi</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Catatan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formItems.map((item, idx) => (
                        <tr key={idx} className="border-t border-border">
                          <td className="px-3 py-2 font-medium">{item.itemName}</td>
                          <td className="px-3 py-2 text-center text-muted-foreground">{item.orderedQty}</td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              min={0}
                              value={item.receivedQty}
                              onChange={e => updateFormItem(idx, 'receivedQty', Number(e.target.value))}
                              className="h-8 text-center"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Select
                              value={item.conditionStatus}
                              onValueChange={val => updateFormItem(idx, 'conditionStatus', val)}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="baik">Baik</SelectItem>
                                <SelectItem value="rusak">Rusak</SelectItem>
                                <SelectItem value="expired">Expired</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              value={item.notes}
                              onChange={e => updateFormItem(idx, 'notes', e.target.value)}
                              placeholder="Opsional"
                              className="h-8"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {formItems.some(item => item.receivedQty !== item.orderedQty) && (
                  <p className="text-xs text-warning flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Ada selisih antara jumlah yang dipesan dan yang diterima. Pastikan sudah benar sebelum menyimpan.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Catatan Penerimaan</Label>
              <Textarea
                value={receiptNotes}
                onChange={e => setReceiptNotes(e.target.value)}
                placeholder="Catatan umum penerimaan (opsional)"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Batal</Button>
            <Button onClick={handleCreate} disabled={isSaving || !selectedPO || !receivedBy.trim()}>
              {isSaving ? 'Menyimpan...' : 'Simpan sebagai Draft'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Detail */}
      <Dialog open={!!selectedReceipt} onOpenChange={() => setSelectedReceipt(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedReceipt && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <PackageCheck className="h-5 w-5" />
                  {selectedReceipt.receiptNumber}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Purchase Order</p>
                    <p className="font-semibold">{selectedReceipt.poNumber}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Dealer</p>
                    <p className="font-semibold">{selectedReceipt.dealerName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Diterima Oleh</p>
                    <p className="font-semibold">{selectedReceipt.receivedBy}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Tanggal</p>
                    <p className="font-semibold">{new Date(selectedReceipt.receivedAt).toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <Badge variant="outline" className={statusConfig[selectedReceipt.status].class}>
                      {statusConfig[selectedReceipt.status].label}
                    </Badge>
                  </div>
                  {selectedReceipt.invoiceNumber && (
                    <div>
                      <p className="text-muted-foreground">No. Invoice</p>
                      <p className="font-semibold">
                        {selectedReceipt.invoiceNumber}
                        {selectedReceipt.invoiceUrl && (
                          <a href={selectedReceipt.invoiceUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline ml-2 font-normal text-xs">
                            Lihat Invoice
                          </a>
                        )}
                      </p>
                    </div>
                  )}
                  {selectedReceipt.notes && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Catatan</p>
                      <p>{selectedReceipt.notes}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Detail Item</p>
                  <div className="rounded-lg border border-border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Barang</th>
                          <th className="text-center px-3 py-2 font-medium text-muted-foreground">Pesan</th>
                          <th className="text-center px-3 py-2 font-medium text-muted-foreground">Terima</th>
                          <th className="text-center px-3 py-2 font-medium text-muted-foreground">Selisih</th>
                          <th className="text-center px-3 py-2 font-medium text-muted-foreground">Kondisi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedReceipt.items.map((item, idx) => {
                          const selisih = item.receivedQty - item.orderedQty
                          return (
                            <tr key={idx} className="border-t border-border">
                              <td className="px-3 py-2 font-medium">{item.itemName}</td>
                              <td className="px-3 py-2 text-center">{item.orderedQty}</td>
                              <td className="px-3 py-2 text-center">{item.receivedQty}</td>
                              <td className="px-3 py-2 text-center">
                                <span className={selisih === 0 ? 'text-muted-foreground' : selisih < 0 ? 'text-destructive font-semibold' : 'text-success font-semibold'}>
                                  {selisih === 0 ? '—' : (selisih > 0 ? '+' : '') + selisih}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-center">
                                <Badge variant="outline" className={conditionConfig[item.conditionStatus].class}>
                                  {conditionConfig[item.conditionStatus].label}
                                </Badge>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {selectedReceipt.status === 'draft' && (
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      variant="outline"
                      className="text-success border-success/30 hover:bg-success/10"
                      onClick={() => { setConfirmTarget(selectedReceipt); setSelectedReceipt(null) }}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Konfirmasi Penerimaan
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Konfirmasi */}
      <Dialog open={!!confirmTarget} onOpenChange={() => setConfirmTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Konfirmasi Penerimaan Barang</DialogTitle>
            <DialogDescription>
              Tindakan ini akan mengkonfirmasi penerimaan <strong>{confirmTarget?.receiptNumber}</strong> dan otomatis mengubah status PO <strong>{confirmTarget?.poNumber}</strong> menjadi <strong>Delivered</strong>. Tidak bisa dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmTarget(null)}>Batal</Button>
            <Button onClick={handleConfirm} disabled={isSaving} className="bg-success hover:bg-success/90 text-success-foreground">
              {isSaving ? 'Mengkonfirmasi...' : 'Ya, Konfirmasi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Hapus */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Draft Penerimaan</DialogTitle>
            <DialogDescription>
              Hapus draft <strong>{deleteTarget?.receiptNumber}</strong>? Data ini tidak bisa dipulihkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Batal</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSaving}>
              {isSaving ? 'Menghapus...' : 'Hapus'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
