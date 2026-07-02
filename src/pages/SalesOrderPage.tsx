import { useEffect, useState } from 'react'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api, type SalesOrderRecord, type InventoryRecord } from '@/src/lib/api'
import { useAuth } from '@/lib/auth-context'
import { Search, Plus, ShoppingCart, Clock, CheckCircle2, XCircle, Truck, FileText, Trash2, Eye } from 'lucide-react'

const statusColors: Record<SalesOrderRecord['status'], string> = {
  draft:      'bg-muted text-muted-foreground border-muted-foreground/20',
  submitted:  'bg-warning/10 text-warning border-warning/20',
  approved:   'bg-primary/10 text-primary border-primary/20',
  processing: 'bg-chart-4/10 text-chart-4 border-chart-4/20',
  shipped:    'bg-chart-3/10 text-chart-3 border-chart-3/20',
  delivered:  'bg-success/10 text-success border-success/20',
  cancelled:  'bg-destructive/10 text-destructive border-destructive/20',
}

const statusLabels: Record<SalesOrderRecord['status'], string> = {
  draft:      'Draft',
  submitted:  'Diajukan',
  approved:   'Disetujui',
  processing: 'Diproses',
  shipped:    'Dikirim',
  delivered:  'Terkirim',
  cancelled:  'Dibatalkan',
}

const DISTRIBUTOR_NAME = 'SupplyTrack Distribution'

function formatRupiah(amount: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount)
}

