import { useCallback, useEffect, useState } from 'react'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { usePolling } from '@/hooks/use-polling'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api, type ShipmentRecord } from '@/src/lib/api'
import { useAuth } from '@/lib/auth-context'
import { Search, Package, Truck, CheckCircle2, MapPin, Clock } from 'lucide-react'

// Bug #5 fix: hapus step 'in_transit' dan 'packed'/'created' yang tidak ada di DB ENUM
// DB hanya punya: pending, processing, shipped, delivered
const trackingSteps = [
  { status: 'pending',    label: 'Menunggu Proses', icon: Package },
  { status: 'processing', label: 'Diproses / Dikemas', icon: Package },
  { status: 'shipped',    label: 'Dikirim', icon: Truck },
  { status: 'delivered',  label: 'Terkirim', icon: CheckCircle2 },
]

const getStepIndex = (status: string) => {
  const statusMap: Record<string, number> = {
    pending: 0,
    processing: 1,
    shipped: 2,
    delivered: 3,
  }
  return statusMap[status] ?? 0
}

export default function TrackingPage() {
  const { user } = useAuth()
  const [shipments, setShipments] = useState<ShipmentRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedShipment, setSelectedShipment] = useState<ShipmentRecord | null>(null)
  const [showUpdateDialog, setShowUpdateDialog] = useState(false)
  const [updateForm, setUpdateForm] = useState<{ status: ShipmentRecord['status']; currentLocation: string }>({ status: 'processing', currentLocation: '' })
  const [isUpdating, setIsUpdating] = useState(false)

  // Gap #4 fix: polling setiap 15 detik agar data tracking selalu fresh (WBS 1.9 & 1.15)
  const fetchShipments = useCallback(async () => {
    try {
      const data = await api.shipments.list()
      setShipments(data)
      // Sync selectedShipment jika sedang ditampilkan
      setSelectedShipment(prev =>
        prev ? (data.find(s => s.id === prev.id) ?? prev) : null
      )
    } catch {
      // biarkan data lama tampil, jangan hapus UI
    } finally {
      setIsLoading(false)
    }
  }, [])

  usePolling(fetchShipments, 15_000)

  const handleSearch = () => {
    const found = shipments.find(s =>
      s.trackingNumber.toLowerCase().includes(searchTerm.toLowerCase())
    )
    setSelectedShipment(found || null)
  }

  const openUpdateDialog = (shipment: ShipmentRecord) => {
    setUpdateForm({ status: shipment.status, currentLocation: shipment.currentLocation || '' })
    setShowUpdateDialog(true)
  }

  const handleUpdateLokasi = async () => {
    if (!selectedShipment) return
    if (!updateForm.currentLocation.trim()) { alert('Lokasi wajib diisi'); return }
    setIsUpdating(true)
    try {
      await api.shipments.updateStatus(selectedShipment.id, updateForm.status, updateForm.currentLocation)
      const updated = { ...selectedShipment, status: updateForm.status, currentLocation: updateForm.currentLocation }
      setShipments(items => items.map(s => s.id === selectedShipment.id ? updated : s))
      setSelectedShipment(updated)
      setShowUpdateDialog(false)
    } catch {
      alert('Gagal memperbarui lokasi.')
    } finally {
      setIsUpdating(false)
    }
  }

  const currentStepIndex = selectedShipment ? getStepIndex(selectedShipment.status) : -1
  const isLogistik = user?.role === 'logistik'

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tracking Pengiriman</h1>
          <p className="text-muted-foreground">Lacak status pengiriman barang</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Cari Pengiriman</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Masukkan nomor resi..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-9"
                />
              </div>
              <Button onClick={handleSearch}>
                <Search className="w-4 h-4 mr-2" />
                Lacak
              </Button>
            </div>
            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-2">Contoh nomor resi:</p>
              <div className="flex flex-wrap gap-2">
                {isLoading ? (
                  <p className="text-sm text-muted-foreground">Memuat...</p>
                ) : shipments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada data pengiriman.</p>
                ) : shipments.slice(0, 4).map((shipment) => (
                  <Button
                    key={shipment.id}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchTerm(shipment.trackingNumber)
                      setSelectedShipment(shipment)
                    }}
                  >
                    {shipment.trackingNumber}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {selectedShipment && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Detail Pengiriman</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    No. Resi: <span className="font-mono font-medium">{selectedShipment.trackingNumber}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isLogistik && selectedShipment.status !== 'delivered' && (
                    <Button size="sm" onClick={() => openUpdateDialog(selectedShipment)}>
                      <MapPin className="w-4 h-4 mr-1" />
                      Update Lokasi
                    </Button>
                  )}
                  <Badge
                    variant="outline"
                    className={
                      selectedShipment.status === 'delivered'
                        ? 'bg-success/10 text-success border-success/20'
                        : selectedShipment.status === 'shipped'
                        ? 'bg-primary/10 text-primary border-primary/20'
                        : 'bg-warning/10 text-warning border-warning/20'
                    }
                  >
                    {selectedShipment.status === 'delivered'
                      ? 'Terkirim'
                      : selectedShipment.status === 'shipped'
                      ? 'Dikirim'
                      : selectedShipment.status === 'processing'
                      ? 'Diproses'
                      : 'Menunggu'}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
              </div>

              <div className="relative">
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />
                <div className="space-y-8">
                  {trackingSteps.map((step, index) => {
                    const Icon = step.icon
                    const isCompleted = index <= currentStepIndex
                    const isCurrent = index === currentStepIndex

                    return (
                      <div key={step.status} className="relative flex items-start gap-4">
                        <div
                          className={`relative z-10 flex items-center justify-center w-12 h-12 rounded-full border-2 ${
                            isCompleted
                              ? 'bg-primary border-primary text-primary-foreground'
                              : 'bg-background border-border text-muted-foreground'
                          } ${isCurrent ? 'ring-4 ring-primary/20' : ''}`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="pt-2">
                          <p className={`font-medium ${isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {step.label}
                          </p>
                          {isCompleted && (
                            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              <span>
                                {new Date(
                                  new Date(selectedShipment.date).getTime() + index * 86400000
                                ).toLocaleDateString('id-ID', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                          )}
                          {isCurrent && selectedShipment.status !== 'delivered' && (
                            <p className="text-sm text-primary mt-1">Status saat ini</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Pengiriman Terbaru</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Memuat data pengiriman...</p>
              ) : shipments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada data pengiriman.</p>
              ) : shipments.slice(0, 5).map((shipment) => (
                <div
                  key={shipment.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => {
                    setSearchTerm(shipment.trackingNumber)
                    setSelectedShipment(shipment)
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Package className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-mono font-medium">{shipment.trackingNumber}</p>
                      <p className="text-sm text-muted-foreground">{shipment.destination}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant="outline"
                      className={
                        shipment.status === 'delivered'
                          ? 'bg-success/10 text-success border-success/20'
                          : shipment.status === 'shipped'
                          ? 'bg-primary/10 text-primary border-primary/20'
                          : 'bg-warning/10 text-warning border-warning/20'
                      }
                    >
                      {shipment.status === 'delivered'
                        ? 'Terkirim'
                        : shipment.status === 'shipped'
                        ? 'Dikirim'
                        : shipment.status === 'processing'
                        ? 'Diproses'
                        : 'Menunggu'}
                    </Badge>
                    <p className="text-sm text-muted-foreground mt-1">
                      {new Date(shipment.date).toLocaleDateString('id-ID')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Dialog Update Lokasi - hanya untuk role logistik */}
        <Dialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Lokasi Kendaraan</DialogTitle>
            </DialogHeader>
            {selectedShipment && (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-muted/50 text-sm">
                  <p><span className="text-muted-foreground">No. Resi:</span> <span className="font-mono font-medium">{selectedShipment.trackingNumber}</span></p>
                  <p><span className="text-muted-foreground">Tujuan:</span> {selectedShipment.destination}</p>
                </div>
                <div className="space-y-2">
                  <Label>Lokasi Kendaraan Saat Ini <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="Contoh: Tol Cipularang KM 72..."
                    value={updateForm.currentLocation}
                    onChange={(e) => setUpdateForm({ ...updateForm, currentLocation: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status Pengiriman</Label>
                  <Select
                    value={updateForm.status}
                    onValueChange={(status: ShipmentRecord['status']) => setUpdateForm({ ...updateForm, status })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Menunggu</SelectItem>
                      <SelectItem value="processing">Diproses / Packing</SelectItem>
                      <SelectItem value="shipped">Dikirim / Dalam Perjalanan</SelectItem>
                      <SelectItem value="delivered">Terkirim / Sampai Tujuan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowUpdateDialog(false)}>Batal</Button>
                  <Button onClick={handleUpdateLokasi} disabled={isUpdating}>
                    {isUpdating ? 'Menyimpan...' : 'Simpan Lokasi'}
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
