import { useEffect, useState, useCallback, useRef } from "react";
import { usePolling } from "@/hooks/use-polling";
import { useNotificationContext } from "@/lib/notification-context";
import { detectStatusChanges, detectPaymentChanges } from "@/hooks/use-notifications";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ShoppingCart,
  Package,
  RotateCcw,
  CreditCard,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Truck,
  Eye,
} from "lucide-react";
import { api, type InventoryRecord, type PurchaseOrderRecord, type ReturnRecord, type PaymentRecord } from "@/src/lib/api";

export function DealerDashboard() {
  const { push } = useNotificationContext();
  const [orders, setOrders] = useState<PurchaseOrderRecord[]>([]);
  const [returnRequests, setReturnRequests] = useState<ReturnRecord[]>([]);
  const [inventory, setInventory] = useState<InventoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const prevOrdersRef = useRef<PurchaseOrderRecord[]>([]);
  const [showPOForm, setShowPOForm] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPOForPayment, setSelectedPOForPayment] = useState<PurchaseOrderRecord | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentRecord[]>([]);
  const [paymentHistoryLoading, setPaymentHistoryLoading] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    paymentMethod: "transfer" as PaymentRecord["paymentMethod"],
    paymentDate: new Date().toISOString().split("T")[0],
    proofUrl: "",
    notes: "",
  });
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [showReturnsModal, setShowReturnsModal] = useState(false);
  const [poDealerName, setPoDealerName] = useState("Dealer Jakarta");
  const [poItems, setPoItems] = useState<PurchaseOrderRecord["items"]>([]);
  const [poItemForm, setPoItemForm] = useState({ name: "", quantity: "1", unitPrice: "0" });
  const [returnForm, setReturnForm] = useState({
    itemName: "",
    quantity: "1",
    reason: "Barang Cacat",
    requester: "Dealer Jakarta",
  });

  const fetchData = useCallback(async () => {
    const [ordersResult, returnsResult, inventoryResult] = await Promise.allSettled([
      api.purchaseOrders.list(),
      api.returns.list(),
      api.inventory.list(),
    ]);
    if (ordersResult.status === "fulfilled") {
      const next = ordersResult.value;
      detectStatusChanges(prevOrdersRef.current, next, (o) => `PO ${o.orderNumber}`).forEach((msg) => push(msg, "info"));
      detectPaymentChanges(prevOrdersRef.current, next, (o) => `PO ${o.orderNumber}`).forEach((msg) => push(msg, "success"));
      prevOrdersRef.current = next;
      setOrders(next);
    }
    if (returnsResult.status === "fulfilled") setReturnRequests(returnsResult.value);
    if (inventoryResult.status === "fulfilled") {
      setInventory(inventoryResult.value);
      setReturnForm((form) => ({ ...form, itemName: form.itemName || inventoryResult.value[0]?.name || "" }));
    }
    setIsLoading(false);
  }, [push]);

  usePolling(fetchData, 30_000);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-warning/10 text-warning",
      approved: "bg-primary/10 text-primary",
      processing: "bg-chart-4/10 text-chart-4",
      shipped: "bg-primary/10 text-primary",
      delivered: "bg-success/10 text-success",
      cancelled: "bg-destructive/10 text-destructive",
    };
    return colors[status] || "bg-muted text-muted-foreground";
  };

  const getPaymentStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      unpaid: "bg-destructive/10 text-destructive",
      partial: "bg-warning/10 text-warning",
      paid: "bg-success/10 text-success",
    };
    return colors[status] || "bg-muted text-muted-foreground";
  };

  const addPOItem = () => {
    if (!poItemForm.name || Number(poItemForm.quantity) <= 0) {
      alert("Nama barang dan quantity wajib diisi");
      return;
    }

    setPoItems((items) => [
      ...items,
      {
        name: poItemForm.name,
        quantity: Number(poItemForm.quantity),
        unitPrice: Number(poItemForm.unitPrice || 0),
      },
    ]);
    setPoItemForm({ name: "", quantity: "1", unitPrice: "0" });
  };

  const handleCreateOrder = async () => {
    const itemsToSubmit = poItems.length
      ? poItems
      : poItemForm.name
        ? [{ name: poItemForm.name, quantity: Number(poItemForm.quantity), unitPrice: Number(poItemForm.unitPrice || 0) }]
        : [];

    if (!poDealerName || !itemsToSubmit.length) {
      alert("Dealer dan minimal satu barang wajib diisi");
      return;
    }

    const created = await api.purchaseOrders.create({ dealerName: poDealerName, items: itemsToSubmit });
    setOrders((items) => [created, ...items]);
    setPoItems([]);
    setPoItemForm({ name: "", quantity: "1", unitPrice: "0" });
    setShowPOForm(false);
  };

  const handleVerifyIncoming = async (order: PurchaseOrderRecord) => {
    await api.purchaseOrders.updateStatus(order.id, "delivered");
    setOrders((items) => items.map((item) => (item.id === order.id ? { ...item, status: "delivered" } : item)));
  };

  const handleCreateReturn = async () => {
    const created = await api.returns.create({
      itemName: returnForm.itemName,
      quantity: Number(returnForm.quantity),
      reason: returnForm.reason,
      requester: returnForm.requester,
    });
    setReturnRequests((items) => [created, ...items]);
    setShowReturnModal(false);
  };

  const handleOpenPaymentModal = async (order: PurchaseOrderRecord) => {
    setSelectedPOForPayment(order);
    setPaymentError("");
    setPaymentForm({
      amount: "",
      paymentMethod: "transfer",
      paymentDate: new Date().toISOString().split("T")[0],
      proofUrl: "",
      notes: "",
    });
    setShowPaymentModal(true);
    // Load payment history
    setPaymentHistoryLoading(true);
    try {
      const history = await api.purchaseOrders.payments.list(order.id);
      setPaymentHistory(history);
    } finally {
      setPaymentHistoryLoading(false);
    }
  };

  const handleSubmitPayment = async () => {
    if (!selectedPOForPayment) return;
    if (!paymentForm.amount || Number(paymentForm.amount) <= 0) {
      setPaymentError("Nominal pembayaran harus lebih dari 0");
      return;
    }
    setPaymentSubmitting(true);
    setPaymentError("");
    try {
      const result = await api.purchaseOrders.payments.create(selectedPOForPayment.id, {
        amount: Number(paymentForm.amount),
        paymentMethod: paymentForm.paymentMethod,
        paymentDate: paymentForm.paymentDate,
        proofUrl: paymentForm.proofUrl || undefined,
        notes: paymentForm.notes || undefined,
        createdBy: selectedPOForPayment.dealerName,
      });
      setPaymentHistory((prev) => [result.payment, ...prev]);
      setOrders((items) =>
        items.map((item) =>
          item.id === selectedPOForPayment.id
            ? { ...item, paymentStatus: result.paymentStatus as PurchaseOrderRecord["paymentStatus"] }
            : item
        )
      );
      // Update selectedPO juga
      setSelectedPOForPayment((po) =>
        po ? { ...po, paymentStatus: result.paymentStatus as PurchaseOrderRecord["paymentStatus"] } : po
      );
      setPaymentForm({
        amount: "",
        paymentMethod: "transfer",
        paymentDate: new Date().toISOString().split("T")[0],
        proofUrl: "",
        notes: "",
      });
    } catch (err: unknown) {
      setPaymentError(err instanceof Error ? err.message : "Gagal menyimpan pembayaran");
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const handleDeletePayment = async (paymentId: number) => {
    if (!selectedPOForPayment) return;
    if (!confirm("Hapus catatan pembayaran ini?")) return;
    try {
      const result = await api.purchaseOrders.payments.remove(selectedPOForPayment.id, paymentId);
      setPaymentHistory((prev) => prev.filter((p) => p.id !== paymentId));
      setOrders((items) =>
        items.map((item) =>
          item.id === selectedPOForPayment.id
            ? { ...item, paymentStatus: result.paymentStatus as PurchaseOrderRecord["paymentStatus"] }
            : item
        )
      );
      setSelectedPOForPayment((po) =>
        po ? { ...po, paymentStatus: result.paymentStatus as PurchaseOrderRecord["paymentStatus"] } : po
      );
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal menghapus pembayaran");
    }
  };


  const renderOrderTable = (items: PurchaseOrderRecord[]) => (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Order ID</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Dealer</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Items</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Total</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Payment</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={7} className="py-6 text-center text-sm text-muted-foreground">Belum ada order.</td>
            </tr>
          ) : items.map((order) => (
            <tr key={order.id} className="border-b border-border hover:bg-muted/50">
              <td className="py-3 px-4 text-sm font-medium text-foreground">{order.orderNumber}</td>
              <td className="py-3 px-4 text-sm text-foreground">{order.dealerName}</td>
              <td className="py-3 px-4 text-sm text-muted-foreground">{order.items.length} items</td>
              <td className="py-3 px-4 text-sm font-medium">Rp {Number(order.totalAmount).toLocaleString("id-ID")}</td>
              <td className="py-3 px-4">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                  {order.status.toUpperCase()}
                </span>
              </td>
              <td className="py-3 px-4">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPaymentStatusColor(order.paymentStatus)}`}>
                  {order.paymentStatus.toUpperCase()}
                </span>
              </td>
              <td className="py-3 px-4">
                <div className="flex items-center gap-1">
                  {order.paymentStatus !== "paid" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => { setShowOrdersModal(false); handleOpenPaymentModal(order); }}
                    >
                      <CreditCard className="h-3 w-3 mr-1" />
                      Bayar
                    </Button>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-success">
                      <CheckCircle2 className="h-3 w-3" />
                      Lunas
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => { setShowOrdersModal(false); handleOpenPaymentModal(order); }}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    Riwayat
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Orders</p>
                <p className="text-3xl font-bold text-foreground">{orders.filter((po) => po.status !== "delivered" && po.status !== "cancelled").length}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <ShoppingCart className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Delivery</p>
                <p className="text-3xl font-bold text-foreground">{orders.filter((po) => po.status === "shipped").length}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-warning/10 flex items-center justify-center">
                <Truck className="h-6 w-6 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Returns</p>
                <p className="text-3xl font-bold text-foreground">{returnRequests.filter((item) => item.status === "pending").length}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-destructive/10 flex items-center justify-center">
                <RotateCcw className="h-6 w-6 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Unpaid Orders</p>
                <p className="text-3xl font-bold text-foreground">{orders.filter((po) => po.paymentStatus !== "paid").length}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-chart-4/10 flex items-center justify-center">
                <CreditCard className="h-6 w-6 text-chart-4" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Button className="h-auto py-4 flex flex-col gap-2" onClick={() => setShowPOForm(!showPOForm)}>
          <Plus className="h-5 w-5" />
          <span>Create PO/SO</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => setShowVerifyModal(true)}>
          <CheckCircle2 className="h-5 w-5" />
          <span>Verify Incoming</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => setShowReturnModal(true)}>
          <RotateCcw className="h-5 w-5" />
          <span>Create Return</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => {
          const unpaid = orders.find((o) => o.paymentStatus !== "paid");
          if (unpaid) handleOpenPaymentModal(unpaid);
          else setShowPaymentModal(true);
        }}>
          <CreditCard className="h-5 w-5" />
          <span>Make Payment</span>
        </Button>
      </div>

      {showPOForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Create Purchase Order</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Dealer Name</Label>
                <Input value={poDealerName} onChange={(event) => setPoDealerName(event.target.value)} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Item Name</Label>
                  <Select value={poItemForm.name} onValueChange={(name) => setPoItemForm({ ...poItemForm, name })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select item" />
                    </SelectTrigger>
                    <SelectContent>
                      {inventory.map((item) => (
                        <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input type="number" value={poItemForm.quantity} onChange={(event) => setPoItemForm({ ...poItemForm, quantity: event.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Unit Price</Label>
                  <Input type="number" value={poItemForm.unitPrice} onChange={(event) => setPoItemForm({ ...poItemForm, unitPrice: event.target.value })} />
                </div>
              </div>
              {poItems.length > 0 && (
                <div className="rounded-lg border border-border p-3 space-y-2">
                  {poItems.map((item, index) => (
                    <div key={`${item.name}-${index}`} className="flex items-center justify-between text-sm">
                      <span>{item.name}</span>
                      <span className="text-muted-foreground">{item.quantity} x Rp {item.unitPrice.toLocaleString("id-ID")}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={addPOItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Button>
                <Button size="sm" onClick={handleCreateOrder}>Submit Order</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowPOForm(false)}>Cancel</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-lg font-semibold">My Orders</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setShowOrdersModal(true)}>
              <Eye className="h-4 w-4 mr-1" />
              View All
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Memuat data order...</p>
              ) : orders.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada order.</p>
              ) : orders.slice(0, 4).map((order) => (
                <div key={order.id} className="p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{order.orderNumber}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                          {order.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{new Date(order.createdAt).toLocaleDateString("id-ID")}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-foreground">Rp {Number(order.totalAmount).toLocaleString("id-ID")}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPaymentStatusColor(order.paymentStatus)}`}>
                        {order.paymentStatus.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Package className="h-4 w-4" />
                      <span>{order.items.length} items</span>
                    </div>
                    {order.paymentStatus !== "paid" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => handleOpenPaymentModal(order)}
                      >
                        <CreditCard className="h-3 w-3 mr-1" />
                        Bayar
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-muted-foreground"
                        onClick={() => handleOpenPaymentModal(order)}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        Riwayat
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-lg font-semibold">Return Requests</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setShowReturnsModal(true)}>
              <Eye className="h-4 w-4 mr-1" />
              View All
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Memuat data retur...</p>
              ) : returnRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada permintaan retur.</p>
              ) : returnRequests.slice(0, 4).map((returnItem) => (
                <div key={returnItem.id} className="p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{returnItem.returnNumber}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(returnItem.status)}`}>
                          {returnItem.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm text-foreground mt-1">{returnItem.itemName}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">{new Date(returnItem.requestDate).toLocaleDateString("id-ID")}</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="truncate">{returnItem.reason}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Payment Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Order ID</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Amount</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Order Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Payment Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-sm text-muted-foreground">Memuat data order...</td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-sm text-muted-foreground">Belum ada order.</td>
                  </tr>
                ) : orders.map((order) => (
                  <tr key={order.id} className="border-b border-border hover:bg-muted/50">
                    <td className="py-3 px-4 text-sm font-medium text-foreground">{order.orderNumber}</td>
                    <td className="py-3 px-4 text-sm text-foreground">Rp {Number(order.totalAmount).toLocaleString("id-ID")}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                        {order.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPaymentStatusColor(order.paymentStatus)}`}>
                        {order.paymentStatus.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {order.paymentStatus !== "paid" ? (
                          <Button variant="outline" size="sm" onClick={() => handleOpenPaymentModal(order)}>Pay Now</Button>
                        ) : (
                          <span className="flex items-center gap-1 text-sm text-success">
                            <CheckCircle2 className="h-4 w-4" />
                            Paid
                          </span>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => handleOpenPaymentModal(order)}>
                          <Eye className="h-4 w-4 mr-1" />
                          Riwayat
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showVerifyModal} onOpenChange={setShowVerifyModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify Incoming</DialogTitle>
            <DialogDescription>Konfirmasi order yang sudah diterima.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {orders.filter((order) => order.status === "shipped").map((order) => (
              <div key={order.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="font-medium">{order.orderNumber}</p>
                  <p className="text-sm text-muted-foreground">{order.items.length} items dari {order.dealerName}</p>
                </div>
                <Button size="sm" onClick={() => handleVerifyIncoming(order)}>Verify</Button>
              </div>
            ))}
            {!orders.some((order) => order.status === "shipped") && <p className="text-sm text-muted-foreground">Belum ada order yang perlu diverifikasi.</p>}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showReturnModal} onOpenChange={setShowReturnModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Return</DialogTitle>
            <DialogDescription>Buat permintaan retur baru.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Barang</Label>
              <Select value={returnForm.itemName} onValueChange={(itemName) => setReturnForm({ ...returnForm, itemName })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {inventory.map((item) => (
                    <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input type="number" value={returnForm.quantity} onChange={(event) => setReturnForm({ ...returnForm, quantity: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Requester</Label>
                <Input value={returnForm.requester} onChange={(event) => setReturnForm({ ...returnForm, requester: event.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Input value={returnForm.reason} onChange={(event) => setReturnForm({ ...returnForm, reason: event.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReturnModal(false)}>Cancel</Button>
            <Button onClick={handleCreateReturn}>Submit Return</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── WBS 1.13: Payment Modal ─────────────────────────────── */}
      <Dialog open={showPaymentModal} onOpenChange={(open) => { setShowPaymentModal(open); if (!open) setSelectedPOForPayment(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pembayaran Purchase Order</DialogTitle>
            <DialogDescription>
              {selectedPOForPayment
                ? `${selectedPOForPayment.orderNumber} — Total: Rp ${Number(selectedPOForPayment.totalAmount).toLocaleString("id-ID")}`
                : "Pilih PO untuk melakukan pembayaran"}
            </DialogDescription>
          </DialogHeader>

          {!selectedPOForPayment ? (
            // Pilih PO jika belum dipilih
            <div className="space-y-3">
              {orders.filter((o) => o.paymentStatus !== "paid").map((order) => (
                <div key={order.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="font-medium">{order.orderNumber}</p>
                    <p className="text-sm text-muted-foreground">Rp {Number(order.totalAmount).toLocaleString("id-ID")} — {order.paymentStatus.toUpperCase()}</p>
                  </div>
                  <Button size="sm" onClick={() => handleOpenPaymentModal(order)}>Bayar</Button>
                </div>
              ))}
              {!orders.some((o) => o.paymentStatus !== "paid") && (
                <p className="text-sm text-muted-foreground text-center py-4">Semua order sudah lunas.</p>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary sisa tagihan */}
              {(() => {
                const totalPaid = paymentHistory.reduce((s, p) => s + Number(p.amount), 0);
                const remaining = Number(selectedPOForPayment.totalAmount) - totalPaid;
                return (
                  <div className="grid grid-cols-3 gap-3 rounded-lg bg-muted/50 p-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Total PO</p>
                      <p className="font-semibold">Rp {Number(selectedPOForPayment.totalAmount).toLocaleString("id-ID")}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Sudah Dibayar</p>
                      <p className="font-semibold text-green-600">Rp {totalPaid.toLocaleString("id-ID")}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Sisa Tagihan</p>
                      <p className={`font-semibold ${remaining > 0 ? "text-red-600" : "text-green-600"}`}>
                        Rp {remaining.toLocaleString("id-ID")}
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Form bayar baru — sembunyikan jika sudah lunas */}
              {selectedPOForPayment.paymentStatus !== "paid" && (
                <div className="space-y-4 rounded-lg border border-border p-4">
                  <h3 className="font-semibold text-sm">Catat Pembayaran Baru</h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="pay-amount">Nominal (Rp) *</Label>
                      <Input
                        id="pay-amount"
                        type="number"
                        min="1"
                        placeholder="Contoh: 5000000"
                        value={paymentForm.amount}
                        onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="pay-method">Metode Pembayaran *</Label>
                      <Select
                        value={paymentForm.paymentMethod}
                        onValueChange={(v) => setPaymentForm((f) => ({ ...f, paymentMethod: v as PaymentRecord["paymentMethod"] }))}
                      >
                        <SelectTrigger id="pay-method">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="transfer">Transfer Bank</SelectItem>
                          <SelectItem value="tunai">Tunai</SelectItem>
                          <SelectItem value="cek">Cek</SelectItem>
                          <SelectItem value="giro">Giro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="pay-date">Tanggal Bayar *</Label>
                      <Input
                        id="pay-date"
                        type="date"
                        value={paymentForm.paymentDate}
                        onChange={(e) => setPaymentForm((f) => ({ ...f, paymentDate: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="pay-proof">URL Bukti Transfer</Label>
                      <Input
                        id="pay-proof"
                        placeholder="https://... (opsional)"
                        value={paymentForm.proofUrl}
                        onChange={(e) => setPaymentForm((f) => ({ ...f, proofUrl: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="pay-notes">Catatan</Label>
                    <Input
                      id="pay-notes"
                      placeholder="Misal: DP 50%, pelunasan, dll."
                      value={paymentForm.notes}
                      onChange={(e) => setPaymentForm((f) => ({ ...f, notes: e.target.value }))}
                    />
                  </div>

                  {paymentError && (
                    <p className="text-sm text-destructive">{paymentError}</p>
                  )}

                  <Button onClick={handleSubmitPayment} disabled={paymentSubmitting} className="w-full">
                    {paymentSubmitting ? "Menyimpan..." : "Simpan Pembayaran"}
                  </Button>
                </div>
              )}

              {selectedPOForPayment.paymentStatus === "paid" && (
                <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                  <span>Order ini sudah lunas.</span>
                </div>
              )}

              {/* Riwayat pembayaran */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Riwayat Pembayaran</h3>
                {paymentHistoryLoading ? (
                  <p className="text-sm text-muted-foreground">Memuat riwayat...</p>
                ) : paymentHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada pembayaran tercatat.</p>
                ) : (
                  <div className="space-y-2">
                    {paymentHistory.map((p) => (
                      <div key={p.id} className="flex items-start justify-between rounded-lg border border-border p-3 text-sm">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{p.paymentNumber}</span>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">{p.paymentMethod}</span>
                          </div>
                          <p className="text-green-600 font-semibold">Rp {Number(p.amount).toLocaleString("id-ID")}</p>
                          <p className="text-muted-foreground">{p.paymentDate} · {p.createdBy}</p>
                          {p.notes && <p className="text-muted-foreground italic">{p.notes}</p>}
                          {p.proofUrl && (
                            <a href={p.proofUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline text-xs">
                              Lihat Bukti
                            </a>
                          )}
                        </div>
                        {selectedPOForPayment.paymentStatus !== "paid" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeletePayment(p.id)}
                          >
                            Hapus
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>


      <Dialog open={showOrdersModal} onOpenChange={setShowOrdersModal}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>All Orders</DialogTitle>
          </DialogHeader>
          {renderOrderTable(orders)}
        </DialogContent>
      </Dialog>

      <Dialog open={showReturnsModal} onOpenChange={setShowReturnsModal}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>All Return Requests</DialogTitle>
          </DialogHeader>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">No</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Item</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Qty</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Reason</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {returnRequests.map((item) => (
                  <tr key={item.id} className="border-b border-border hover:bg-muted/50">
                    <td className="py-3 px-4 text-sm font-medium">{item.returnNumber}</td>
                    <td className="py-3 px-4 text-sm">{item.itemName}</td>
                    <td className="py-3 px-4 text-sm">{item.quantity}</td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{item.reason}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                        {item.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
