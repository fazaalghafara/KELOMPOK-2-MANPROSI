import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { usePolling } from "@/hooks/use-polling";
import { useNotificationContext } from "@/lib/notification-context";
import { detectStatusChanges } from "@/hooks/use-notifications";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  Search,
  Plus,
  FileText,
  AlertTriangle,
  TrendingUp,
  CheckCircle2,
} from "lucide-react";
import { api, type DocumentRecord, type InventoryRecord, type WarehouseTransactionRecord } from "@/src/lib/api";

const emptyItemForm: Omit<InventoryRecord, "id"> = {
  sku: "",
  name: "",
  category: "Elektronik",
  stock: 0,
  minStock: 10,
  condition: "baik",
  rack: "",
  pallet: "",
};

export function GudangDashboard() {
  const navigate = useNavigate();
  const { push } = useNotificationContext();
  const [inventory, setInventory] = useState<InventoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [transactions, setTransactions] = useState<WarehouseTransactionRecord[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showIncomingModal, setShowIncomingModal] = useState(false);
  const [showOutgoingModal, setShowOutgoingModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryRecord | null>(null);
  const [incomingData, setIncomingData] = useState({ itemId: "", quantity: "", supplier: "" });
  const [outgoingData, setOutgoingData] = useState({ itemId: "", quantity: "", dealer: "" });
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [documentForm, setDocumentForm] = useState({
    type: "surat_jalan" as DocumentRecord["type"],
    relatedTo: "",
    status: "final" as DocumentRecord["status"],
  });
  const [documentSaving, setDocumentSaving] = useState(false);
  const [createdDocument, setCreatedDocument] = useState<DocumentRecord | null>(null);

  // Refs untuk deteksi perubahan saat polling
  const prevInventoryRef = useRef<InventoryRecord[]>([]);
  const prevTransactionsRef = useRef<WarehouseTransactionRecord[]>([]);

  const fetchData = useCallback(async () => {
    const [inventoryResult, transactionResult, documentResult] = await Promise.allSettled([
      api.inventory.list(),
      api.warehouse.transactions(),
      api.documents.list(),
    ]);

    if (inventoryResult.status === "fulfilled") {
      const next = inventoryResult.value;
      const prevIds = new Set(prevInventoryRef.current.map((i) => i.id));
      next.filter((i) => !prevIds.has(i.id)).forEach((i) =>
        push(`Barang baru: ${i.name} (${i.sku})`, "info")
      );
      next.forEach((item) => {
        const prev = prevInventoryRef.current.find((p) => p.id === item.id);
        if (prev && prev.stock >= item.minStock && item.stock < item.minStock) {
          push(`⚠ Stok ${item.name} di bawah minimum (${item.stock}/${item.minStock})`, "warning");
        }
      });
      prevInventoryRef.current = next;
      setInventory(next);
    }
    if (transactionResult.status === "fulfilled") {
      const next = transactionResult.value;
      const prevIds = new Set(prevTransactionsRef.current.map((t) => t.id));
      next.filter((t) => !prevIds.has(t.id)).forEach((t) =>
        push(`Transaksi: ${t.type === "incoming" ? "Masuk" : "Keluar"} ${t.quantity}x ${t.itemName}`, "info")
      );
      prevTransactionsRef.current = next;
      setTransactions(next);
    }
    if (documentResult.status === "fulfilled") setDocuments(documentResult.value);
    setIsLoading(false);
  }, [push]);

  usePolling(fetchData, 30_000);

  const filteredItems = inventory.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.rack.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.pallet.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const incomingTotal = useMemo(
    () => transactions.filter((item) => item.type === "incoming").reduce((sum, item) => sum + item.quantity, 0),
    [transactions],
  );
  const outgoingTotal = useMemo(
    () => transactions.filter((item) => item.type === "outgoing").reduce((sum, item) => sum + item.quantity, 0),
    [transactions],
  );
  const mostRequestedItems = useMemo(() => {
    const outgoingMap = new Map<string, number>();
    transactions
      .filter((item) => item.type === "outgoing")
      .forEach((item) => outgoingMap.set(item.itemName, (outgoingMap.get(item.itemName) || 0) + item.quantity));

    const derived = Array.from(outgoingMap.entries())
      .map(([name, requests]) => ({ name, requests }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 3);

    return derived;
  }, [transactions]);

  const upsertInventory = (updatedItem: InventoryRecord) => {
    setInventory((items) => items.map((item) => (item.id === updatedItem.id ? updatedItem : item)));
  };

  const handleRecordIncoming = async () => {
    if (!incomingData.itemId || !incomingData.quantity) {
      alert("Mohon pilih barang dan isi quantity");
      return;
    }

    const result = await api.warehouse.record({
      type: "incoming",
      itemId: Number(incomingData.itemId),
      quantity: Number(incomingData.quantity),
      partner: incomingData.supplier,
      notes: "Record incoming dari dashboard gudang",
    });
    upsertInventory(result.item);
    setTransactions((items) => [result.transaction, ...items]);
    setIncomingData({ itemId: "", quantity: "", supplier: "" });
    setShowIncomingModal(false);
  };

  const handleRecordOutgoing = async () => {
    if (!outgoingData.itemId || !outgoingData.quantity) {
      alert("Mohon pilih barang dan isi quantity");
      return;
    }

    const result = await api.warehouse.record({
      type: "outgoing",
      itemId: Number(outgoingData.itemId),
      quantity: Number(outgoingData.quantity),
      partner: outgoingData.dealer,
      notes: "Record outgoing dari dashboard gudang",
    });
    upsertInventory(result.item);
    setTransactions((items) => [result.transaction, ...items]);
    setOutgoingData({ itemId: "", quantity: "", dealer: "" });
    setShowOutgoingModal(false);
  };

  const handleAddItem = async () => {
    if (!itemForm.sku || !itemForm.name || !itemForm.rack) {
      alert("SKU, nama barang, dan nomor rak wajib diisi");
      return;
    }

    const created = await api.inventory.create(itemForm);
    setInventory((items) => [created, ...items]);
    setItemForm(emptyItemForm);
    setShowItemModal(false);
  };

  const handleCreateDocument = async () => {
    if (!documentForm.relatedTo) {
      alert("Referensi dokumen wajib diisi");
      return;
    }

    setDocumentSaving(true);
    try {
      const created = await api.documents.create(documentForm);
      setDocuments((items) => [created, ...items]);
      setShowDocumentModal(false);
      setCreatedDocument(created);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Gagal membuat dokumen. Coba lagi.");
    } finally {
      setDocumentSaving(false);
    }
  };

  const openDocumentModal = (type: DocumentRecord["type"]) => {
    setDocumentForm({ type, relatedTo: "", status: "final" });
    setShowDocumentModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Barang Masuk</p>
                <p className="text-3xl font-bold text-foreground">{incomingTotal}</p>
                <p className="text-xs text-success flex items-center gap-1 mt-1">
                  <TrendingUp className="h-3 w-3" /> Updated from transaksi
                </p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-success/10 flex items-center justify-center">
                <ArrowDownToLine className="h-6 w-6 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Barang Keluar</p>
                <p className="text-3xl font-bold text-foreground">{outgoingTotal}</p>
                <p className="text-xs text-muted-foreground mt-1">This month</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <ArrowUpFromLine className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-muted-foreground mb-3">Most Requested Items</p>
              <div className="space-y-2">
                {mostRequestedItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada data permintaan barang.</p>
                ) : mostRequestedItems.map((item, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <span className="text-foreground truncate">{item.name}</span>
                    <span className="text-muted-foreground font-medium">{item.requests} requests</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Button className="h-auto py-4 flex flex-col gap-2" onClick={() => setShowIncomingModal(true)}>
          <ArrowDownToLine className="h-5 w-5" />
          <span>Record Incoming</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => setShowOutgoingModal(true)}>
          <ArrowUpFromLine className="h-5 w-5" />
          <span>Record Outgoing</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => openDocumentModal("surat_jalan")}>
          <FileText className="h-5 w-5" />
          <span>Create Surat Jalan</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => openDocumentModal("picking_list")}>
          <Package className="h-5 w-5" />
          <span>Create Picking List</span>
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-semibold">Inventory Overview</CardTitle>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by rack/pallet..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-9 w-64"
              />
            </div>
            <Button size="sm" onClick={() => setShowItemModal(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Item
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Item Name</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">SKU</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Quantity</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Rack</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Pallet</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Condition</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-sm text-muted-foreground">Memuat data inventory...</td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-sm text-muted-foreground">Tidak ada barang ditemukan.</td>
                  </tr>
                ) : filteredItems.map((item) => (
                  <tr key={item.id} className="border-b border-border hover:bg-muted/50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded bg-secondary flex items-center justify-center">
                          <Package className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <span className="font-medium text-foreground">{item.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{item.sku}</td>
                    <td className="py-3 px-4 text-sm font-medium text-foreground">{item.stock}</td>
                    <td className="py-3 px-4 text-sm text-foreground">{item.rack || '-'}</td>
                    <td className="py-3 px-4 text-sm text-foreground">{item.pallet || '-'}</td>
                    <td className="py-3 px-4">
                      {item.condition === "baik" ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-success/10 text-success">
                          Good
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-destructive/10 text-destructive">
                          <AlertTriangle className="h-3 w-3" />
                          {item.condition === "expired" ? "Expired" : "Damaged"}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedItem(item)}>
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Recent Warehouse Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {transactions.slice(0, 5).map((transaction) => (
              <div key={transaction.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${transaction.type === "incoming" ? "bg-success/10" : "bg-primary/10"}`}>
                    {transaction.type === "incoming" ? <ArrowDownToLine className="h-4 w-4 text-success" /> : <ArrowUpFromLine className="h-4 w-4 text-primary" />}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{transaction.itemName}</p>
                    <p className="text-xs text-muted-foreground">{transaction.partner || "Tanpa partner"}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{transaction.quantity}</p>
                  <p className="text-xs text-muted-foreground">{new Date(transaction.timestamp).toLocaleString("id-ID")}</p>
                </div>
              </div>
            ))}
            {!transactions.length && <p className="text-sm text-muted-foreground">Belum ada transaksi gudang.</p>}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showIncomingModal} onOpenChange={setShowIncomingModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Incoming</DialogTitle>
            <DialogDescription>Catat barang masuk dan stok akan bertambah di database.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Barang</Label>
              <Select value={incomingData.itemId} onValueChange={(itemId) => setIncomingData({ ...incomingData, itemId })}>
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input type="number" value={incomingData.quantity} onChange={(event) => setIncomingData({ ...incomingData, quantity: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Supplier</Label>
                <Input value={incomingData.supplier} onChange={(event) => setIncomingData({ ...incomingData, supplier: event.target.value })} placeholder="Nama supplier" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowIncomingModal(false)}>Cancel</Button>
            <Button onClick={handleRecordIncoming}>Save Incoming</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showOutgoingModal} onOpenChange={setShowOutgoingModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Outgoing</DialogTitle>
            <DialogDescription>Catat barang keluar dan stok akan berkurang di database.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Barang</Label>
              <Select value={outgoingData.itemId} onValueChange={(itemId) => setOutgoingData({ ...outgoingData, itemId })}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih barang" />
                </SelectTrigger>
                <SelectContent>
                  {inventory.map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.sku} - {item.name} (stok {item.stock})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input type="number" value={outgoingData.quantity} onChange={(event) => setOutgoingData({ ...outgoingData, quantity: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Dealer</Label>
                <Input value={outgoingData.dealer} onChange={(event) => setOutgoingData({ ...outgoingData, dealer: event.target.value })} placeholder="Nama dealer" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOutgoingModal(false)}>Cancel</Button>
            <Button onClick={handleRecordOutgoing}>Save Outgoing</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showItemModal} onOpenChange={setShowItemModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Item</DialogTitle>
            <DialogDescription>Tambah barang baru ke inventory.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>SKU</Label>
                <Input value={itemForm.sku} onChange={(event) => setItemForm({ ...itemForm, sku: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Nama Barang</Label>
                <Input value={itemForm.name} onChange={(event) => setItemForm({ ...itemForm, name: event.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Stok</Label>
                <Input type="number" value={itemForm.stock} onChange={(event) => setItemForm({ ...itemForm, stock: Number(event.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Minimum Stok</Label>
                <Input type="number" value={itemForm.minStock} onChange={(event) => setItemForm({ ...itemForm, minStock: Number(event.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Kategori</Label>
                <Input value={itemForm.category} onChange={(event) => setItemForm({ ...itemForm, category: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Kondisi</Label>
                <select
                  value={itemForm.condition}
                  onChange={(event) => setItemForm({ ...itemForm, condition: event.target.value as InventoryRecord['condition'] })}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="baik">Baik</option>
                  <option value="rusak">Rusak</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nomor Rak</Label>
                <Input value={itemForm.rack} onChange={(event) => setItemForm({ ...itemForm, rack: event.target.value })} placeholder="Rak A" />
              </div>
              <div className="space-y-2">
                <Label>Nomor Palet</Label>
                <Input value={itemForm.pallet} onChange={(event) => setItemForm({ ...itemForm, pallet: event.target.value })} placeholder="Palet A-01" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowItemModal(false)}>Cancel</Button>
            <Button onClick={handleAddItem}>Save Item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDocumentModal} onOpenChange={setShowDocumentModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{documentForm.type === "surat_jalan" ? "Create Surat Jalan" : "Create Picking List"}</DialogTitle>
            <DialogDescription>Dokumen akan disimpan ke tabel dokumen.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Referensi</Label>
              <Input value={documentForm.relatedTo} onChange={(event) => setDocumentForm({ ...documentForm, relatedTo: event.target.value })} placeholder="Contoh: SHP-2024-001" />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={documentForm.status} onValueChange={(status: DocumentRecord["status"]) => setDocumentForm({ ...documentForm, status })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="final">Final</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDocumentModal(false)} disabled={documentSaving}>Cancel</Button>
            <Button onClick={handleCreateDocument} disabled={documentSaving}>
              {documentSaving ? "Menyimpan..." : "Create Document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!createdDocument} onOpenChange={(open) => !open && setCreatedDocument(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              Dokumen Berhasil Dibuat
            </DialogTitle>
            <DialogDescription>
              Dokumen telah tersimpan ke database dan dapat dilihat, dicetak, atau diunduh di halaman Dokumen.
            </DialogDescription>
          </DialogHeader>
          {createdDocument && (
            <div className="rounded-lg border border-border p-4 space-y-1 text-sm">
              <p><span className="text-muted-foreground">No. Dokumen:</span> <span className="font-mono font-medium">{createdDocument.number}</span></p>
              <p><span className="text-muted-foreground">Tipe:</span> {createdDocument.type === "surat_jalan" ? "Surat Jalan" : "Picking List"}</p>
              <p><span className="text-muted-foreground">Referensi:</span> {createdDocument.relatedTo}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreatedDocument(null)}>Tutup</Button>
            <Button onClick={() => navigate("/documents")}>Lihat di Halaman Dokumen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detail Barang</DialogTitle>
            <DialogDescription>Informasi inventory dari database.</DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">SKU</p>
                <p className="font-medium">{selectedItem.sku}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Nama</p>
                <p className="font-medium">{selectedItem.name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Stok</p>
                <p className="font-medium">{selectedItem.stock}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Minimum</p>
                <p className="font-medium">{selectedItem.minStock}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Rak</p>
                <p className="font-medium">{selectedItem.rack || '-'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Palet</p>
                <p className="font-medium">{selectedItem.pallet || '-'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Kondisi</p>
                <p className="font-medium">{selectedItem.condition}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
