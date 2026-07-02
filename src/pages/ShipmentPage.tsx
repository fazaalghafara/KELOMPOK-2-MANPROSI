import { useCallback, useEffect, useState } from 'react'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { usePolling } from '@/hooks/use-polling'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api, type InventoryRecord, type ShipmentRecord } from '@/src/lib/api'
import { Search, Plus, Truck, Package, Clock, CheckCircle2, FileText, Eye } from 'lucide-react'

const statusColors = {
  pending: 'bg-warning/10 text-warning border-warning/20',
  processing: 'bg-primary/10 text-primary border-primary/20',
  shipped: 'bg-chart-4/10 text-chart-4 border-chart-4/20',
  delivered: 'bg-success/10 text-success border-success/20',
}

const statusLabels = {
  pending: 'Menunggu',
  processing: 'Diproses',
  shipped: 'Dikirim',
  delivered: 'Terkirim',
}

const COMPANY_NAME = 'SupplyTrack Distribution'
const COMPANY_ADDRESS = 'Jl. Industri Raya No. 1, Jakarta Warehouse'

function generateSuratJalanHTML(shipment: ShipmentRecord): string {
  const tgl = new Date(shipment.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  return `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><title>Surat Jalan ${shipment.trackingNumber}</title>
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
    .sign-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-top: 48px; text-align: center; }
    .sign-box { border-top: 1px solid #111; padding-top: 4px; margin-top: 56px; }
    @media print { body { margin: 16px; } }
  </style></head><body>
  <h2>${COMPANY_NAME}</h2>
  <p class="subtitle">${COMPANY_ADDRESS}</p>
  <hr/>
  <h2 style="margin:8px 0">SURAT JALAN</h2>
  <div class="info-grid">
    <div><span class="label">No. Surat Jalan</span><span class="value">${shipment.trackingNumber}</span></div>
    <div><span class="label">Tanggal Kirim</span><span class="value">${tgl}</span></div>
    <div><span class="label">Tujuan</span><span class="value">${shipment.destination}</span></div>
    <div><span class="label">Asal Gudang</span><span class="value">${shipment.origin || COMPANY_ADDRESS}</span></div>
    <div><span class="label">Nama Driver</span><span class="value">${shipment.driverName || '-'}</span></div>
    <div><span class="label">No. Plat Kendaraan</span><span class="value">${shipment.vehiclePlate || '-'}</span></div>
    <div><span class="label">Estimasi Tiba</span><span class="value">${shipment.estimatedDelivery || '-'}</span></div>
    <div><span class="label">Status</span><span class="value">${shipment.status.toUpperCase()}</span></div>
  </div>
  <table>
    <thead><tr><th>No</th><th>Keterangan</th><th>Jumlah</th><th>Keterangan Kondisi</th></tr></thead>
    <tbody>
      <tr><td>1</td><td>Paket Pengiriman ke ${shipment.destination}</td><td>${shipment.items} item</td><td>Kondisi Baik</td></tr>
    </tbody>
  </table>
  <div class="sign-grid">
    <div><div class="sign-box">Pengirim</div><div>${COMPANY_NAME}</div></div>
    <div><div class="sign-box">Driver / Kurir</div><div>${shipment.driverName || '_______________'}</div></div>
    <div><div class="sign-box">Penerima</div><div>${shipment.destination}</div></div>
  </div>
  <script>window.onload = () => window.print()</script>
  </body></html>`
}

function generatePickingListHTML(shipment: ShipmentRecord): string {
  const tgl = new Date(shipment.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  return `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><title>Picking List ${shipment.trackingNumber}</title>
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
    .check { width: 32px; text-align: center; }
    .sign-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 48px; text-align: center; }
    .sign-box { border-top: 1px solid #111; padding-top: 4px; margin-top: 56px; }
    @media print { body { margin: 16px; } }
  </style></head><body>
  <h2>${COMPANY_NAME}</h2>
  <p class="subtitle">${COMPANY_ADDRESS}</p>
  <hr/>
  <h2 style="margin:8px 0">PICKING LIST</h2>
  <div class="info-grid">
    <div><span class="label">No. Referensi</span><span class="value">${shipment.trackingNumber}</span></div>
    <div><span class="label">Tanggal Picking</span><span class="value">${tgl}</span></div>
    <div><span class="label">Tujuan Pengiriman</span><span class="value">${shipment.destination}</span></div>
    <div><span class="label">Total Item</span><span class="value">${shipment.items} item</span></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>No</th>
        <th>Nama Barang</th>
        <th>Lokasi Rak</th>
        <th>Jumlah Diminta</th>
        <th>Jumlah Diambil</th>
        <th class="check">✓</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>1</td>
        <td>Barang Pengiriman ke ${shipment.destination}</td>
        <td>-</td>
        <td>${shipment.items} item</td>
        <td></td>
        <td class="check">☐</td>
      </tr>
    </tbody>
  </table>
  <p style="margin-top:12px;font-size:11px;color:#555">* Centang kolom ✓ setelah barang diambil dari rak. Pastikan jumlah sesuai sebelum diserahkan ke driver.</p>
  <div class="sign-grid">
    <div><div class="sign-box">Petugas Picking</div></div>
    <div><div class="sign-box">Supervisor Gudang</div></div>
  </div>
  <script>window.onload = () => window.print()</script>
  </body></html>`
}

function openDocumentWindow(html: string) {
  const win = window.open('', '_blank')
  if (win) {
    win.document.write(html)
    win.document.close()
  }
}

export default function ShipmentPage() {
  const [shipments, setShipments] = useState<ShipmentRecord[]>([])
  const [inventory, setInventory] = useState<InventoryRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [selectedShipment, setSelectedShipment] = useState<ShipmentRecord | null>(null)
  const [generatingDoc, setGeneratingDoc] = useState<number | null>(null)
  const [formData, setFormData] = useState<Omit<ShipmentRecord, 'id'>>({
    trackingNumber: `SHP-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
    destination: '',
    date: new Date().toISOString().slice(0, 10),
    items: 0,
    status: 'pending',
  })

  // Gap #4 fix: polling setiap 20 detik agar tabel shipment selalu fresh (WBS 1.9)
  const fetchData = useCallback(async () => {
    try {
      const [shipmentsResult, inventoryResult] = await Promise.allSettled([
        api.shipments.list(),
        api.inventory.list(),
      ])
      if (shipmentsResult.status === 'fulfilled') setShipments(shipmentsResult.value)
      if (inventoryResult.status === 'fulfilled') setInventory(inventoryResult.value)
    } finally {
      setIsLoading(false)
    }
  }, [])

  usePolling(fetchData, 20_000)

  const handleCreateShipment = async () => {
    const created = await api.shipments.create(formData)
    setShipments((items) => [created, ...items])
    setFormData({
      trackingNumber: `SHP-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
      destination: '',
      date: new Date().toISOString().slice(0, 10),
      items: 0,
      status: 'pending',
    })
    setShowCreateDialog(false)
  }

  const handleStatusChange = async (id: number, status: ShipmentRecord['status']) => {
    await api.shipments.updateStatus(id, status)
    setShipments((items) => items.map((item) => item.id === id ? { ...item, status } : item))
  }

  const handleGenerateSuratJalan = async (shipment: ShipmentRecord) => {
    setGeneratingDoc(shipment.id)
    try {
      await api.documents.create({ type: 'surat_jalan', relatedTo: shipment.trackingNumber, status: 'final' })
    } catch { /* dokumen mungkin sudah ada, tetap buka */ }
    openDocumentWindow(generateSuratJalanHTML(shipment))
    setGeneratingDoc(null)
  }

  const handleGeneratePickingList = async (shipment: ShipmentRecord) => {
    setGeneratingDoc(shipment.id)
    try {
      await api.documents.create({ type: 'picking_list', relatedTo: shipment.trackingNumber, status: 'final' })
    } catch { /* dokumen mungkin sudah ada, tetap buka */ }
    openDocumentWindow(generatePickingListHTML(shipment))
    setGeneratingDoc(null)
  }

  const filteredShipments = shipments.filter((shipment) => {
    const matchesSearch = shipment.trackingNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shipment.destination.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = filterStatus === 'all' || shipment.status === filterStatus
    return matchesSearch && matchesStatus
  })

  const pendingCount = shipments.filter(s => s.status === 'pending').length
  const processingCount = shipments.filter(s => s.status === 'processing').length
  const shippedCount = shipments.filter(s => s.status === 'shipped').length
  const deliveredCount = shipments.filter(s => s.status === 'delivered').length

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Manajemen Pengiriman</h1>
            <p className="text-muted-foreground">Buat dan kelola pengiriman barang</p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Buat Pengiriman
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Buat Pengiriman Baru</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tujuan</Label>
                    <Input placeholder="Nama dealer/tujuan" value={formData.destination} onChange={(e) => setFormData({ ...formData, destination: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Alamat</Label>
                    <Input placeholder="No. resi" value={formData.trackingNumber} onChange={(e) => setFormData({ ...formData, trackingNumber: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Pilih Barang</Label>
                  <div className="border rounded-lg p-4 max-h-48 overflow-y-auto space-y-2">
                    {inventory.filter(item => item.condition === 'baik').length === 0 ? (
                      <p className="text-sm text-muted-foreground">Belum ada barang dengan kondisi baik.</p>
                    ) : inventory.filter(item => item.condition === 'baik').slice(0, 5).map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                        <div>
                          <p className="font-medium text-sm">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.sku}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Stok: {item.stock}</span>
                          <Input type="number" placeholder="Qty" className="w-20" onChange={(e) => setFormData({ ...formData, items: formData.items + Number(e.target.value || 0) })} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nama Driver</Label>
                    <Input placeholder="Nama driver" value={formData.driverName || ''} onChange={(e) => setFormData({ ...formData, driverName: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>No. Plat Kendaraan</Label>
                    <Input placeholder="B 1234 ABC" value={formData.vehiclePlate || ''} onChange={(e) => setFormData({ ...formData, vehiclePlate: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Estimasi Kirim</Label>
                    <Input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Batal</Button>
                  <Button onClick={handleCreateShipment}>Buat Pengiriman</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-warning/10">
                  <Clock className="w-6 h-6 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Menunggu</p>
                  <p className="text-2xl font-bold">{pendingCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Package className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Diproses</p>
                  <p className="text-2xl font-bold">{processingCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-chart-4/10">
                  <Truck className="w-6 h-6 text-chart-4" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Dikirim</p>
                  <p className="text-2xl font-bold">{shippedCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-success/10">
                  <CheckCircle2 className="w-6 h-6 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Terkirim</p>
                  <p className="text-2xl font-bold">{deliveredCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <CardTitle>Daftar Pengiriman</CardTitle>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Cari pengiriman..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 w-64"
                  />
                </div>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Status</SelectItem>
                    <SelectItem value="pending">Menunggu</SelectItem>
                    <SelectItem value="processing">Diproses</SelectItem>
                    <SelectItem value="shipped">Dikirim</SelectItem>
                    <SelectItem value="delivered">Terkirim</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No. Resi</TableHead>
                  <TableHead>Tujuan</TableHead>
                  <TableHead>Tanggal Kirim</TableHead>
                  <TableHead className="text-right">Total Item</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dokumen</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">Memuat data pengiriman...</TableCell>
                  </TableRow>
                ) : filteredShipments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">Belum ada data pengiriman.</TableCell>
                  </TableRow>
                ) : filteredShipments.map((shipment) => (
                  <TableRow key={shipment.id}>
                    <TableCell className="font-mono text-sm font-medium">{shipment.trackingNumber}</TableCell>
                    <TableCell>{shipment.destination}</TableCell>
                    <TableCell>{new Date(shipment.date).toLocaleDateString('id-ID')}</TableCell>
                    <TableCell className="text-right">{shipment.items}</TableCell>
                    <TableCell>
                      <Select value={shipment.status} onValueChange={(status: ShipmentRecord['status']) => handleStatusChange(shipment.id, status)}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Menunggu</SelectItem>
                          <SelectItem value="processing">Diproses</SelectItem>
                          <SelectItem value="shipped">Dikirim</SelectItem>
                          <SelectItem value="delivered">Terkirim</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          disabled={generatingDoc === shipment.id}
                          onClick={() => handleGenerateSuratJalan(shipment)}
                        >
                          <FileText className="w-3 h-3 mr-1" />
                          Surat Jalan
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          disabled={generatingDoc === shipment.id}
                          onClick={() => handleGeneratePickingList(shipment)}
                        >
                          <FileText className="w-3 h-3 mr-1" />
                          Picking List
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedShipment(shipment)
                          setShowDetailDialog(true)
                        }}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Detail
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Detail Pengiriman</DialogTitle>
            </DialogHeader>
            {selectedShipment && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">No. Resi</p>
                    <p className="font-mono font-medium">{selectedShipment.trackingNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge variant="outline" className={statusColors[selectedShipment.status as keyof typeof statusColors]}>
                      {statusLabels[selectedShipment.status as keyof typeof statusLabels]}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Tujuan</p>
                    <p className="font-medium">{selectedShipment.destination}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Tanggal Kirim</p>
                    <p className="font-medium">{new Date(selectedShipment.date).toLocaleDateString('id-ID')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Item</p>
                    <p className="font-medium">{selectedShipment.items} barang</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Kendaraan</p>
                    <p className="font-medium">{selectedShipment.vehiclePlate || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Driver</p>
                    <p className="font-medium">{selectedShipment.driverName || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Origin</p>
                    <p className="font-medium">{selectedShipment.origin || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Lokasi Terkini</p>
                    <p className="font-medium">{selectedShipment.currentLocation || '-'}</p>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => handleGenerateSuratJalan(selectedShipment!)}>
                    <FileText className="w-4 h-4 mr-2" />
                    Cetak Surat Jalan
                  </Button>
                  <Button variant="outline" onClick={() => handleGeneratePickingList(selectedShipment!)}>
                    <FileText className="w-4 h-4 mr-2" />
                    Cetak Picking List
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
