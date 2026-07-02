import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { usePolling } from "@/hooks/use-polling";
import { useNotificationContext } from "@/lib/notification-context";
import { detectStatusChanges, detectPaymentChanges } from "@/hooks/use-notifications";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Package,
  MapPin,
  BarChart3,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { api, type PurchaseOrderRecord, type ReturnRecord, type ShipmentRecord, type WarehouseTransactionRecord } from "@/src/lib/api";

export function ManagerDashboard() {
  const { push } = useNotificationContext();
  const [orders, setOrders] = useState<PurchaseOrderRecord[]>([]);
  const [shipments, setShipments] = useState<ShipmentRecord[]>([]);
  const [returnRequests, setReturnRequests] = useState<ReturnRecord[]>([]);
  const [transactions, setTransactions] = useState<WarehouseTransactionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const prevOrdersRef = useRef<PurchaseOrderRecord[]>([]);
  const prevShipmentsRef = useRef<ShipmentRecord[]>([]);
  const prevReturnsRef = useRef<ReturnRecord[]>([]);

  const fetchData = useCallback(async () => {
    const [ordersResult, shipmentsResult, returnsResult, transactionsResult] = await Promise.allSettled([
      api.purchaseOrders.list(),
      api.shipments.list(),
      api.returns.list(),
      api.warehouse.transactions(),
    ]);

    if (ordersResult.status === "fulfilled") {
      const next = ordersResult.value;
      detectStatusChanges(prevOrdersRef.current, next, (o) => `PO ${o.orderNumber}`).forEach((msg) => push(msg, "info"));
      detectPaymentChanges(prevOrdersRef.current, next, (o) => `PO ${o.orderNumber}`).forEach((msg) => push(msg, "success"));
      prevOrdersRef.current = next;
      setOrders(next);
    }
    if (shipmentsResult.status === "fulfilled") {
      const next = shipmentsResult.value;
      detectStatusChanges(prevShipmentsRef.current, next, (s) => `Shipment ${s.trackingNumber}`).forEach((msg) => push(msg, "info"));
      prevShipmentsRef.current = next;
      setShipments(next);
    }
    if (returnsResult.status === "fulfilled") {
      const next = returnsResult.value;
      detectStatusChanges(prevReturnsRef.current, next, (r) => `Retur ${r.returnNumber}`).forEach((msg) => push(msg, "warning"));
      prevReturnsRef.current = next;
      setReturnRequests(next);
    }
    if (transactionsResult.status === "fulfilled") setTransactions(transactionsResult.value);
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

  const movementData = useMemo(() => {
    if (!transactions.length) return [];

    const formatter = new Intl.DateTimeFormat("en-US", { month: "short" });
    const grouped = new Map<string, { month: string; masuk: number; keluar: number }>();

    transactions.forEach((transaction) => {
      const month = formatter.format(new Date(transaction.timestamp));
      const current = grouped.get(month) || { month, masuk: 0, keluar: 0 };
      if (transaction.type === "incoming") {
        current.masuk += transaction.quantity;
      } else {
        current.keluar += transaction.quantity;
      }
      grouped.set(month, current);
    });

    return Array.from(grouped.values());
  }, [transactions]);

  const incomingTotal = transactions.filter((item) => item.type === "incoming").reduce((sum, item) => sum + item.quantity, 0);
  const outgoingTotal = transactions.filter((item) => item.type === "outgoing").reduce((sum, item) => sum + item.quantity, 0);
  const returnTotal = returnRequests.reduce((sum, item) => sum + item.quantity, 0);

  const monthTrend = (items: { quantity: number; date: Date }[]) => {
    const now = new Date();
    const thisMonth = items.filter((item) => item.date.getMonth() === now.getMonth() && item.date.getFullYear() === now.getFullYear())
      .reduce((sum, item) => sum + item.quantity, 0);
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonth = items.filter((item) => item.date.getMonth() === lastMonthDate.getMonth() && item.date.getFullYear() === lastMonthDate.getFullYear())
      .reduce((sum, item) => sum + item.quantity, 0);
    if (!lastMonth) return thisMonth > 0 ? "+100%" : "0%";
    const change = ((thisMonth - lastMonth) / lastMonth) * 100;
    return `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`;
  };

  const incomingTrend = monthTrend(transactions.filter((t) => t.type === "incoming").map((t) => ({ quantity: t.quantity, date: new Date(t.timestamp) })));
  const outgoingTrend = monthTrend(transactions.filter((t) => t.type === "outgoing").map((t) => ({ quantity: t.quantity, date: new Date(t.timestamp) })));
  const returnTrend = monthTrend(returnRequests.map((r) => ({ quantity: r.quantity, date: new Date(r.requestDate) })));

  const rekapData = [
    { type: "Barang Masuk", count: incomingTotal, trend: incomingTrend, icon: ArrowDownToLine, iconClass: "text-success", iconBg: "bg-success/10" },
    { type: "Barang Keluar", count: outgoingTotal, trend: outgoingTrend, icon: ArrowUpFromLine, iconClass: "text-primary", iconBg: "bg-primary/10" },
    { type: "Barang Retur", count: returnTotal, trend: returnTrend, icon: RotateCcw, iconClass: "text-destructive", iconBg: "bg-destructive/10" },
  ];

  const handleExportReport = () => {
    const header = ["Order ID", "Dealer", "Items", "Total", "Status", "Payment", "Date"];
    const rows = orders.map((order) => [
      order.orderNumber,
      order.dealerName,
      String(order.items.length),
      String(order.totalAmount),
      order.status,
      order.paymentStatus,
      new Date(order.createdAt).toLocaleDateString("id-ID"),
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `manager-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {rekapData.map((item, index) => {
          const Icon = item.icon;
          const isPositive = item.trend.startsWith("+");
          return (
            <Card key={index}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{item.type}</p>
                    <p className="text-3xl font-bold text-foreground">{item.count.toLocaleString()}</p>
                    <p className={`text-xs flex items-center gap-1 mt-1 ${isPositive ? "text-success" : "text-destructive"}`}>
                      {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {item.trend} from last month
                    </p>
                  </div>
                  <div className={`h-12 w-12 rounded-lg ${item.iconBg} flex items-center justify-center`}>
                    <Icon className={`h-6 w-6 ${item.iconClass}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Inventory Movement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              {movementData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  {isLoading ? "Memuat data transaksi..." : "Belum ada data transaksi gudang."}
                </div>
              ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={movementData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="masuk" name="Barang Masuk" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="keluar" name="Barang Keluar" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Movement Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              {movementData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  {isLoading ? "Memuat data transaksi..." : "Belum ada data transaksi gudang."}
                </div>
              ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={movementData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="masuk" name="Barang Masuk" stroke="hsl(var(--success))" strokeWidth={2} dot={{ fill: "hsl(var(--success))" }} />
                  <Line type="monotone" dataKey="keluar" name="Barang Keluar" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))" }} />
                </LineChart>
              </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-semibold">Rekap Barang Masuk/Keluar/Retur</CardTitle>
          <Button size="sm" variant="outline" onClick={handleExportReport}>
            <BarChart3 className="h-4 w-4 mr-1" />
            Export Report
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Order ID</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Dealer</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Items</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Total</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Date</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-sm text-muted-foreground">Memuat data order...</td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-sm text-muted-foreground">Belum ada purchase order.</td>
                  </tr>
                ) : orders.map((order) => (
                  <tr key={order.id} className="border-b border-border hover:bg-muted/50">
                    <td className="py-3 px-4 text-sm font-medium text-foreground">{order.orderNumber}</td>
                    <td className="py-3 px-4 text-sm text-foreground">{order.dealerName}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-foreground">{order.items.length} items</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm font-medium text-foreground">
                      Rp {Number(order.totalAmount).toLocaleString("id-ID")}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                        {order.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{new Date(order.createdAt).toLocaleDateString("id-ID")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Posisi Barang (Shipment Status)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Memuat data pengiriman...</p>
            ) : shipments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada data pengiriman.</p>
            ) : shipments.slice(0, 4).map((shipment) => (
              <div key={shipment.id} className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{shipment.trackingNumber}</p>
                    <p className="text-sm text-muted-foreground">{shipment.destination}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {shipment.currentLocation && (
                    <div className="flex items-center gap-1 text-sm text-primary">
                      <MapPin className="h-4 w-4" />
                      <span>{shipment.currentLocation}</span>
                    </div>
                  )}
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(shipment.status)}`}>
                    {shipment.status.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
