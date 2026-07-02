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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api, type InventoryRecord, type StockOpnameRecord, type ItemHistoryRecord } from '@/src/lib/api'
import { useAuth } from '@/lib/auth-context'
import { Search, Plus, Package, AlertTriangle, CheckCircle2, XCircle, Download, Upload, ClipboardList, History, TrendingUp, TrendingDown, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'

const conditionColors = {
  baik: 'bg-success/10 text-success border-success/20',
  rusak: 'bg-destructive/10 text-destructive border-destructive/20',
  expired: 'bg-warning/10 text-warning border-warning/20',
}

const conditionLabels = {
  baik: 'Baik',
  rusak: 'Rusak',
  expired: 'Expired',
}

export default function InventoryPage() {
  const { user } = useAuth()
  const [inventory, setInventory] = useState<InventoryRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCondition, setFilterCondition] = useState<string>('all')
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showStockOpnameDialog, setShowStockOpnameDialog] = useState(false)
  const [showOpnameHistoryDialog, setShowOpnameHistoryDialog] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryRecord | null>(null)
  const [filterRack, setFilterRack] = useState<string>('all')
  const [filterPallet, setFilterPallet] = useState<string>('all')
  const [opnamePhysicalStocks, setOpnamePhysicalStocks] = useState<Record<number, number>>({})
  const [opnameConductedBy, setOpnameConductedBy] = useState('')
  const [opnameNotes, setOpnameNotes] = useState('')
  const [opnameSaving, setOpnameSaving] = useState(false)
  const [opnameHistory, setOpnameHistory] = useState<StockOpnameRecord[]>([])
  const [opnameHistoryLoading, setOpnameHistoryLoading] = useState(false)
  const [opnameConfirmingId, setOpnameConfirmingId] = useState<number | null>(null)
  const [rackInputMode, setRackInputMode] = useState<'existing' | 'new'>('existing')
  const [palletInputMode, setPalletInputMode] = useState<'existing' | 'new'>('existing')
  const [reorderItem, setReorderItem] = useState<InventoryRecord | null>(null)
  const [reorderQty, setReorderQty] = useState('')
  const [reorderSupplier, setReorderSupplier] = useState('')
  const [reorderSaving, setReorderSaving] = useState(false)
  const [showDamageDialog, setShowDamageDialog] = useState(false)
  const [damageForm, setDamageForm] = useState({ itemId: '', quantity: '', description: '' })
  const [damageSaving, setDamageSaving] = useState(false)
  // WBS 1.12 — Detail & riwayat inventaris per barang
  const [historyItem, setHistoryItem] = useState<InventoryRecord | null>(null)
  const [historyData, setHistoryData] = useState<ItemHistoryRecord | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [formData, setFormData] = useState<Omit<InventoryRecord, 'id'>>({
    sku: '',
    name: '',
    category: 'Elektronik',
    stock: 0,
    minStock: 10,
    condition: 'baik',
    rack: '',
    pallet: '',
  })

  useEffect(() => {
    api.inventory.list().then((items) => {
      setInventory(items)
      const initialStocks: Record<number, number> = {}
      items.forEach(item => { initialStocks[item.id] = item.stock })
      setOpnamePhysicalStocks(initialStocks)
      setOpnameConductedBy(user?.name || '')
    }).catch(() => undefined).finally(() => setIsLoading(false))
  }, [])

  const handleOpenOpname = () => {
    const stocks: Record<number, number> = {}
    inventory.forEach(item => { stocks[item.id] = item.stock })
    setOpnamePhysicalStocks(stocks)
    setOpnameConductedBy(user?.name || '')
    setOpnameNotes('')
    setShowStockOpnameDialog(true)
  }

  const handleSaveOpname = async () => {
    const items = inventory.map(item => ({
      itemId: item.id,
      itemName: item.name,
      sku: item.sku,
      systemStock: item.stock,
      physicalStock: opnamePhysicalStocks[item.id] ?? item.stock,
    }))
    setOpnameSaving(true)
    try {
      await api.stockOpname.create({ conductedBy: opnameConductedBy || 'Staf Gudang', notes: opnameNotes, items })
      setShowStockOpnameDialog(false)
      alert('Stock opname disimpan sebagai draft. Tinjau selisihnya di Riwayat Opname sebelum menyinkronkan stok.')
      handleOpenHistory()
    } catch {
      alert('Gagal menyimpan stock opname. Pastikan backend aktif.')
    } finally {
      setOpnameSaving(false)
    }
  }

  const handleConfirmOpname = async (opnameId: number) => {
    setOpnameConfirmingId(opnameId)
    try {
      await api.stockOpname.confirm(opnameId)
      const [items, history] = await Promise.all([api.inventory.list(), api.stockOpname.list()])
      setInventory(items)
      setOpnameHistory(history)
      alert('Stock opname diselesaikan dan stok sistem telah disinkronisasi.')
    } catch {
      alert('Gagal menyinkronkan stock opname.')
    } finally {
      setOpnameConfirmingId(null)
    }
  }

  const handleDeleteOpnameDraft = async (opnameId: number) => {
    if (!confirm('Hapus draft stock opname ini?')) return
    try {
      await api.stockOpname.remove(opnameId)
      setOpnameHistory(prev => prev.filter(op => op.id !== opnameId))
    } catch {
      alert('Gagal menghapus draft stock opname.')
    }
  }

  const handleOpenHistory = async () => {
    setShowOpnameHistoryDialog(true)
    setOpnameHistoryLoading(true)
    try {
      const data = await api.stockOpname.list()
      setOpnameHistory(data)
    } catch {
      setOpnameHistory([])
    } finally {
      setOpnameHistoryLoading(false)
    }
  }

  const resetForm = () => {
    setEditingItem(null)
    setRackInputMode('existing')
    setPalletInputMode('existing')
    setFormData({
      sku: '',
      name: '',
      category: 'Elektronik',
      stock: 0,
      minStock: 10,
      condition: 'baik',
      rack: '',
      pallet: '',
    })
  }

  // Auto-generate SKU dari kategori + urutan + kode acak, agar staf tidak perlu mengetik manual
  const handleGenerateSku = () => {
    const prefix = (formData.category || 'BRG').replace(/[^A-Za-z]/g, '').substring(0, 3).toUpperCase() || 'BRG'
    const sequence = String(inventory.length + 1).padStart(3, '0')
    const randomCode = Math.random().toString(36).substring(2, 5).toUpperCase()
    setFormData({ ...formData, sku: `${prefix}-${sequence}-${randomCode}` })
  }

  const handleSave = async () => {
    const saved = editingItem
      ? await api.inventory.update(editingItem.id, formData)
      : await api.inventory.create(formData)

    setInventory((items) =>
      editingItem ? items.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...items]
    )
    resetForm()
    setShowAddDialog(false)
  }

  const handleEdit = (item: InventoryRecord) => {
    setEditingItem(item)
    setRackInputMode(item.rack && !uniqueRacks.includes(item.rack) ? 'new' : 'existing')
    setPalletInputMode(item.pallet && !uniquePallets.includes(item.pallet) ? 'new' : 'existing')
    setFormData({
      sku: item.sku,
      name: item.name,
      category: item.category,
      stock: item.stock,
      minStock: item.minStock,
      condition: item.condition,
      rack: item.rack,
      pallet: item.pallet,
    })
    setShowAddDialog(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus barang ini dari inventory?')) return
    await api.inventory.remove(id)
    setInventory((items) => items.filter((item) => item.id !== id))
  }

  // Pesan Ulang: mencatat transaksi barang masuk untuk barang dengan stok rendah
  const openReorderDialog = (item: InventoryRecord) => {
    setReorderItem(item)
    setReorderQty(String(item.minStock - item.stock > 0 ? item.minStock - item.stock : item.minStock))
    setReorderSupplier('')
  }

  const handleSubmitReorder = async () => {
    if (!reorderItem || !reorderQty || Number(reorderQty) <= 0) {
      alert('Jumlah pesan ulang wajib diisi dan lebih dari 0')
      return
    }
    setReorderSaving(true)
    try {
      const result = await api.warehouse.record({
        type: 'incoming',
        itemId: reorderItem.id,
        quantity: Number(reorderQty),
        partner: reorderSupplier || 'Supplier',
        notes: 'Pesan ulang dari halaman inventory (stok rendah)',
      })
      setInventory((items) => items.map((item) => (item.id === result.item.id ? result.item : item)))
      setReorderItem(null)
      alert(`Pesan ulang ${reorderQty} unit "${reorderItem.name}" berhasil dicatat sebagai barang masuk.`)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Gagal mencatat pesan ulang.')
    } finally {
      setReorderSaving(false)
    }
  }

  // Laporkan Kerusakan: menandai kondisi barang menjadi "rusak"
  const handleReportDamage = async () => {
    if (!damageForm.itemId || !damageForm.quantity) {
      alert('Pilih barang dan isi jumlah rusak')
      return
    }
    const item = inventory.find((i) => i.id === Number(damageForm.itemId))
    if (!item) return

    setDamageSaving(true)
    try {
      const updated = await api.inventory.update(item.id, { ...item, condition: 'rusak' })
      setInventory((items) => items.map((i) => (i.id === updated.id ? updated : i)))
      setShowDamageDialog(false)
      setDamageForm({ itemId: '', quantity: '', description: '' })
      alert(`Kerusakan pada "${item.name}" berhasil dilaporkan dan kondisinya diperbarui menjadi Rusak.`)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Gagal melaporkan kerusakan.')
    } finally {
      setDamageSaving(false)
    }
  }

  // WBS 1.12 — buka dialog detail & riwayat barang
  const handleOpenItemHistory = async (item: InventoryRecord) => {
    setHistoryItem(item)
    setHistoryData(null)
    setHistoryLoading(true)
    try {
      const data = await api.inventory.history(item.id)
      setHistoryData(data)
    } catch {
      setHistoryData(null)
    } finally {
      setHistoryLoading(false)
    }
  }

  // Daftar rak & palet unik untuk dropdown filter
  const uniqueRacks = Array.from(new Set(inventory.map(i => i.rack).filter(Boolean))).sort()
  const uniquePallets = Array.from(new Set(inventory.map(i => i.pallet).filter(Boolean))).sort()

  const filteredInventory = inventory.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCondition = filterCondition === 'all' || item.condition === filterCondition
    const matchesRack = filterRack === 'all' || item.rack === filterRack
    const matchesPallet = filterPallet === 'all' || item.pallet === filterPallet
    return matchesSearch && matchesCondition && matchesRack && matchesPallet
  })

  const totalItems = inventory.length
  const totalStock = inventory.reduce((sum, item) => sum + item.stock, 0)
  const lowStockItems = inventory.filter(item => item.stock < item.minStock).length
  const damagedItems = inventory.filter(item => item.condition === 'rusak').length

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Manajemen Inventory</h1>
            <p className="text-muted-foreground">Kelola stok dan kondisi barang</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleOpenHistory}>
              <ClipboardList className="w-4 h-4 mr-2" />
              Riwayat Opname
            </Button>
            <Dialog open={showStockOpnameDialog} onOpenChange={setShowStockOpnameDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" onClick={handleOpenOpname}>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Stock Opname
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Stock Opname</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Isi stok fisik aktual. Hasilnya akan disimpan sebagai draft untuk ditinjau sebelum stok sistem disinkronisasi.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Petugas Pelaksana</Label>
                      <Input
                        placeholder="Nama petugas"
                        value={opnameConductedBy}
                        onChange={(e) => setOpnameConductedBy(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Catatan (opsional)</Label>
                      <Input
                        placeholder="Catatan stock opname"
                        value={opnameNotes}
                        onChange={(e) => setOpnameNotes(e.target.value)}
                      />
                    </div>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>Nama Barang</TableHead>
                        <TableHead>Rak</TableHead>
                        <TableHead>Palet</TableHead>
                        <TableHead className="text-right">Stok Sistem</TableHead>
                        <TableHead className="text-right">Stok Fisik</TableHead>
                        <TableHead className="text-right">Selisih</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inventory.map((item) => {
                        const physical = opnamePhysicalStocks[item.id] ?? item.stock
                        const diff = physical - item.stock
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{item.rack}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{item.pallet}</TableCell>
                            <TableCell className="text-right">{item.stock}</TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                min={0}
                                value={physical}
                                onChange={(e) => setOpnamePhysicalStocks(prev => ({
                                  ...prev,
                                  [item.id]: Number(e.target.value),
                                }))}
                                className="w-24 text-right ml-auto"
                              />
                            </TableCell>
                            <TableCell className={`text-right font-medium ${diff > 0 ? 'text-success' : diff < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                              {diff > 0 ? `+${diff}` : diff === 0 ? '-' : diff}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowStockOpnameDialog(false)}>Batal</Button>
                    <Button onClick={handleSaveOpname} disabled={opnameSaving}>
                      {opnameSaving ? 'Menyimpan...' : 'Simpan sebagai Draft'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Dialog Riwayat Opname */}
            <Dialog open={showOpnameHistoryDialog} onOpenChange={setShowOpnameHistoryDialog}>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Riwayat Stock Opname</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {opnameHistoryLoading ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Memuat riwayat...</p>
                  ) : opnameHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Belum ada riwayat stock opname.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>No. Opname</TableHead>
                          <TableHead>Petugas</TableHead>
                          <TableHead className="text-right">Total Item</TableHead>
                          <TableHead className="text-right">Total Selisih</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Tanggal</TableHead>
                          <TableHead className="text-right">Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {opnameHistory.map((op) => (
                          <TableRow key={op.id}>
                            <TableCell className="font-mono text-sm">{op.opnameNumber}</TableCell>
                            <TableCell>{op.conductedBy}</TableCell>
                            <TableCell className="text-right">{op.totalItems ?? 0}</TableCell>
                            <TableCell className="text-right font-medium">{op.totalDifference ?? 0}</TableCell>
                            <TableCell>
                              {op.status === 'draft' ? (
                                <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">Draft</Badge>
                              ) : (
                                <Badge variant="outline" className="bg-success/10 text-success border-success/20">Selesai</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(op.conductedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </TableCell>
                            <TableCell className="text-right">
                              {op.status === 'draft' && (
                                <div className="flex gap-2 justify-end">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleDeleteOpnameDraft(op.id)}
                                  >
                                    Hapus
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleConfirmOpname(op.id)}
                                    disabled={opnameConfirmingId === op.id}
                                  >
                                    {opnameConfirmingId === op.id ? 'Menyinkronkan...' : 'Selesaikan & Sinkronisasi'}
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={showAddDialog} onOpenChange={(open) => {
              setShowAddDialog(open)
              if (!open) resetForm()
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Tambah Barang
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingItem ? 'Edit Barang' : 'Tambah Barang Baru'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>SKU</Label>
                      <div className="flex gap-2">
                        <Input placeholder="SKU-001" value={formData.sku} onChange={(e) => setFormData({ ...formData, sku: e.target.value })} />
                        <Button type="button" variant="outline" onClick={handleGenerateSku}>Auto</Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Nama Barang</Label>
                      <Input placeholder="Nama barang" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Kategori</Label>
                      <Select value={formData.category} onValueChange={(category) => setFormData({ ...formData, category })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih kategori" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Elektronik">Elektronik</SelectItem>
                          <SelectItem value="Aksesoris">Aksesoris</SelectItem>
                          <SelectItem value="Kabel">Kabel</SelectItem>
                          <SelectItem value="Lainnya">Lainnya</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Kondisi</Label>
                      <Select value={formData.condition} onValueChange={(condition: InventoryRecord['condition']) => setFormData({ ...formData, condition })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih kondisi" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="baik">Baik</SelectItem>
                          <SelectItem value="rusak">Rusak</SelectItem>
                          <SelectItem value="expired">Expired</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Stok Awal</Label>
                      <Input type="number" placeholder="0" value={formData.stock} onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Minimum Stok</Label>
                      <Input type="number" placeholder="10" value={formData.minStock} onChange={(e) => setFormData({ ...formData, minStock: Number(e.target.value) })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nomor Rak</Label>
                      {rackInputMode === 'existing' ? (
                        <Select
                          value={formData.rack || undefined}
                          onValueChange={(value) => {
                            if (value === '__new__') {
                              setRackInputMode('new')
                              setFormData({ ...formData, rack: '' })
                            } else {
                              setFormData({ ...formData, rack: value })
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih rak" />
                          </SelectTrigger>
                          <SelectContent>
                            {uniqueRacks.map((rack) => (
                              <SelectItem key={rack} value={rack}>{rack}</SelectItem>
                            ))}
                            <SelectItem value="__new__">+ Rak Baru...</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="flex gap-2">
                          <Input
                            autoFocus
                            placeholder="Rak A"
                            value={formData.rack}
                            onChange={(e) => setFormData({ ...formData, rack: e.target.value })}
                          />
                          <Button type="button" variant="ghost" size="sm" onClick={() => setRackInputMode('existing')}>Pilih</Button>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Nomor Palet</Label>
                      {palletInputMode === 'existing' ? (
                        <Select
                          value={formData.pallet || undefined}
                          onValueChange={(value) => {
                            if (value === '__new__') {
                              setPalletInputMode('new')
                              setFormData({ ...formData, pallet: '' })
                            } else {
                              setFormData({ ...formData, pallet: value })
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih palet" />
                          </SelectTrigger>
                          <SelectContent>
                            {uniquePallets.map((pallet) => (
                              <SelectItem key={pallet} value={pallet}>{pallet}</SelectItem>
                            ))}
                            <SelectItem value="__new__">+ Palet Baru...</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="flex gap-2">
                          <Input
                            autoFocus
                            placeholder="Palet A-01"
                            value={formData.pallet}
                            onChange={(e) => setFormData({ ...formData, pallet: e.target.value })}
                          />
                          <Button type="button" variant="ghost" size="sm" onClick={() => setPalletInputMode('existing')}>Pilih</Button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowAddDialog(false)}>Batal</Button>
                    <Button onClick={handleSave}>Simpan</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Package className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Item</p>
                  <p className="text-2xl font-bold">{totalItems}</p>
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
                  <p className="text-sm text-muted-foreground">Total Stok</p>
                  <p className="text-2xl font-bold">{totalStock.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-warning/10">
                  <AlertTriangle className="w-6 h-6 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Stok Rendah</p>
                  <p className="text-2xl font-bold">{lowStockItems}</p>
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
                  <p className="text-sm text-muted-foreground">Barang Rusak</p>
                  <p className="text-2xl font-bold">{damagedItems}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="all" className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <TabsList>
              <TabsTrigger value="all">Semua</TabsTrigger>
              <TabsTrigger value="low-stock">Stok Rendah</TabsTrigger>
              <TabsTrigger value="damaged">Barang Rusak</TabsTrigger>
            </TabsList>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Cari barang..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              <Select value={filterCondition} onValueChange={setFilterCondition}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Kondisi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kondisi</SelectItem>
                  <SelectItem value="baik">Baik</SelectItem>
                  <SelectItem value="rusak">Rusak</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterRack} onValueChange={setFilterRack}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Rak" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Rak</SelectItem>
                  {uniqueRacks.map(rack => (
                    <SelectItem key={rack} value={rack}>{rack}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterPallet} onValueChange={setFilterPallet}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Palet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Palet</SelectItem>
                  {uniquePallets.map(pallet => (
                    <SelectItem key={pallet} value={pallet}>{pallet}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon">
                <Download className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon">
                <Upload className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <TabsContent value="all">
            <Card>
              <CardHeader>
                <CardTitle>Daftar Inventory</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Nama Barang</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead className="text-right">Stok</TableHead>
                      <TableHead className="text-right">Min. Stok</TableHead>
                      <TableHead>Kondisi</TableHead>
                      <TableHead>Rak</TableHead>
                      <TableHead>Palet</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-6">Memuat data inventory...</TableCell>
                      </TableRow>
                    ) : filteredInventory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-6">Tidak ada barang ditemukan.</TableCell>
                      </TableRow>
                    ) : filteredInventory.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{item.category}</TableCell>
                        <TableCell className={`text-right font-medium ${item.stock < item.minStock ? 'text-destructive' : ''}`}>
                          {item.stock}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">{item.minStock}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={conditionColors[item.condition as keyof typeof conditionColors]}>
                            {conditionLabels[item.condition as keyof typeof conditionLabels]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{item.rack}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{item.pallet}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" title="Riwayat Transaksi" onClick={() => handleOpenItemHistory(item)}><History className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(item)}>Edit</Button>
                          {(user?.role === 'gudang' || user?.role === 'manager') && (
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(item.id)}>Hapus</Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="low-stock">
            <Card>
              <CardHeader>
                <CardTitle>Barang Stok Rendah</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Nama Barang</TableHead>
                      <TableHead className="text-right">Stok Sekarang</TableHead>
                      <TableHead className="text-right">Min. Stok</TableHead>
                      <TableHead className="text-right">Kekurangan</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventory.filter(item => item.stock < item.minStock).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">
                          {isLoading ? 'Memuat data...' : 'Tidak ada barang dengan stok rendah.'}
                        </TableCell>
                      </TableRow>
                    ) : inventory.filter(item => item.stock < item.minStock).map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="text-right font-medium text-destructive">{item.stock}</TableCell>
                        <TableCell className="text-right">{item.minStock}</TableCell>
                        <TableCell className="text-right font-medium text-destructive">-{item.minStock - item.stock}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" onClick={() => openReorderDialog(item)}>Pesan Ulang</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Dialog open={!!reorderItem} onOpenChange={(open) => !open && setReorderItem(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Pesan Ulang Barang</DialogTitle>
                </DialogHeader>
                {reorderItem && (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-border p-3 text-sm">
                      <p className="font-medium">{reorderItem.sku} - {reorderItem.name}</p>
                      <p className="text-muted-foreground">Stok sekarang: {reorderItem.stock} | Minimum: {reorderItem.minStock}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Jumlah Pesan</Label>
                        <Input type="number" min={1} value={reorderQty} onChange={(e) => setReorderQty(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Supplier</Label>
                        <Input placeholder="Nama supplier" value={reorderSupplier} onChange={(e) => setReorderSupplier(e.target.value)} />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Barang yang dipesan akan langsung tercatat sebagai transaksi barang masuk dan menambah stok sistem.
                    </p>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setReorderItem(null)} disabled={reorderSaving}>Batal</Button>
                      <Button onClick={handleSubmitReorder} disabled={reorderSaving}>
                        {reorderSaving ? 'Menyimpan...' : 'Konfirmasi Pesan Ulang'}
                      </Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="damaged">
            <Card>
              <CardHeader>
                <CardTitle>Laporan Barang Rusak</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-end">
                    <Dialog open={showDamageDialog} onOpenChange={(open) => {
                      setShowDamageDialog(open)
                      if (!open) setDamageForm({ itemId: '', quantity: '', description: '' })
                    }}>
                      <DialogTrigger asChild>
                        <Button>
                          <Plus className="w-4 h-4 mr-2" />
                          Laporkan Kerusakan
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Laporkan Barang Rusak</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Pilih Barang</Label>
                            <Select value={damageForm.itemId} onValueChange={(itemId) => setDamageForm({ ...damageForm, itemId })}>
                              <SelectTrigger>
                                <SelectValue placeholder="Pilih barang" />
                              </SelectTrigger>
                              <SelectContent>
                                {inventory.map((item) => (
                                  <SelectItem key={item.id} value={String(item.id)}>
                                    {item.sku} - {item.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Jumlah Rusak</Label>
                            <Input
                              type="number"
                              placeholder="0"
                              value={damageForm.quantity}
                              onChange={(e) => setDamageForm({ ...damageForm, quantity: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Deskripsi Kerusakan</Label>
                            <Textarea
                              placeholder="Jelaskan kerusakan..."
                              value={damageForm.description}
                              onChange={(e) => setDamageForm({ ...damageForm, description: e.target.value })}
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setShowDamageDialog(false)} disabled={damageSaving}>Batal</Button>
                            <Button onClick={handleReportDamage} disabled={damageSaving}>
                              {damageSaving ? 'Menyimpan...' : 'Laporkan'}
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>Nama Barang</TableHead>
                        <TableHead className="text-right">Jumlah Rusak</TableHead>
                        <TableHead>Kondisi</TableHead>
                        <TableHead>Rak</TableHead>
                        <TableHead>Palet</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inventory.filter(item => item.condition === 'rusak').length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
                            {isLoading ? 'Memuat data...' : 'Tidak ada barang rusak.'}
                          </TableCell>
                        </TableRow>
                      ) : inventory.filter(item => item.condition === 'rusak').map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className="text-right">{item.stock}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={conditionColors.rusak}>Rusak</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">{item.rack}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{item.pallet}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => handleOpenItemHistory(item)}><History className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(item)}>Edit</Button>
                            {(user?.role === 'gudang' || user?.role === 'manager') && (
                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(item.id)}>Hapus</Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* WBS 1.12 — Dialog Detail & Riwayat Transaksi Per Barang */}
      <Dialog open={!!historyItem} onOpenChange={(open) => { if (!open) { setHistoryItem(null); setHistoryData(null) } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Detail & Riwayat — {historyItem?.name}
            </DialogTitle>
          </DialogHeader>

          {historyLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Memuat riwayat transaksi...</p>
          ) : historyData ? (
            <div className="space-y-5">
              {/* Info barang */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground mb-1">SKU</p>
                  <p className="font-mono text-sm font-semibold">{historyData.item.sku}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground mb-1">Kategori</p>
                  <p className="text-sm font-semibold">{historyData.item.category}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground mb-1">Lokasi</p>
                  <p className="text-sm font-semibold">{historyData.item.rack} / {historyData.item.pallet}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground mb-1">Kondisi</p>
                  <Badge variant="outline" className={conditionColors[historyData.item.condition]}>
                    {conditionLabels[historyData.item.condition]}
                  </Badge>
                </div>
              </div>

              {/* Ringkasan stok & pergerakan */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 flex items-center gap-3">
                  <Package className="h-8 w-8 text-primary opacity-70" />
                  <div>
                    <p className="text-xs text-muted-foreground">Stok Sekarang</p>
                    <p className={`text-2xl font-bold ${historyData.item.stock < historyData.item.minStock ? 'text-destructive' : 'text-foreground'}`}>
                      {historyData.item.stock}
                    </p>
                    <p className="text-xs text-muted-foreground">min. {historyData.item.minStock}</p>
                  </div>
                </div>
                <div className="rounded-lg bg-success/5 border border-success/20 p-4 flex items-center gap-3">
                  <ArrowUpCircle className="h-8 w-8 text-success opacity-70" />
                  <div>
                    <p className="text-xs text-muted-foreground">Total Masuk</p>
                    <p className="text-2xl font-bold text-success">{historyData.summary.totalIncoming.toLocaleString('id-ID')}</p>
                    <p className="text-xs text-muted-foreground">unit sepanjang waktu</p>
                  </div>
                </div>
                <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-4 flex items-center gap-3">
                  <ArrowDownCircle className="h-8 w-8 text-destructive opacity-70" />
                  <div>
                    <p className="text-xs text-muted-foreground">Total Keluar</p>
                    <p className="text-2xl font-bold text-destructive">{historyData.summary.totalOutgoing.toLocaleString('id-ID')}</p>
                    <p className="text-xs text-muted-foreground">unit sepanjang waktu</p>
                  </div>
                </div>
              </div>

              {/* Stok rendah warning */}
              {historyData.item.stock < historyData.item.minStock && (
                <div className="flex items-center gap-2 rounded-lg bg-warning/10 border border-warning/30 px-4 py-3 text-sm text-warning">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Stok saat ini ({historyData.item.stock}) di bawah batas minimum ({historyData.item.minStock}). Segera lakukan pesan ulang.
                </div>
              )}

              {/* Tabel riwayat transaksi */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Riwayat Transaksi</p>
                  <span className="text-xs text-muted-foreground">{historyData.summary.totalTransactions} transaksi (max 100 terbaru)</span>
                </div>
                {historyData.transactions.length === 0 ? (
                  <div className="rounded-lg border border-border py-8 text-center">
                    <History className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                    <p className="text-sm text-muted-foreground">Belum ada transaksi untuk barang ini.</p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-32">Tipe</TableHead>
                          <TableHead className="text-right w-24">Jumlah</TableHead>
                          <TableHead>Partner / Asal</TableHead>
                          <TableHead>Catatan</TableHead>
                          <TableHead className="w-40">Waktu</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {historyData.transactions.map((tx) => (
                          <TableRow key={tx.id}>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                {tx.type === 'incoming'
                                  ? <TrendingUp className="h-4 w-4 text-success" />
                                  : <TrendingDown className="h-4 w-4 text-destructive" />
                                }
                                <span className={`text-sm font-medium ${tx.type === 'incoming' ? 'text-success' : 'text-destructive'}`}>
                                  {tx.type === 'incoming' ? 'Masuk' : 'Keluar'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              <span className={tx.type === 'incoming' ? 'text-success' : 'text-destructive'}>
                                {tx.type === 'incoming' ? '+' : '-'}{tx.quantity}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {tx.partner || <span className="italic opacity-50">—</span>}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                              {tx.notes || <span className="italic opacity-50">—</span>}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(tx.timestamp).toLocaleString('id-ID', {
                                day: '2-digit', month: 'short', year: 'numeric',
                                hour: '2-digit', minute: '2-digit'
                              })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Gagal memuat data. Pastikan backend aktif.</p>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
