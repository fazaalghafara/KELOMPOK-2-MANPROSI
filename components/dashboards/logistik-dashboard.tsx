import { useEffect, useState, useCallback, useRef } from "react";
import { usePolling } from "@/hooks/use-polling";
import { useNotificationContext } from "@/lib/notification-context";
import { detectStatusChanges } from "@/hooks/use-notifications";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Truck,
  MapPin,
  Clock,
  CheckCircle2,
  Package,
  ArrowRight,
  Navigation,
  RefreshCw,
} from "lucide-react";
import { api, type ShipmentRecord } from "@/src/lib/api";

const statusColors: Record<ShipmentRecord["status"], string> = {
  pending: "bg-muted text-muted-foreground border-muted",
  processing: "bg-warning/10 text-warning border-warning/20",
  shipped: "bg-primary/10 text-primary border-primary/20",
  delivered: "bg-success/10 text-success border-success/20",
};

const statusLabels: Record<ShipmentRecord["status"], string> = {
  pending: "Menunggu",
  processing: "Diproses",
  shipped: "Dikirim",
  delivered: "Terkirim",
};

const progressMap: Record<ShipmentRecord["status"], number> = {
  pending: 20,
  processing: 45,
  shipped: 75,
  delivered: 100,
};

const emptyShipmentForm: Omit<ShipmentRecord, "id"> = {
  trackingNumber: `SHP-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`,
  destination: "",
  date: new Date().toISOString().slice(0, 10),
  items: 1,
  status: "pending",
  vehiclePlate: "",
  driverName: "",
  origin: "Jakarta Warehouse",
  estimatedDelivery: "",
  currentLocation: "Menunggu pickup",
};