function generateSOHTML(order: SalesOrderRecord): string {
  const tgl = new Date(order.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  const rows = order.items.map((item, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${item.name}</td>
      <td style="text-align:right">${item.quantity}</td>
      <td style="text-align:right">${new Intl.NumberFormat('id-ID').format(item.unitPrice)}</td>
      <td style="text-align:right">${new Intl.NumberFormat('id-ID').format(item.quantity * item.unitPrice)}</td>
    </tr>`).join('')

  return `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><title>Sales Order ${order.orderNumber}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; margin: 32px; color: #111; }
    h2 { text-align: center; margin: 0; font-size: 18px; }
    .subtitle { text-align: center; font-size: 13px; color: #444; margin-bottom: 4px; }
    hr { border: 1.5px solid #111; margin: 10px 0; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; margin: 12px 0; }
    .info-grid span { display: block; }
    .label { color: #555; font-size: 11px; }
    .value { font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th { background: #f0f0f0; border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
    td { border: 1px solid #ccc; padding: 6px 8px; }
    .total-row td { font-weight: bold; background: #f9f9f9; }
    .sign-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 48px; text-align: center; }
    .sign-box { border-top: 1px solid #111; padding-top: 4px; margin-top: 56px; }
    @media print { body { margin: 16px; } }
  </style></head><body>
  <h2>${DISTRIBUTOR_NAME}</h2>
  <hr/>
  <h2 style="margin:8px 0">SALES ORDER</h2>
  <div class="info-grid">
    <div><span class="label">No. Sales Order</span><span class="value">${order.orderNumber}</span></div>
    <div><span class="label">Tanggal</span><span class="value">${tgl}</span></div>
    <div><span class="label">Dealer / Pembeli</span><span class="value">${order.dealerName}</span></div>
    <div><span class="label">Distributor / Penjual</span><span class="value">${order.distributorName}</span></div>
    <div><span class="label">Status</span><span class="value">${statusLabels[order.status]}</span></div>
    ${order.notes ? `<div><span class="label">Catatan</span><span class="value">${order.notes}</span></div>` : ''}
  </div>
  <table>
    <thead>
      <tr><th>No</th><th>Nama Barang</th><th style="text-align:right">Qty</th><th style="text-align:right">Harga Satuan (Rp)</th><th style="text-align:right">Subtotal (Rp)</th></tr>
    </thead>
    <tbody>
      ${rows}
      <tr class="total-row">
        <td colspan="4" style="text-align:right">TOTAL</td>
        <td style="text-align:right">${new Intl.NumberFormat('id-ID').format(order.totalAmount)}</td>
      </tr>
    </tbody>
  </table>
  <div class="sign-grid">
    <div><div class="sign-box">Dibuat oleh (Dealer)</div><div>${order.dealerName}</div></div>
    <div><div class="sign-box">Disetujui oleh (Distributor)</div><div>${order.distributorName}</div></div>
  </div>
  <script>window.onload = () => window.print()</script>
  </body></html>`
}

type ItemForm = { name: string; quantity: string; unitPrice: string }

export default function SalesOrderPage() {
  const { user } = useAuth()
  const [orders, setOrders] = useState<SalesOrderRecord[]>([])
  const [inventory, setInventory] = useState<InventoryRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<SalesOrderRecord | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Form state
  const [dealerName, setDealerName] = useState('')
  const [notes, setNotes] = useState('')
  const [soItems, setSoItems] = useState<ItemForm[]>([{ name: '', quantity: '1', unitPrice: '0' }])

  const isDealer = user?.role === 'dealer'
  const isManager = user?.role === 'manager'
  const isGudang = user?.role === 'gudang'

  useEffect(() => {
    Promise.allSettled([api.salesOrders.list(), api.inventory.list()])
      .then(([ordersRes, inventoryRes]) => {
        if (ordersRes.status === 'fulfilled') setOrders(ordersRes.value)
        if (inventoryRes.status === 'fulfilled') setInventory(inventoryRes.value)
      })
      .finally(() => setIsLoading(false))
  }, [])

  const resetForm = () => {
    setDealerName(isDealer ? (user?.name || '') : '')
    setNotes('')
    setSoItems([{ name: '', quantity: '1', unitPrice: '0' }])
  }

  const addItem = () => setSoItems(prev => [...prev, { name: '', quantity: '1', unitPrice: '0' }])
  const removeItem = (idx: number) => setSoItems(prev => prev.filter((_, i) => i !== idx))
  const updateItem = (idx: number, field: keyof ItemForm, value: string) => {
    setSoItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  const calcTotal = () =>
    soItems.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0)

  const handleCreate = async () => {
    if (!dealerName.trim()) { alert('Nama dealer wajib diisi'); return }
    const validItems = soItems.filter(i => i.name.trim() && Number(i.quantity) > 0)
    if (!validItems.length) { alert('Minimal satu barang dengan quantity valid'); return }

    setIsSaving(true)
    try {
      const created = await api.salesOrders.create({
        dealerName: dealerName.trim(),
        items: validItems.map(i => ({ name: i.name, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice) })),
        notes: notes.trim() || undefined,
      })
      setOrders(prev => [created, ...prev])
      setShowCreateDialog(false)
      resetForm()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Gagal membuat Sales Order')
    } finally {
      setIsSaving(false)
    }
  }

  const handleStatusChange = async (id: number, status: SalesOrderRecord['status']) => {
    await api.salesOrders.updateStatus(id, status)
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o))
    if (selectedOrder?.id === id) setSelectedOrder(prev => prev ? { ...prev, status } : prev)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus Sales Order ini?')) return
    try {
      await api.salesOrders.remove(id)
      setOrders(prev => prev.filter(o => o.id !== id))
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Gagal menghapus SO')
    }
  }

  const handlePrint = (order: SalesOrderRecord) => {
    const win = window.open('', '_blank')
    if (win) { win.document.write(generateSOHTML(order)); win.document.close() }
  }

  const openDetail = (order: SalesOrderRecord) => {
    setSelectedOrder(order)
    setShowDetailDialog(true)
  }

  const filteredOrders = orders.filter(o => {
    const matchSearch = o.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.dealerName.toLowerCase().includes(searchTerm.toLowerCase())
    const matchStatus = filterStatus === 'all' || o.status === filterStatus
    return matchSearch && matchStatus
  })

  const counts = {
    draft:     orders.filter(o => o.status === 'draft').length,
    submitted: orders.filter(o => o.status === 'submitted').length,
    approved:  orders.filter(o => o.status === 'approved').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
  }

  // Determine next valid statuses for workflow
  const nextStatuses = (current: SalesOrderRecord['status']): SalesOrderRecord['status'][] => {
    const flow: Record<string, SalesOrderRecord['status'][]> = {
      draft:      ['submitted', 'cancelled'],
      submitted:  ['approved', 'cancelled'],
      approved:   ['processing'],
      processing: ['shipped'],
      shipped:    ['delivered'],
      delivered:  [],
      cancelled:  [],
    }
    return flow[current] || []
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Sales Order</h1>
            <p className="text-muted-foreground">
              {isDealer ? 'Buat dan kelola pesanan barang ke distributor' : 'Daftar pesanan dari dealer'}
            </p>
          </div>
          {(isDealer || isManager) && (
            <Dialog open={showCreateDialog} onOpenChange={(open) => { setShowCreateDialog(open); if (open) resetForm() }}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-2" />Buat Sales Order</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Buat Sales Order Baru</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nama Dealer / Pembeli</Label>
                    <Input
                      placeholder="Nama dealer"
                      value={dealerName}
                      onChange={e => setDealerName(e.target.value)}
                      disabled={isDealer}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Daftar Barang</Label>
                      <Button variant="outline" size="sm" onClick={addItem}>
                        <Plus className="w-3 h-3 mr-1" />Tambah Baris
                      </Button>
                    </div>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nama Barang</TableHead>
                            <TableHead className="w-20">Qty</TableHead>
                            <TableHead className="w-32">Harga Satuan</TableHead>
                            <TableHead className="w-10"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {soItems.map((item, idx) => (
                            <TableRow key={idx}>
                              <TableCell>
                                <Select value={item.name} onValueChange={v => updateItem(idx, 'name', v)}>
                                  <SelectTrigger className="h-8">
                                    <SelectValue placeholder="Pilih barang" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {inventory.map(inv => (
                                      <SelectItem key={inv.id} value={inv.name}>{inv.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number" min="1" className="h-8"
                                  value={item.quantity}
                                  onChange={e => updateItem(idx, 'quantity', e.target.value)}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number" min="0" className="h-8"
                                  value={item.unitPrice}
                                  onChange={e => updateItem(idx, 'unitPrice', e.target.value)}
                                />
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost" size="sm"
                                  className="text-destructive hover:text-destructive p-1"
                                  onClick={() => removeItem(idx)}
                                  disabled={soItems.length === 1}
                                ><Trash2 className="w-4 h-4" /></Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="flex justify-end text-sm font-medium">
                      Total: {formatRupiah(calcTotal())}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Catatan (opsional)</Label>
                    <Textarea
                      placeholder="Catatan tambahan untuk distributor..."
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      rows={2}
                    />
                  </div>

                  <div className="flex gap-2 justify-end pt-2">
                    <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Batal</Button>
                    <Button onClick={handleCreate} disabled={isSaving}>
                      {isSaving ? 'Menyimpan...' : 'Simpan sebagai Draft'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: 'Draft', count: counts.draft, icon: FileText, color: 'text-muted-foreground' },
            { label: 'Diajukan', count: counts.submitted, icon: Clock, color: 'text-warning' },
            { label: 'Disetujui', count: counts.approved, icon: CheckCircle2, color: 'text-primary' },
            { label: 'Terkirim', count: counts.delivered, icon: Truck, color: 'text-success' },
          ].map(({ label, count, icon: Icon, color }) => (
            <Card key={label}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{count}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filter & Search */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Cari nomor SO atau nama dealer..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Semua status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  {Object.entries(statusLabels).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Belum ada Sales Order</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>No. SO</TableHead>
                      <TableHead>Dealer</TableHead>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map(order => (
                      <TableRow key={order.id}>
                        <TableCell className="font-mono text-sm font-medium">{order.orderNumber}</TableCell>
                        <TableCell>{order.dealerName}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(order.createdAt).toLocaleDateString('id-ID')}
                        </TableCell>
                        <TableCell>{order.items.length} item</TableCell>
                        <TableCell className="font-medium">{formatRupiah(order.totalAmount)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusColors[order.status]}>
                            {statusLabels[order.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            <Button variant="ghost" size="sm" onClick={() => openDetail(order)}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handlePrint(order)}>
                              <FileText className="w-4 h-4" />
                            </Button>
                            {/* Workflow buttons */}
                            {nextStatuses(order.status).map(next => (
                              <Button
                                key={next}
                                variant="outline"
                                size="sm"
                                className="text-xs h-7"
                                onClick={() => handleStatusChange(order.id, next)}
                              >
                                {next === 'submitted' && 'Ajukan'}
                                {next === 'approved' && 'Setujui'}
                                {next === 'processing' && 'Proses'}
                                {next === 'shipped' && 'Kirim'}
                                {next === 'delivered' && 'Terima'}
                                {next === 'cancelled' && <><XCircle className="w-3 h-3 mr-1" />Batalkan</>}
                              </Button>
                            ))}
                            {/* Delete only draft/cancelled */}
                            {(order.status === 'draft' || order.status === 'cancelled') && (isDealer || isManager) && (
                              <Button
                                variant="ghost" size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleDelete(order.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detail Dialog */}
        {selectedOrder && (
          <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Detail Sales Order — {selectedOrder.orderNumber}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Dealer:</span> <span className="font-medium">{selectedOrder.dealerName}</span></div>
                  <div><span className="text-muted-foreground">Distributor:</span> <span className="font-medium">{selectedOrder.distributorName}</span></div>
                  <div><span className="text-muted-foreground">Tanggal:</span> <span className="font-medium">{new Date(selectedOrder.createdAt).toLocaleDateString('id-ID')}</span></div>
                  <div>
                    <span className="text-muted-foreground">Status: </span>
                    <Badge variant="outline" className={statusColors[selectedOrder.status]}>
                      {statusLabels[selectedOrder.status]}
                    </Badge>
                  </div>
                  {selectedOrder.notes && (
                    <div className="col-span-2"><span className="text-muted-foreground">Catatan:</span> <span>{selectedOrder.notes}</span></div>
                  )}
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Barang</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Harga Satuan</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedOrder.items.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">{formatRupiah(item.unitPrice)}</TableCell>
                        <TableCell className="text-right font-medium">{formatRupiah(item.quantity * item.unitPrice)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={3} className="text-right font-bold">Total</TableCell>
                      <TableCell className="text-right font-bold text-lg">{formatRupiah(selectedOrder.totalAmount)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => handlePrint(selectedOrder)}>
                    <FileText className="w-4 h-4 mr-2" />Cetak SO
                  </Button>
                  {nextStatuses(selectedOrder.status).map(next => (
                    <Button
                      key={next}
                      variant={next === 'cancelled' ? 'destructive' : 'default'}
                      size="sm"
                      onClick={() => handleStatusChange(selectedOrder.id, next)}
                    >
                      {next === 'submitted' && 'Ajukan ke Distributor'}
                      {next === 'approved' && 'Setujui SO'}
                      {next === 'processing' && 'Mulai Proses'}
                      {next === 'shipped' && 'Tandai Dikirim'}
                      {next === 'delivered' && 'Konfirmasi Terima'}
                      {next === 'cancelled' && 'Batalkan SO'}
                    </Button>
                  ))}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </DashboardLayout>
  )
}
