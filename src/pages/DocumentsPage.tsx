import { useEffect, useState } from 'react'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Search, FileText, Download, Printer, Eye, ClipboardList, Receipt, Package, RotateCcw } from 'lucide-react'
import { api } from '@/src/lib/api'
import { useAuth } from '@/lib/auth-context'
import { buildDocumentHtml, openPrintWindow, documentTypeLabels } from '@/src/lib/document-print'

interface Document {
  id: string
  number: string
  type: 'po' | 'surat_jalan' | 'picking_list' | 'retur'
  relatedTo: string
  date: string
  status: 'draft' | 'final'
}

const typeLabels = documentTypeLabels

const typeIcons = {
  po: Receipt,
  surat_jalan: FileText,
  picking_list: ClipboardList,
  retur: RotateCcw,
}

// buildDocumentHtml & openPrintWindow di-import dari src/lib/document-print

export default function DocumentsPage() {
  const { user } = useAuth()
  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null)

  // Sesuai WBS: staf gudang hanya mengelola Surat Jalan & Picking List, bukan PO (PO milik dealer)
  const canSeePO = user?.role !== 'gudang'

  useEffect(() => {
    api.documents.list()
      .then((items) => {
        const mapped = items
          .map((item) => ({ ...item, id: String(item.id) }))
          .filter((item) => canSeePO || item.type !== 'po')
        setDocuments(mapped)
      })
      .catch(() => undefined)
      .finally(() => setIsLoading(false))
  }, [canSeePO])

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch = doc.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.relatedTo.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = filterType === 'all' || doc.type === filterType
    return matchesSearch && matchesType
  })

  const poCount = documents.filter(d => d.type === 'po').length
  const sjCount = documents.filter(d => d.type === 'surat_jalan').length
  const plCount = documents.filter(d => d.type === 'picking_list').length
  const returCount = documents.filter(d => d.type === 'retur').length

  const DocumentTable = ({ documents }: { documents: Document[] }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>No. Dokumen</TableHead>
          <TableHead>Tipe</TableHead>
          <TableHead>Terkait</TableHead>
          <TableHead>Tanggal</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Aksi</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">Memuat data dokumen...</TableCell>
          </TableRow>
        ) : documents.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">Belum ada dokumen.</TableCell>
          </TableRow>
        ) : documents.map((doc) => {
          const Icon = typeIcons[doc.type]
          return (
            <TableRow key={doc.id} className={previewDoc?.id === doc.id ? 'bg-muted/50' : undefined}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <span className="font-mono font-medium">{doc.number}</span>
                </div>
              </TableCell>
              <TableCell>{typeLabels[doc.type]}</TableCell>
              <TableCell>{doc.relatedTo}</TableCell>
              <TableCell>{new Date(doc.date).toLocaleDateString('id-ID')}</TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={
                    doc.status === 'final'
                      ? 'bg-success/10 text-success border-success/20'
                      : 'bg-warning/10 text-warning border-warning/20'
                  }
                >
                  {doc.status === 'final' ? 'Final' : 'Draft'}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="sm" title="Preview" onClick={() => setPreviewDoc(doc)}>
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" title="Cetak" onClick={() => openPrintWindow(doc, true)}>
                    <Printer className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" title="Download" onClick={() => openPrintWindow(doc, false)}>
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Manajemen Dokumen</h1>
          <p className="text-muted-foreground">
            {canSeePO ? 'Kelola dokumen PO, Surat Jalan, dan Picking List' : 'Kelola dokumen Surat Jalan dan Picking List'}
          </p>
        </div>

        <div className={`grid grid-cols-1 gap-4 ${canSeePO ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
          {canSeePO && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <Receipt className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Purchase Order</p>
                    <p className="text-2xl font-bold">{poCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-success/10">
                  <FileText className="w-6 h-6 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Surat Jalan</p>
                  <p className="text-2xl font-bold">{sjCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-warning/10">
                  <ClipboardList className="w-6 h-6 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Picking List</p>
                  <p className="text-2xl font-bold">{plCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-destructive/10">
                  <RotateCcw className="w-6 h-6 text-destructive" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Surat Retur</p>
                  <p className="text-2xl font-bold">{returCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="all" className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <TabsList>
              <TabsTrigger value="all">Semua</TabsTrigger>
              {canSeePO && <TabsTrigger value="po">Purchase Order</TabsTrigger>}
              <TabsTrigger value="surat_jalan">Surat Jalan</TabsTrigger>
              <TabsTrigger value="picking_list">Picking List</TabsTrigger>
              <TabsTrigger value="retur">Surat Retur</TabsTrigger>
            </TabsList>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Cari dokumen..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Tipe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Tipe</SelectItem>
                  {canSeePO && <SelectItem value="po">Purchase Order</SelectItem>}
                  <SelectItem value="surat_jalan">Surat Jalan</SelectItem>
                  <SelectItem value="picking_list">Picking List</SelectItem>
                  <SelectItem value="retur">Surat Retur</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <TabsContent value="all">
            <Card>
              <CardHeader>
                <CardTitle>Semua Dokumen</CardTitle>
              </CardHeader>
              <CardContent>
                <DocumentTable documents={filteredDocuments} />
              </CardContent>
            </Card>
          </TabsContent>

          {canSeePO && (
            <TabsContent value="po">
              <Card>
                <CardHeader>
                  <CardTitle>Purchase Order</CardTitle>
                </CardHeader>
                <CardContent>
                  <DocumentTable documents={documents.filter(d => d.type === 'po')} />
                </CardContent>
              </Card>
            </TabsContent>
          )}

          <TabsContent value="surat_jalan">
            <Card>
              <CardHeader>
                <CardTitle>Surat Jalan</CardTitle>
              </CardHeader>
              <CardContent>
                <DocumentTable documents={documents.filter(d => d.type === 'surat_jalan')} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="picking_list">
            <Card>
              <CardHeader>
                <CardTitle>Picking List</CardTitle>
              </CardHeader>
              <CardContent>
                <DocumentTable documents={documents.filter(d => d.type === 'picking_list')} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="retur">
            <Card>
              <CardHeader>
                <CardTitle>Surat Retur</CardTitle>
              </CardHeader>
              <CardContent>
                <DocumentTable documents={documents.filter(d => d.type === 'retur')} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Preview Dokumen</CardTitle>
            {previewDoc && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => openPrintWindow(previewDoc, true)}>
                  <Printer className="w-4 h-4 mr-2" /> Cetak
                </Button>
                <Button variant="outline" size="sm" onClick={() => openPrintWindow(previewDoc, false)}>
                  <Download className="w-4 h-4 mr-2" /> Download
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {previewDoc ? (
              <div
                className="border rounded-lg bg-white overflow-hidden"
                dangerouslySetInnerHTML={{ __html: buildDocumentHtml(previewDoc) }}
              />
            ) : (
              <div className="border rounded-lg p-8 bg-muted/30 min-h-[400px] flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Pilih dokumen untuk melihat preview</p>
                  <p className="text-sm">Klik ikon mata pada tabel dokumen</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
