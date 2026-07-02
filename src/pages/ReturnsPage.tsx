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
import { api, type InventoryRecord, type ReturnRecord, type DocumentRecord } from '@/src/lib/api'
import { Search, Plus, RotateCcw, Clock, CheckCircle2, XCircle, AlertCircle, Printer, FileText } from 'lucide-react'
import { openPrintWindow } from '@/src/lib/document-print'

const statusColors = {
  pending: 'bg-warning/10 text-warning border-warning/20',
  approved: 'bg-primary/10 text-primary border-primary/20',
  rejected: 'bg-destructive/10 text-destructive border-destructive/20',
  completed: 'bg-success/10 text-success border-success/20',
}

const statusLabels = {
  pending: 'Menunggu',
  approved: 'Disetujui',
  rejected: 'Ditolak',
  completed: 'Selesai',
}

export default function ReturnsPage() {
  const [returns, setReturns] = useState<ReturnRecord[]>([])
  const [inventory, setInventory] = useState<InventoryRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [formData, setFormData] = useState({
    itemName: '',
    quantity: 1,
    reason: 'Barang Cacat',
    requester: 'Dealer',
  })
  const [returDocs, setReturDocs] = useState<Record<number, DocumentRecord>>({})
  const [generatingId, setGeneratingId] = useState<number | null>(null)

  useEffect(() => {
    Promise.allSettled([api.returns.list(), api.inventory.list()])
      .then(([returnsResult, inventoryResult]) => {
        if (returnsResult.status === 'fulfilled') setReturns(returnsResult.value)
        if (inventoryResult.status === 'fulfilled') {
          setInventory(inventoryResult.value)
          setFormData((form) => ({ ...form, itemName: form.itemName || inventoryResult.value[0]?.name || '' }))
        }
      })
      .finally(() => setIsLoading(false))
  }, [])

  const handleCreateReturn = async () => {
    const created = await api.returns.create(formData)
    setReturns((items) => [created, ...items])
    setShowCreateDialog(false)
  }

  const handleStatusChange = async (id: number, status: ReturnRecord['status']) => {
    await api.returns.updateStatus(id, status)
    setReturns((items) => items.map((item) => item.id === id ? { ...item, status } : item))
  }

  // WBS 1.5.4 / 1.11.4 — generate surat retur untuk retur yang sudah disetujui/selesai
  const handleGenerateSuratRetur = async (ret: ReturnRecord, autoPrint: boolean) => {
    setGeneratingId(ret.id)
    try {
      let doc = returDocs[ret.id]
      if (!doc) {
        doc = await api.documents.create({
          type: 'retur',
          relatedTo: `${ret.returnNumber} — ${ret.itemName}`,
          status: 'final',
        })
        setReturDocs((prev) => ({ ...prev, [ret.id]: doc }))
      }
      openPrintWindow({
        number: doc.number,
        type: 'retur',
        relatedTo: doc.relatedTo,
        date: doc.date,
        status: doc.status,
        extraLines: [
          { label: 'Jumlah Barang', value: String(ret.quantity) },
          { label: 'Alasan Retur', value: ret.reason },
          { label: 'Pemohon', value: ret.requester },
        ],
      }, autoPrint)
    } catch {
      alert('Gagal membuat surat retur. Pastikan backend aktif.')
    } finally {
      setGeneratingId(null)
    }
  }

  const filteredReturns = returns.filter((ret) => {
    const matchesSearch = ret.returnNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ret.itemName.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = filterStatus === 'all' || ret.status === filterStatus
    return matchesSearch && matchesStatus
  })

  const pendingCount = returns.filter(r => r.status === 'pending').length
  const approvedCount = returns.filter(r => r.status === 'approved').length
  const completedCount = returns.filter(r => r.status === 'completed').length
  const rejectedCount = returns.filter(r => r.status === 'rejected').length

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Manajemen Retur</h1>
            <p className="text-muted-foreground">Kelola permintaan retur barang</p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Buat Permintaan Retur
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Buat Permintaan Retur</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Pilih Barang</Label>
                  <Select value={formData.itemName} onValueChange={(itemName) => setFormData({ ...formData, itemName })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih barang" />
                    </SelectTrigger>
                    <SelectContent>
                      {inventory.map((item) => (
                        <SelectItem key={item.id} value={item.name}>
                          {item.sku} - {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Jumlah</Label>
                  <Input type="number" placeholder="0" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Alasan Retur</Label>
                  <Select value={formData.reason} onValueChange={(reason) => setFormData({ ...formData, reason })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih alasan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Barang Cacat">Barang Cacat</SelectItem>
                      <SelectItem value="Barang Rusak">Barang Rusak</SelectItem>
                      <SelectItem value="Salah Kirim">Salah Kirim</SelectItem>
                      <SelectItem value="Tidak Sesuai Pesanan">Tidak Sesuai Pesanan</SelectItem>
                      <SelectItem value="Expired">Expired</SelectItem>
                      <SelectItem value="Lainnya">Lainnya</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Deskripsi Tambahan</Label>
                  <Textarea placeholder="Jelaskan kondisi barang..." onChange={(e) => e.target.value && setFormData({ ...formData, reason: e.target.value })} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Batal</Button>
                  <Button onClick={handleCreateReturn}>Kirim Permintaan</Button>
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
                  <AlertCircle className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Disetujui</p>
                  <p className="text-2xl font-bold">{approvedCount}</p>
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
                  <p className="text-sm text-muted-foreground">Selesai</p>
                  <p className="text-2xl font-bold">{completedCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-destructive/10">
                  <XCircle className="w-6 h-6 text-destructive" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ditolak</p>
                  <p className="text-2xl font-bold">{rejectedCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <CardTitle>Daftar Permintaan Retur</CardTitle>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Cari retur..."
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
                    <SelectItem value="approved">Disetujui</SelectItem>
                    <SelectItem value="completed">Selesai</SelectItem>
                    <SelectItem value="rejected">Ditolak</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No. Retur</TableHead>
                  <TableHead>Barang</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Alasan</TableHead>
                  <TableHead>Pemohon</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-6">Memuat data retur...</TableCell>
                  </TableRow>
                ) : filteredReturns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-6">Belum ada permintaan retur.</TableCell>
                  </TableRow>
                ) : filteredReturns.map((ret) => (
                  <TableRow key={ret.id}>
                    <TableCell className="font-mono text-sm font-medium">{ret.returnNumber}</TableCell>
                    <TableCell>{ret.itemName}</TableCell>
                    <TableCell className="text-right">{ret.quantity}</TableCell>
                    <TableCell>{ret.reason}</TableCell>
                    <TableCell>{ret.requester}</TableCell>
                    <TableCell>{new Date(ret.requestDate).toLocaleDateString('id-ID')}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColors[ret.status]}>
                        {statusLabels[ret.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {ret.status === 'pending' && (
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" className="text-success hover:text-success" onClick={() => handleStatusChange(ret.id, 'approved')}>
                            <CheckCircle2 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleStatusChange(ret.id, 'rejected')}>
                            <XCircle className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                      {(ret.status === 'approved' || ret.status === 'completed') && (
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Cetak Surat Retur"
                            disabled={generatingId === ret.id}
                            onClick={() => handleGenerateSuratRetur(ret, true)}
                          >
                            <Printer className="w-4 h-4 mr-1" />
                            Surat Retur
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Download Surat Retur"
                            disabled={generatingId === ret.id}
                            onClick={() => handleGenerateSuratRetur(ret, false)}
                          >
                            <FileText className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                      {ret.status === 'rejected' && (
                        <Button variant="ghost" size="sm" disabled>
                          <RotateCcw className="w-4 h-4 mr-1" />
                          Ditolak
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