export function LogistikDashboard() {
  const { push } = useNotificationContext();
  const [shipments, setShipments] = useState<ShipmentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<ShipmentRecord | null>(null);
  const [updateShipment, setUpdateShipment] = useState<ShipmentRecord | null>(null);
  const [shipmentForm, setShipmentForm] = useState(emptyShipmentForm);
  const [updateForm, setUpdateForm] = useState<{ status: ShipmentRecord["status"]; currentLocation: string }>({
    status: "processing",
    currentLocation: "",
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const prevShipmentsRef = useRef<ShipmentRecord[]>([]);

  const fetchShipments = useCallback(async () => {
    try {
      const next = await api.shipments.list();
      detectStatusChanges(prevShipmentsRef.current, next, (s) => `Shipment ${s.trackingNumber}`).forEach((msg) => push(msg, "info"));
      prevShipmentsRef.current = next;
      setShipments(next);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
      setLastUpdated(new Date());
    }
  }, [push]);

  usePolling(fetchShipments, 30_000);

  const activeShipments = shipments.filter(
    (s) => s.status === "processing" || s.status === "shipped"
  );

  const handleCreateShipment = async () => {
    if (!shipmentForm.trackingNumber || !shipmentForm.destination) {
      alert("Nomor resi dan tujuan wajib diisi");
      return;
    }
    const created = await api.shipments.create(shipmentForm);
    setShipments((items) => [created, ...items]);
    setShipmentForm({
      ...emptyShipmentForm,
      trackingNumber: `SHP-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`,
    });
    setShowCreateModal(false);
  };

  const openUpdateModal = (shipment: ShipmentRecord) => {
    setUpdateShipment(shipment);
    setUpdateForm({
      status: shipment.status,
      currentLocation: shipment.currentLocation || "",
    });
  };

  const handleUpdateLokasi = async () => {
    if (!updateShipment) return;
    if (!updateForm.currentLocation.trim()) {
      alert("Lokasi kendaraan wajib diisi");
      return;
    }
    setIsUpdating(true);
    try {
      await api.shipments.updateStatus(
        updateShipment.id,
        updateForm.status,
        updateForm.currentLocation
      );
      setShipments((items) =>
        items.map((item) =>
          item.id === updateShipment.id
            ? { ...item, status: updateForm.status, currentLocation: updateForm.currentLocation }
            : item
        )
      );
      setLastUpdated(new Date());
      setUpdateShipment(null);
    } catch {
      alert("Gagal memperbarui lokasi. Pastikan backend aktif.");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pengiriman Aktif</p>
                <p className="text-3xl font-bold text-foreground">{activeShipments.length}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Truck className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Dalam Perjalanan</p>
                <p className="text-3xl font-bold text-foreground">{shipments.filter((s) => s.status === "shipped").length}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-chart-4/10 flex items-center justify-center">
                <Navigation className="h-6 w-6 text-chart-4" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Menunggu Pickup</p>
                <p className="text-3xl font-bold text-foreground">{shipments.filter((s) => s.status === "pending" || s.status === "processing").length}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-warning/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Terkirim</p>
                <p className="text-3xl font-bold text-foreground">{shipments.filter((s) => s.status === "delivered").length}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-success/10 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Real-time Tracking Panel */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg font-semibold">Monitoring Kendaraan Real-time</CardTitle>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              Diperbarui: {lastUpdated.toLocaleTimeString("id-ID")}
            </span>
            <Button size="sm" variant="outline" onClick={fetchShipments} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Memuat data kendaraan...</p>
            ) : activeShipments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada pengiriman aktif saat ini.</p>
            ) : activeShipments.map((shipment) => (
              <div key={shipment.id} className="p-4 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Truck className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-foreground">{shipment.vehiclePlate || "Plat belum diisi"}</span>
                        <Badge variant="outline" className={statusColors[shipment.status]}>
                          {statusLabels[shipment.status]}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">Driver: {shipment.driverName || "Belum ditugaskan"}</p>
                      <div className="flex items-center gap-2 mt-2 text-sm">
                        <span className="text-muted-foreground">{shipment.origin || "Jakarta Warehouse"}</span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <span className="text-foreground font-medium">{shipment.destination}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <div className="flex items-center gap-1 text-sm text-primary mb-1 justify-end">
                      <MapPin className="h-4 w-4" />
                      <span className="font-medium">{shipment.currentLocation || "Lokasi belum diisi"}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">ETA: {shipment.estimatedDelivery || shipment.date}</p>
                    <Button size="sm" onClick={() => openUpdateModal(shipment)}>
                      <MapPin className="h-3 w-3 mr-1" />
                      Update Lokasi
                    </Button>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                    <span>Progress Pengiriman</span>
                    <span>{progressMap[shipment.status]}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${progressMap[shipment.status]}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* All Shipments Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-semibold">Semua Pengiriman</CardTitle>
          <Button size="sm" onClick={() => setShowCreateModal(true)}>
            <Package className="h-4 w-4 mr-1" />
            Buat Pengiriman
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">No. Resi</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Kendaraan</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Driver</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Tujuan</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Lokasi Terkini</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={7} className="py-6 text-center text-sm text-muted-foreground">Memuat data pengiriman...</td></tr>
                ) : shipments.length === 0 ? (
                  <tr><td colSpan={7} className="py-6 text-center text-sm text-muted-foreground">Belum ada data pengiriman.</td></tr>
                ) : shipments.map((shipment) => (
                  <tr key={shipment.id} className="border-b border-border hover:bg-muted/50">
                    <td className="py-3 px-4 text-sm font-mono font-medium text-foreground">{shipment.trackingNumber}</td>
                    <td className="py-3 px-4 text-sm text-foreground">{shipment.vehiclePlate || "-"}</td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{shipment.driverName || "-"}</td>
                    <td className="py-3 px-4 text-sm text-foreground">{shipment.destination}</td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span>{shipment.currentLocation || "-"}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className={statusColors[shipment.status]}>
                        {statusLabels[shipment.status]}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedShipment(shipment)}>Detail</Button>
                      {shipment.status !== "delivered" && (
                        <Button variant="outline" size="sm" onClick={() => openUpdateModal(shipment)}>
                          Update
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal: Update Lokasi Kendaraan */}
      <Dialog open={!!updateShipment} onOpenChange={(open) => !open && setUpdateShipment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Lokasi & Status Kendaraan</DialogTitle>
          </DialogHeader>
          {updateShipment && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-1">
                <p><span className="text-muted-foreground">No. Resi:</span> <span className="font-mono font-medium">{updateShipment.trackingNumber}</span></p>
                <p><span className="text-muted-foreground">Driver:</span> {updateShipment.driverName || "-"}</p>
                <p><span className="text-muted-foreground">Tujuan:</span> {updateShipment.destination}</p>
              </div>
              <div className="space-y-2">
                <Label>Lokasi Kendaraan Saat Ini <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="Contoh: Tol Cipularang KM 72, Semarang Rest Area..."
                  value={updateForm.currentLocation}
                  onChange={(e) => setUpdateForm({ ...updateForm, currentLocation: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Isi lokasi terkini kendaraan secara spesifik</p>
              </div>
              <div className="space-y-2">
                <Label>Status Pengiriman</Label>
                <Select
                  value={updateForm.status}
                  onValueChange={(status: ShipmentRecord["status"]) => setUpdateForm({ ...updateForm, status })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Menunggu</SelectItem>
                    <SelectItem value="processing">Diproses / Packing</SelectItem>
                    <SelectItem value="shipped">Dikirim / Dalam Perjalanan</SelectItem>
                    <SelectItem value="delivered">Terkirim / Sampai Tujuan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdateShipment(null)}>Batal</Button>
            <Button onClick={handleUpdateLokasi} disabled={isUpdating}>
              {isUpdating ? "Menyimpan..." : "Simpan Lokasi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Buat Pengiriman */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Buat Pengiriman Baru</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>No. Resi</Label>
                <Input value={shipmentForm.trackingNumber} onChange={(e) => setShipmentForm({ ...shipmentForm, trackingNumber: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Tujuan</Label>
                <Input value={shipmentForm.destination} onChange={(e) => setShipmentForm({ ...shipmentForm, destination: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>No. Plat Kendaraan</Label>
                <Input placeholder="B 1234 ABC" value={shipmentForm.vehiclePlate || ""} onChange={(e) => setShipmentForm({ ...shipmentForm, vehiclePlate: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Nama Driver</Label>
                <Input value={shipmentForm.driverName || ""} onChange={(e) => setShipmentForm({ ...shipmentForm, driverName: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Tanggal Kirim</Label>
                <Input type="date" value={shipmentForm.date} onChange={(e) => setShipmentForm({ ...shipmentForm, date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Total Item</Label>
                <Input type="number" value={shipmentForm.items} onChange={(e) => setShipmentForm({ ...shipmentForm, items: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Status Awal</Label>
                <Select value={shipmentForm.status} onValueChange={(status: ShipmentRecord["status"]) => setShipmentForm({ ...shipmentForm, status })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Menunggu</SelectItem>
                    <SelectItem value="processing">Diproses</SelectItem>
                    <SelectItem value="shipped">Dikirim</SelectItem>
                    <SelectItem value="delivered">Terkirim</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Asal Gudang</Label>
                <Input value={shipmentForm.origin || ""} onChange={(e) => setShipmentForm({ ...shipmentForm, origin: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Lokasi Awal Kendaraan</Label>
                <Input value={shipmentForm.currentLocation || ""} onChange={(e) => setShipmentForm({ ...shipmentForm, currentLocation: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>Batal</Button>
            <Button onClick={handleCreateShipment}>Simpan Pengiriman</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Detail Pengiriman */}
      <Dialog open={!!selectedShipment} onOpenChange={(open) => !open && setSelectedShipment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detail Pengiriman</DialogTitle>
          </DialogHeader>
          {selectedShipment && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-muted-foreground">No. Resi</p><p className="font-mono font-medium">{selectedShipment.trackingNumber}</p></div>
              <div><p className="text-muted-foreground">Status</p><Badge variant="outline" className={statusColors[selectedShipment.status]}>{statusLabels[selectedShipment.status]}</Badge></div>
              <div><p className="text-muted-foreground">Kendaraan</p><p className="font-medium">{selectedShipment.vehiclePlate || "-"}</p></div>
              <div><p className="text-muted-foreground">Driver</p><p className="font-medium">{selectedShipment.driverName || "-"}</p></div>
              <div><p className="text-muted-foreground">Tujuan</p><p className="font-medium">{selectedShipment.destination}</p></div>
              <div><p className="text-muted-foreground">Total Item</p><p className="font-medium">{selectedShipment.items} barang</p></div>
              <div><p className="text-muted-foreground">Asal</p><p className="font-medium">{selectedShipment.origin || "-"}</p></div>
              <div><p className="text-muted-foreground">ETA</p><p className="font-medium">{selectedShipment.estimatedDelivery || "-"}</p></div>
              <div className="col-span-2">
                <p className="text-muted-foreground">Lokasi Terkini</p>
                <div className="flex items-center gap-1 mt-1">
                  <MapPin className="h-4 w-4 text-primary" />
                  <p className="font-medium text-primary">{selectedShipment.currentLocation || "Belum ada data lokasi"}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            {selectedShipment && selectedShipment.status !== "delivered" && (
              <Button onClick={() => { setSelectedShipment(null); openUpdateModal(selectedShipment); }}>
                <MapPin className="h-4 w-4 mr-1" />
                Update Lokasi
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
