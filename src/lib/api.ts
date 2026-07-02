const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

// Bug #4 helper: ambil role dari localStorage agar server bisa validasi
// (solusi sementara sebelum JWT — Bug #2 — diimplementasikan)
function getUserRole(): string {
  try {
    const stored = localStorage.getItem("sc_user");
    if (stored) return (JSON.parse(stored) as { role: string }).role;
  } catch { /* ignore */ }
  return "";
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      "x-user-role": getUserRole(),
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request gagal" }));
    throw new Error(error.message || "Request gagal");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export type InventoryRecord = {
  id: number;
  sku: string;
  name: string;
  category: string;
  stock: number;
  minStock: number;
  condition: "baik" | "rusak" | "expired";
  rack: string;
  pallet: string;
};

export type ShipmentRecord = {
  id: number;
  trackingNumber: string;
  destination: string;
  date: string;
  items: number;
  status: "pending" | "processing" | "shipped" | "delivered";
  vehiclePlate?: string | null;
  driverName?: string | null;
  origin?: string | null;
  estimatedDelivery?: string | null;
  currentLocation?: string | null;
};

export type ReturnRecord = {
  id: number;
  returnNumber: string;
  itemName: string;
  quantity: number;
  reason: string;
  status: "pending" | "approved" | "rejected" | "completed";
  requestDate: string;
  requester: string;
};

export type DocumentRecord = {
  id: number;
  number: string;
  type: "po" | "surat_jalan" | "picking_list" | "retur";
  relatedTo: string;
  date: string;
  status: "draft" | "final";
};

export type WarehouseTransactionRecord = {
  id: number;
  type: "incoming" | "outgoing";
  itemId: number;
  itemName: string;
  quantity: number;
  partner?: string | null;
  notes?: string | null;
  timestamp: string;
};

export type PurchaseOrderRecord = {
  id: number;
  orderNumber: string;
  dealerName: string;
  items: Array<{ name: string; quantity: number; unitPrice: number }>;
  status: "pending" | "approved" | "processing" | "shipped" | "delivered" | "cancelled";
  totalAmount: number;
  createdAt: string;
  paymentStatus: "unpaid" | "partial" | "paid";
};

export type SalesOrderRecord = {
  id: number;
  orderNumber: string;
  dealerName: string;
  distributorName: string;
  items: Array<{ name: string; quantity: number; unitPrice: number }>;
  status: "draft" | "submitted" | "approved" | "processing" | "shipped" | "delivered" | "cancelled";
  totalAmount: number;
  notes: string | null;
  createdAt: string;
};

export type ReportsSummary = {
  summary: {
    totalIncoming: number;
    totalOutgoing: number;
    totalReturns: number;
    totalRevenue: number;
    incomingGrowth: number;
    outgoingGrowth: number;
    returnsGrowth: number;
    revenueGrowth: number;
  };
  monthlyMovement: Array<{ month: string; masuk: number; keluar: number; retur: number }>;
  shipmentPerformance: Array<{ month: string; onTime: number; delayed: number }>;
  categoryDistribution: Array<{ name: string; value: number }>;
};

export type StockOpnameItem = {
  id: number;
  itemId: number;
  itemName: string;
  sku: string;
  systemStock: number;
  physicalStock: number;
  difference: number;
};

export type StockOpnameRecord = {
  id: number;
  opnameNumber: string;
  conductedBy: string;
  notes?: string | null;
  status: 'draft' | 'selesai';
  conductedAt: string;
  totalItems?: number;
  totalDifference?: number;
  items?: StockOpnameItem[];
};

export type GoodsReceiptItem = {
  id: number;
  itemName: string;
  orderedQty: number;
  receivedQty: number;
  conditionStatus: 'baik' | 'rusak' | 'expired';
  notes: string | null;
};

export type GoodsReceiptRecord = {
  id: number;
  receiptNumber: string;
  purchaseOrderId: number;
  poNumber: string;
  dealerName: string;
  receivedBy: string;
  invoiceNumber: string | null;
  invoiceUrl: string | null;
  notes: string | null;
  status: 'draft' | 'confirmed';
  receivedAt: string;
  items: GoodsReceiptItem[];
};

export type ItemHistoryRecord = {
  item: InventoryRecord;
  transactions: Array<{
    id: number;
    type: 'incoming' | 'outgoing';
    quantity: number;
    partner: string | null;
    notes: string | null;
    timestamp: string;
  }>;
  summary: {
    totalIncoming: number;
    totalOutgoing: number;
    totalTransactions: number;
  };
};

export type PaymentRecord = {
  id: number;
  purchaseOrderId: number;
  paymentNumber: string;
  amount: number;
  paymentMethod: 'transfer' | 'tunai' | 'cek' | 'giro';
  paymentDate: string;
  proofUrl: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
};

export const api = {
  login: (data: { email: string; password: string; role?: string }) =>
    request<{ id: number; name: string; email: string; role: "gudang" | "logistik" | "dealer" | "manager" }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  inventory: {
    list: () => request<InventoryRecord[]>("/inventory"),
    create: (data: Omit<InventoryRecord, "id">) =>
      request<InventoryRecord>("/inventory", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: Omit<InventoryRecord, "id">) =>
      request<InventoryRecord>(`/inventory/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: number) => request<void>(`/inventory/${id}`, { method: "DELETE" }),
    history: (id: number) => request<ItemHistoryRecord>(`/inventory/${id}/transactions`),
  },
  shipments: {
    list: () => request<ShipmentRecord[]>("/shipments"),
    create: (data: Omit<ShipmentRecord, "id">) =>
      request<ShipmentRecord>("/shipments", { method: "POST", body: JSON.stringify(data) }),
    updateStatus: (id: number, status: ShipmentRecord["status"], currentLocation?: string) =>
      request<{ ok: true }>(`/shipments/${id}/status`, { method: "PATCH", body: JSON.stringify({ status, currentLocation }) }),
    remove: (id: number) => request<void>(`/shipments/${id}`, { method: "DELETE" }),
  },
  purchaseOrders: {
    list: () => request<PurchaseOrderRecord[]>("/purchase-orders"),
    create: (data: { dealerName: string; items: PurchaseOrderRecord["items"] }) =>
      request<PurchaseOrderRecord>("/purchase-orders", { method: "POST", body: JSON.stringify(data) }),
    updateStatus: (id: number, status: PurchaseOrderRecord["status"]) =>
      request<{ ok: true }>(`/purchase-orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    updatePayment: (id: number, paymentStatus: PurchaseOrderRecord["paymentStatus"]) =>
      request<{ ok: true }>(`/purchase-orders/${id}/payment`, { method: "PATCH", body: JSON.stringify({ paymentStatus }) }),
    payments: {
      list: (poId: number) => request<PaymentRecord[]>(`/purchase-orders/${poId}/payments`),
      create: (poId: number, data: {
        amount: number;
        paymentMethod: PaymentRecord['paymentMethod'];
        paymentDate: string;
        proofUrl?: string;
        notes?: string;
        createdBy: string;
      }) => request<{ payment: PaymentRecord; paymentStatus: string; totalPaid: number }>(
        `/purchase-orders/${poId}/payments`,
        { method: 'POST', body: JSON.stringify(data) }
      ),
      remove: (poId: number, paymentId: number) =>
        request<{ ok: true; paymentStatus: string; totalPaid: number }>(
          `/purchase-orders/${poId}/payments/${paymentId}`,
          { method: 'DELETE' }
        ),
    },
  },
  salesOrders: {
    list: () => request<SalesOrderRecord[]>("/sales-orders"),
    create: (data: { dealerName: string; distributorName?: string; items: SalesOrderRecord["items"]; notes?: string }) =>
      request<SalesOrderRecord>("/sales-orders", { method: "POST", body: JSON.stringify(data) }),
    updateStatus: (id: number, status: SalesOrderRecord["status"]) =>
      request<{ ok: true }>(`/sales-orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    remove: (id: number) => request<void>(`/sales-orders/${id}`, { method: "DELETE" }),
  },
  warehouse: {
    transactions: () => request<WarehouseTransactionRecord[]>("/warehouse/transactions"),
    record: (data: { type: WarehouseTransactionRecord["type"]; itemId: number; quantity: number; partner?: string; notes?: string }) =>
      request<{ item: InventoryRecord; transaction: WarehouseTransactionRecord }>("/warehouse/transactions", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },
  returns: {
    list: () => request<ReturnRecord[]>("/returns"),
    create: (data: Pick<ReturnRecord, "itemName" | "quantity" | "reason" | "requester">) =>
      request<ReturnRecord>("/returns", { method: "POST", body: JSON.stringify(data) }),
    updateStatus: (id: number, status: ReturnRecord["status"]) =>
      request<{ ok: true }>(`/returns/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    remove: (id: number) => request<void>(`/returns/${id}`, { method: "DELETE" }),
  },
  documents: {
    list: () => request<DocumentRecord[]>("/documents"),
    create: (data: Pick<DocumentRecord, "type" | "relatedTo" | "status">) =>
      request<DocumentRecord>("/documents", { method: "POST", body: JSON.stringify(data) }),
  },
  stockOpname: {
    list: () => request<StockOpnameRecord[]>('/stock-opname'),
    get: (id: number) => request<StockOpnameRecord>(`/stock-opname/${id}`),
    create: (data: { conductedBy: string; notes?: string; items: Array<{ itemId: number; itemName: string; sku: string; systemStock: number; physicalStock: number }> }) =>
      request<StockOpnameRecord>('/stock-opname', { method: 'POST', body: JSON.stringify(data) }),
    confirm: (id: number) =>
      request<StockOpnameRecord>(`/stock-opname/${id}/confirm`, { method: 'PATCH' }),
    remove: (id: number) => request<void>(`/stock-opname/${id}`, { method: 'DELETE' }),
  },
  goodsReceipts: {
    list: (poId?: number) =>
      request<GoodsReceiptRecord[]>(`/goods-receipts${poId ? `?poId=${poId}` : ''}`),
    create: (data: {
      purchaseOrderId: number;
      receivedBy: string;
      invoiceNumber?: string;
      invoiceUrl?: string;
      notes?: string;
      items: Array<{
        itemName: string;
        orderedQty: number;
        receivedQty: number;
        conditionStatus: 'baik' | 'rusak' | 'expired';
        notes?: string;
      }>;
    }) => request<GoodsReceiptRecord>('/goods-receipts', { method: 'POST', body: JSON.stringify(data) }),
    confirm: (id: number) =>
      request<{ ok: true }>(`/goods-receipts/${id}/confirm`, { method: 'PATCH' }),
    remove: (id: number) => request<void>(`/goods-receipts/${id}`, { method: 'DELETE' }),
  },
  reports: {
    summary: (period: "1month" | "3months" | "6months" | "1year" = "6months") =>
      request<ReportsSummary>(`/reports/summary?period=${period}`),
  },
};
