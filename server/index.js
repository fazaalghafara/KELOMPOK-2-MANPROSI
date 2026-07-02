import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import mysql from "mysql2/promise";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(cors({ origin: process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(",") : true }));
app.use(express.json());

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "supply_chain_dashboard",
  waitForConnections: true,
  connectionLimit: 10,
});

const asyncHandler = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    next(error);
  }
};

const inventorySelect = `
  SELECT id, sku, name, category, stock, min_stock AS minStock, condition_status AS \`condition\`, rack, pallet
  FROM inventory_items
`;

async function getInventoryItem(id, connection = pool) {
  const [rows] = await connection.execute(`${inventorySelect} WHERE id = ?`, [id]);
  return rows[0];
}

async function getPurchaseOrders() {
  const [rows] = await pool.query(
    `SELECT po.id, po.order_number AS orderNumber, po.dealer_name AS dealerName, po.status,
            po.total_amount AS totalAmount, po.payment_status AS paymentStatus, po.created_at AS createdAt,
            poi.item_name AS itemName, poi.quantity, poi.unit_price AS unitPrice
     FROM purchase_orders po
     LEFT JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
     ORDER BY po.created_at DESC, po.id DESC, poi.id ASC`,
  );

  const orders = new Map();
  for (const row of rows) {
    if (!orders.has(row.id)) {
      orders.set(row.id, {
        id: row.id,
        orderNumber: row.orderNumber,
        dealerName: row.dealerName,
        status: row.status,
        totalAmount: Number(row.totalAmount || 0),
        paymentStatus: row.paymentStatus,
        createdAt: row.createdAt,
        items: [],
      });
    }

    if (row.itemName) {
      orders.get(row.id).items.push({
        name: row.itemName,
        quantity: Number(row.quantity || 0),
        unitPrice: Number(row.unitPrice || 0),
      });
    }
  }

  return Array.from(orders.values());
}

app.get("/api/health", asyncHandler(async (_req, res) => {
  await pool.query("SELECT 1");
  res.json({ ok: true });
}));

app.post("/api/auth/login", asyncHandler(async (req, res) => {
  const { email, password, role } = req.body;
  const [rows] = await pool.execute(
    "SELECT id, name, email, role FROM users WHERE email = ? AND password = ? AND (? IS NULL OR role = ?) LIMIT 1",
    [email, password, role || null, role || null],
  );

  if (!rows.length) {
    return res.status(401).json({ message: "Email, password, atau role tidak valid" });
  }

  res.json(rows[0]);
}));

app.get("/api/inventory", asyncHandler(async (_req, res) => {
  const [rows] = await pool.query(`${inventorySelect} ORDER BY id DESC`);
  res.json(rows);
}));

app.post("/api/inventory", asyncHandler(async (req, res) => {
  const { sku, name, category, stock, minStock, condition, rack, pallet } = req.body;
  const [result] = await pool.execute(
    `INSERT INTO inventory_items (sku, name, category, stock, min_stock, condition_status, rack, pallet)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [sku, name, category, Number(stock || 0), Number(minStock || 0), condition || "baik", rack || "", pallet || ""],
  );
  res.status(201).json(await getInventoryItem(result.insertId));
}));

app.put("/api/inventory/:id", asyncHandler(async (req, res) => {
  const { sku, name, category, stock, minStock, condition, rack, pallet } = req.body;
  await pool.execute(
    `UPDATE inventory_items
     SET sku = ?, name = ?, category = ?, stock = ?, min_stock = ?, condition_status = ?, rack = ?, pallet = ?
     WHERE id = ?`,
    [sku, name, category, Number(stock || 0), Number(minStock || 0), condition || "baik", rack || "", pallet || "", req.params.id],
  );
  res.json(await getInventoryItem(req.params.id));
}));

app.delete("/api/inventory/:id", asyncHandler(async (req, res) => {
  // Bug #4 fix: hanya gudang dan manager yang boleh hapus
  // (sementara pakai header x-user-role; akan diganti JWT saat Bug #2 dikerjakan)
  const role = req.headers["x-user-role"];
  if (role !== "gudang" && role !== "manager") {
    return res.status(403).json({ message: "Akses ditolak: hanya gudang atau manager yang dapat menghapus item." });
  }
  await pool.execute("DELETE FROM inventory_items WHERE id = ?", [req.params.id]);
  res.status(204).end();
}));

app.get("/api/shipments", asyncHandler(async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT id, tracking_number AS trackingNumber, destination, shipment_date AS date, items, status,
            vehicle_plate AS vehiclePlate, driver_name AS driverName, origin,
            estimated_delivery AS estimatedDelivery, current_location AS currentLocation
     FROM shipments
     ORDER BY shipment_date DESC, id DESC`,
  );
  res.json(rows);
}));

app.post("/api/shipments", asyncHandler(async (req, res) => {
  const { trackingNumber, destination, date, items, status, vehiclePlate, driverName, origin, estimatedDelivery, currentLocation } = req.body;
  const [result] = await pool.execute(
    `INSERT INTO shipments (tracking_number, destination, shipment_date, items, status, vehicle_plate, driver_name, origin, estimated_delivery, current_location)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      trackingNumber,
      destination,
      date,
      Number(items || 0),
      status || "pending",
      vehiclePlate || null,
      driverName || null,
      origin || "Jakarta Warehouse",
      estimatedDelivery || null,
      currentLocation || null,
    ],
  );
  const [rows] = await pool.execute(
    `SELECT id, tracking_number AS trackingNumber, destination, shipment_date AS date, items, status,
            vehicle_plate AS vehiclePlate, driver_name AS driverName, origin,
            estimated_delivery AS estimatedDelivery, current_location AS currentLocation
     FROM shipments WHERE id = ?`,
    [result.insertId],
  );
  res.status(201).json(rows[0]);
}));

app.patch("/api/shipments/:id/status", asyncHandler(async (req, res) => {
  await pool.execute(
    "UPDATE shipments SET status = ?, current_location = COALESCE(?, current_location) WHERE id = ?",
    [req.body.status, req.body.currentLocation || null, req.params.id],
  );
  res.json({ ok: true });
}));

app.get("/api/purchase-orders", asyncHandler(async (_req, res) => {
  res.json(await getPurchaseOrders());
}));

app.post("/api/purchase-orders", asyncHandler(async (req, res) => {
  const { dealerName, items } = req.body;
  const orderItems = Array.isArray(items) && items.length ? items : [];
  if (!dealerName || !orderItems.length) {
    return res.status(400).json({ message: "Dealer dan minimal satu barang wajib diisi" });
  }

  const totalAmount = orderItems.reduce(
    (sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0),
    0,
  );
  const orderNumber = `PO-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const [orderResult] = await connection.execute(
      `INSERT INTO purchase_orders (order_number, dealer_name, status, total_amount, payment_status, created_at)
       VALUES (?, ?, 'pending', ?, 'unpaid', CURDATE())`,
      [orderNumber, dealerName, totalAmount],
    );

    for (const item of orderItems) {
      await connection.execute(
        `INSERT INTO purchase_order_items (purchase_order_id, item_name, quantity, unit_price)
         VALUES (?, ?, ?, ?)`,
        [orderResult.insertId, item.name, Number(item.quantity || 0), Number(item.unitPrice || 0)],
      );
    }

    await connection.execute(
      `INSERT INTO documents (document_number, type, related_to, document_date, status)
       VALUES (?, 'po', ?, CURDATE(), 'draft')`,
      [`DOC-${orderNumber}`, dealerName],
    );

    await connection.commit();
    const orders = await getPurchaseOrders();
    res.status(201).json(orders.find((order) => order.id === orderResult.insertId));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

app.patch("/api/purchase-orders/:id/status", asyncHandler(async (req, res) => {
  await pool.execute("UPDATE purchase_orders SET status = ? WHERE id = ?", [req.body.status, req.params.id]);
  res.json({ ok: true });
}));

app.patch("/api/purchase-orders/:id/payment", asyncHandler(async (req, res) => {
  await pool.execute("UPDATE purchase_orders SET payment_status = ? WHERE id = ?", [req.body.paymentStatus, req.params.id]);
  res.json({ ok: true });
}));

app.get("/api/warehouse/transactions", asyncHandler(async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT id, transaction_type AS type, item_id AS itemId, item_name AS itemName, quantity,
            partner, notes, created_at AS timestamp
     FROM warehouse_transactions
     ORDER BY created_at DESC, id DESC
     LIMIT 50`,
  );
  res.json(rows);
}));

app.post("/api/warehouse/transactions", asyncHandler(async (req, res) => {
  const { type, itemId, quantity, partner, notes } = req.body;
  const qty = Number(quantity || 0);

  if (!["incoming", "outgoing"].includes(type) || !itemId || qty <= 0) {
    return res.status(400).json({ message: "Tipe transaksi, barang, dan quantity wajib valid" });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [items] = await connection.execute("SELECT id, name, stock FROM inventory_items WHERE id = ? FOR UPDATE", [itemId]);
    if (!items.length) {
      await connection.rollback();
      return res.status(404).json({ message: "Barang tidak ditemukan" });
    }

    const item = items[0];
    const nextStock = type === "incoming" ? Number(item.stock) + qty : Number(item.stock) - qty;
    if (nextStock < 0) {
      await connection.rollback();
      return res.status(400).json({ message: "Stok tidak cukup untuk barang keluar" });
    }

    await connection.execute("UPDATE inventory_items SET stock = ? WHERE id = ?", [nextStock, itemId]);
    const [transactionResult] = await connection.execute(
      `INSERT INTO warehouse_transactions (transaction_type, item_id, item_name, quantity, partner, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [type, itemId, item.name, qty, partner || null, notes || null],
    );
    await connection.commit();

    const [transactionRows] = await pool.execute(
      `SELECT id, transaction_type AS type, item_id AS itemId, item_name AS itemName, quantity,
              partner, notes, created_at AS timestamp
       FROM warehouse_transactions WHERE id = ?`,
      [transactionResult.insertId],
    );

    res.status(201).json({
      item: await getInventoryItem(itemId),
      transaction: transactionRows[0],
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

app.delete("/api/shipments/:id", asyncHandler(async (req, res) => {
  await pool.execute("DELETE FROM shipments WHERE id = ?", [req.params.id]);
  res.status(204).end();
}));

app.get("/api/returns", asyncHandler(async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT id, return_number AS returnNumber, item_name AS itemName, quantity, reason, status,
            request_date AS requestDate, requester
     FROM returns
     ORDER BY request_date DESC, id DESC`,
  );
  res.json(rows);
}));

app.post("/api/returns", asyncHandler(async (req, res) => {
  const { itemName, quantity, reason, requester } = req.body;
  const returnNumber = `RTN-${Date.now().toString().slice(-6)}`;
  const [result] = await pool.execute(
    `INSERT INTO returns (return_number, item_name, quantity, reason, status, request_date, requester)
     VALUES (?, ?, ?, ?, 'pending', CURDATE(), ?)`,
    [returnNumber, itemName, Number(quantity || 0), reason, requester || "Dealer"],
  );
  const [rows] = await pool.execute(
    `SELECT id, return_number AS returnNumber, item_name AS itemName, quantity, reason, status,
            request_date AS requestDate, requester
     FROM returns WHERE id = ?`,
    [result.insertId],
  );
  res.status(201).json(rows[0]);
}));

app.patch("/api/returns/:id/status", asyncHandler(async (req, res) => {
  await pool.execute("UPDATE returns SET status = ? WHERE id = ?", [req.body.status, req.params.id]);
  res.json({ ok: true });
}));

app.delete("/api/returns/:id", asyncHandler(async (req, res) => {
  await pool.execute("DELETE FROM returns WHERE id = ?", [req.params.id]);
  res.status(204).end();
}));

// ── Sales Orders ──────────────────────────────────────────────
async function getSalesOrders() {
  const [rows] = await pool.query(
    `SELECT so.id, so.order_number AS orderNumber, so.dealer_name AS dealerName,
            so.distributor_name AS distributorName, so.status,
            so.total_amount AS totalAmount, so.notes, so.created_at AS createdAt,
            soi.item_name AS itemName, soi.quantity, soi.unit_price AS unitPrice
     FROM sales_orders so
     LEFT JOIN sales_order_items soi ON soi.sales_order_id = so.id
     ORDER BY so.created_at DESC, so.id DESC, soi.id ASC`,
  );

  const orders = new Map();
  for (const row of rows) {
    if (!orders.has(row.id)) {
      orders.set(row.id, {
        id: row.id,
        orderNumber: row.orderNumber,
        dealerName: row.dealerName,
        distributorName: row.distributorName,
        status: row.status,
        totalAmount: Number(row.totalAmount || 0),
        notes: row.notes || null,
        createdAt: row.createdAt,
        items: [],
      });
    }
    if (row.itemName) {
      orders.get(row.id).items.push({
        name: row.itemName,
        quantity: Number(row.quantity || 0),
        unitPrice: Number(row.unitPrice || 0),
      });
    }
  }
  return Array.from(orders.values());
}

app.get("/api/sales-orders", asyncHandler(async (_req, res) => {
  res.json(await getSalesOrders());
}));

app.post("/api/sales-orders", asyncHandler(async (req, res) => {
  const { dealerName, distributorName, items, notes } = req.body;
  const orderItems = Array.isArray(items) && items.length ? items : [];
  if (!dealerName || !orderItems.length) {
    return res.status(400).json({ message: "Dealer dan minimal satu barang wajib diisi" });
  }

  const totalAmount = orderItems.reduce(
    (sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0),
    0,
  );
  const orderNumber = `SO-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const [orderResult] = await connection.execute(
      `INSERT INTO sales_orders (order_number, dealer_name, distributor_name, status, total_amount, notes, created_at)
       VALUES (?, ?, ?, 'draft', ?, ?, CURDATE())`,
      [orderNumber, dealerName, distributorName || "SupplyTrack Distribution", totalAmount, notes || null],
    );

    for (const item of orderItems) {
      await connection.execute(
        `INSERT INTO sales_order_items (sales_order_id, item_name, quantity, unit_price)
         VALUES (?, ?, ?, ?)`,
        [orderResult.insertId, item.name, Number(item.quantity || 0), Number(item.unitPrice || 0)],
      );
    }

    await connection.execute(
      `INSERT INTO documents (document_number, type, related_to, document_date, status)
       VALUES (?, 'so', ?, CURDATE(), 'draft')`,
      [`DOC-${orderNumber}`, dealerName],
    );

    await connection.commit();
    const orders = await getSalesOrders();
    res.status(201).json(orders.find((o) => o.id === orderResult.insertId));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

app.patch("/api/sales-orders/:id/status", asyncHandler(async (req, res) => {
  const { status } = req.body;
  const allowed = ['draft', 'submitted', 'approved', 'processing', 'shipped', 'delivered', 'cancelled'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ message: "Status tidak valid" });
  }
  await pool.execute("UPDATE sales_orders SET status = ? WHERE id = ?", [status, req.params.id]);
  res.json({ ok: true });
}));

app.delete("/api/sales-orders/:id", asyncHandler(async (req, res) => {
  const [[order]] = await pool.execute("SELECT status FROM sales_orders WHERE id = ?", [req.params.id]);
  if (!order) return res.status(404).json({ message: "Sales order tidak ditemukan" });
  if (!['draft', 'cancelled'].includes(order.status)) {
    return res.status(400).json({ message: "Hanya SO berstatus draft atau cancelled yang dapat dihapus" });
  }
  await pool.execute("DELETE FROM sales_orders WHERE id = ?", [req.params.id]);
  res.status(204).end();
}));

app.get("/api/documents", asyncHandler(async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT id, document_number AS number, type, related_to AS relatedTo, document_date AS date, status
     FROM documents
     ORDER BY document_date DESC, id DESC`,
  );
  res.json(rows);
}));

app.post("/api/documents", asyncHandler(async (req, res) => {
  const { type, relatedTo, status } = req.body;
  const prefixes = { po: "PO", surat_jalan: "SJ", picking_list: "PL", retur: "RT" };
  if (!prefixes[type] || !relatedTo) {
    return res.status(400).json({ message: "Tipe dokumen dan referensi wajib diisi" });
  }

  const documentNumber = `${prefixes[type]}-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
  const [result] = await pool.execute(
    `INSERT INTO documents (document_number, type, related_to, document_date, status)
     VALUES (?, ?, ?, CURDATE(), ?)`,
    [documentNumber, type, relatedTo, status || "final"],
  );
  const [rows] = await pool.execute(
    `SELECT id, document_number AS number, type, related_to AS relatedTo, document_date AS date, status
     FROM documents WHERE id = ?`,
    [result.insertId],
  );
  res.status(201).json(rows[0]);
}));

const PERIOD_MONTHS = { "1month": 1, "3months": 3, "6months": 6, "1year": 12 };

function monthBuckets(count) {
  const now = new Date();
  const buckets = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, month: d.toLocaleString("id-ID", { month: "short" }) });
  }
  return buckets;
}

app.get("/api/reports/summary", asyncHandler(async (req, res) => {
  const months = PERIOD_MONTHS[req.query.period] || 6;
  const buckets = monthBuckets(months);
  const startDate = new Date(new Date().getFullYear(), new Date().getMonth() - (months - 1), 1);
  const prevStartDate = new Date(new Date().getFullYear(), new Date().getMonth() - (months * 2 - 1), 1);

  const [transactionRows] = await pool.query(
    `SELECT transaction_type AS type, quantity, created_at AS createdAt
     FROM warehouse_transactions WHERE created_at >= ?`,
    [prevStartDate],
  );
  const [returnRows] = await pool.query(
    `SELECT quantity, request_date AS requestDate FROM returns WHERE request_date >= ?`,
    [prevStartDate],
  );
  const [orderRows] = await pool.query(
    `SELECT dealer_name AS dealerName, status, total_amount AS totalAmount, created_at AS createdAt
     FROM purchase_orders WHERE created_at >= ?`,
    [prevStartDate],
  );
  const [shipmentRows] = await pool.query(
    `SELECT status, shipment_date AS shipmentDate FROM shipments WHERE shipment_date >= ?`,
    [prevStartDate],
  );
  const [categoryRows] = await pool.query(
    `SELECT category, SUM(stock) AS totalStock FROM inventory_items GROUP BY category ORDER BY totalStock DESC`,
  );

  const keyOf = (date) => {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };
  const isCurrentPeriod = (date) => new Date(date) >= startDate;

  const monthlyMap = new Map(buckets.map((b) => [b.key, { month: b.month, masuk: 0, keluar: 0, retur: 0 }]));
  transactionRows.forEach((row) => {
    const bucket = monthlyMap.get(keyOf(row.createdAt));
    if (!bucket) return;
    if (row.type === "incoming") bucket.masuk += Number(row.quantity);
    else bucket.keluar += Number(row.quantity);
  });
  returnRows.forEach((row) => {
    const bucket = monthlyMap.get(keyOf(row.requestDate));
    if (bucket) bucket.retur += Number(row.quantity);
  });
  const monthlyMovement = Array.from(monthlyMap.values());

  const shipmentMap = new Map(buckets.map((b) => [b.key, { month: b.month, total: 0, onTimeCount: 0 }]));
  shipmentRows.forEach((row) => {
    const bucket = shipmentMap.get(keyOf(row.shipmentDate));
    if (!bucket) return;
    bucket.total += 1;
    if (row.status === "delivered") bucket.onTimeCount += 1;
  });
  const shipmentPerformance = Array.from(shipmentMap.values()).map((b) => ({
    month: b.month,
    onTime: b.total ? Math.round((b.onTimeCount / b.total) * 100) : 0,
    delayed: b.total ? 100 - Math.round((b.onTimeCount / b.total) * 100) : 0,
  }));

  const totalStock = categoryRows.reduce((sum, row) => sum + Number(row.totalStock || 0), 0);
  const categoryDistribution = categoryRows.map((row) => ({
    name: row.category,
    value: totalStock ? Math.round((Number(row.totalStock) / totalStock) * 1000) / 10 : 0,
  }));

  const sumWhere = (rows, dateField, qtyField, predicate) =>
    rows.filter((row) => (predicate ? predicate(row) : true) && isCurrentPeriod(row[dateField]))
      .reduce((sum, row) => sum + Number(row[qtyField] || 0), 0);
  const sumPrevWhere = (rows, dateField, qtyField, predicate) =>
    rows.filter((row) => (predicate ? predicate(row) : true) && !isCurrentPeriod(row[dateField]))
      .reduce((sum, row) => sum + Number(row[qtyField] || 0), 0);

  const growthPct = (current, previous) => {
    if (!previous) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 1000) / 10;
  };

  const totalIncoming = sumWhere(transactionRows, "createdAt", "quantity", (r) => r.type === "incoming");
  const prevIncoming = sumPrevWhere(transactionRows, "createdAt", "quantity", (r) => r.type === "incoming");
  const totalOutgoing = sumWhere(transactionRows, "createdAt", "quantity", (r) => r.type === "outgoing");
  const prevOutgoing = sumPrevWhere(transactionRows, "createdAt", "quantity", (r) => r.type === "outgoing");
  const totalReturns = sumWhere(returnRows, "requestDate", "quantity");
  const prevReturns = sumPrevWhere(returnRows, "requestDate", "quantity");
  const totalRevenue = sumWhere(orderRows, "createdAt", "totalAmount");
  const prevRevenue = sumPrevWhere(orderRows, "createdAt", "totalAmount");

  res.json({
    summary: {
      totalIncoming,
      totalOutgoing,
      totalReturns,
      totalRevenue,
      incomingGrowth: growthPct(totalIncoming, prevIncoming),
      outgoingGrowth: growthPct(totalOutgoing, prevOutgoing),
      returnsGrowth: growthPct(totalReturns, prevReturns),
      revenueGrowth: growthPct(totalRevenue, prevRevenue),
    },
    monthlyMovement,
    shipmentPerformance,
    categoryDistribution,
  });
}));

// ── Stock Opname ──────────────────────────────────────────────
app.get("/api/stock-opname", asyncHandler(async (_req, res) => {
  const [opnames] = await pool.query(
    `SELECT so.id, so.opname_number AS opnameNumber, so.conducted_by AS conductedBy,
            so.notes, so.status, so.conducted_at AS conductedAt,
            COUNT(soi.id) AS totalItems,
            SUM(ABS(soi.difference)) AS totalDifference
     FROM stock_opname so
     LEFT JOIN stock_opname_items soi ON soi.opname_id = so.id
     GROUP BY so.id
     ORDER BY so.conducted_at DESC`
  );
  res.json(opnames);
}));

app.get("/api/stock-opname/:id", asyncHandler(async (req, res) => {
  const [[opname]] = await pool.execute(
    `SELECT id, opname_number AS opnameNumber, conducted_by AS conductedBy,
            notes, status, conducted_at AS conductedAt
     FROM stock_opname WHERE id = ?`,
    [req.params.id]
  );
  if (!opname) return res.status(404).json({ message: "Stock opname tidak ditemukan" });

  const [items] = await pool.execute(
    `SELECT id, item_id AS itemId, item_name AS itemName, sku,
            system_stock AS systemStock, physical_stock AS physicalStock, difference
     FROM stock_opname_items WHERE opname_id = ?`,
    [req.params.id]
  );
  res.json({ ...opname, items });
}));

app.post("/api/stock-opname", asyncHandler(async (req, res) => {
  const { conductedBy, notes, items } = req.body;
  if (!conductedBy || !Array.isArray(items) || !items.length) {
    return res.status(400).json({ message: "Petugas dan minimal satu barang wajib diisi" });
  }

  const opnameNumber = `OPN-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [opnameResult] = await connection.execute(
      `INSERT INTO stock_opname (opname_number, conducted_by, notes, status) VALUES (?, ?, ?, 'draft')`,
      [opnameNumber, conductedBy, notes || null]
    );
    const opnameId = opnameResult.insertId;

    for (const item of items) {
      const { itemId, itemName, sku, systemStock, physicalStock } = item;
      await connection.execute(
        `INSERT INTO stock_opname_items (opname_id, item_id, item_name, sku, system_stock, physical_stock)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [opnameId, itemId, itemName, sku, Number(systemStock), Number(physicalStock)]
      );
      // Belum disinkronisasi — stok sistem hanya diupdate setelah opname dikonfirmasi
    }

    await connection.commit();

    const [[created]] = await pool.execute(
      `SELECT id, opname_number AS opnameNumber, conducted_by AS conductedBy,
              notes, status, conducted_at AS conductedAt
       FROM stock_opname WHERE id = ?`,
      [opnameId]
    );
    const [createdItems] = await pool.execute(
      `SELECT id, item_id AS itemId, item_name AS itemName, sku,
              system_stock AS systemStock, physical_stock AS physicalStock, difference
       FROM stock_opname_items WHERE opname_id = ?`,
      [opnameId]
    );
    res.status(201).json({ ...created, items: createdItems });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

app.patch("/api/stock-opname/:id/confirm", asyncHandler(async (req, res) => {
  const [[opname]] = await pool.execute(
    `SELECT id, status FROM stock_opname WHERE id = ?`,
    [req.params.id]
  );
  if (!opname) return res.status(404).json({ message: "Stock opname tidak ditemukan" });
  if (opname.status === "selesai") {
    return res.status(400).json({ message: "Stock opname ini sudah diselesaikan" });
  }

  const [items] = await pool.execute(
    `SELECT item_id AS itemId, physical_stock AS physicalStock FROM stock_opname_items WHERE opname_id = ?`,
    [req.params.id]
  );

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    for (const item of items) {
      await connection.execute(
        `UPDATE inventory_items SET stock = ? WHERE id = ?`,
        [Number(item.physicalStock), item.itemId]
      );
    }

    await connection.execute(
      `UPDATE stock_opname SET status = 'selesai' WHERE id = ?`,
      [req.params.id]
    );

    await connection.commit();

    const [[updated]] = await pool.execute(
      `SELECT id, opname_number AS opnameNumber, conducted_by AS conductedBy,
              notes, status, conducted_at AS conductedAt
       FROM stock_opname WHERE id = ?`,
      [req.params.id]
    );
    res.json(updated);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

app.delete("/api/stock-opname/:id", asyncHandler(async (req, res) => {
  const [[opname]] = await pool.execute(
    `SELECT status FROM stock_opname WHERE id = ?`,
    [req.params.id]
  );
  if (!opname) return res.status(404).json({ message: "Stock opname tidak ditemukan" });
  if (opname.status === "selesai") {
    return res.status(400).json({ message: "Stock opname yang sudah diselesaikan tidak bisa dihapus" });
  }
  await pool.execute(`DELETE FROM stock_opname WHERE id = ?`, [req.params.id]);
  res.status(204).end();
}));

// ── Inventory item transaction history (WBS 1.12) ────────────
app.get("/api/inventory/:id/transactions", asyncHandler(async (req, res) => {
  const itemId = Number(req.params.id);
  const [[item]] = await pool.execute(
    `${inventorySelect} WHERE id = ?`,
    [itemId]
  );
  if (!item) return res.status(404).json({ message: "Barang tidak ditemukan" });

  const [transactions] = await pool.execute(
    `SELECT id, transaction_type AS type, quantity, partner, notes, created_at AS timestamp
     FROM warehouse_transactions
     WHERE item_id = ?
     ORDER BY created_at DESC, id DESC
     LIMIT 100`,
    [itemId]
  );

  // Hitung ringkasan: total masuk, total keluar, dan pergerakan stok per bulan
  const [summary] = await pool.execute(
    `SELECT
       SUM(CASE WHEN transaction_type = 'incoming' THEN quantity ELSE 0 END) AS totalIncoming,
       SUM(CASE WHEN transaction_type = 'outgoing' THEN quantity ELSE 0 END) AS totalOutgoing,
       COUNT(*) AS totalTransactions
     FROM warehouse_transactions
     WHERE item_id = ?`,
    [itemId]
  );

  res.json({
    item,
    transactions,
    summary: {
      totalIncoming: Number(summary[0].totalIncoming || 0),
      totalOutgoing: Number(summary[0].totalOutgoing || 0),
      totalTransactions: Number(summary[0].totalTransactions || 0),
    },
  });
}));


async function getGoodsReceipts(poId) {
  const whereClause = poId ? `WHERE gr.purchase_order_id = ?` : '';
  const params = poId ? [poId] : [];
  const [rows] = await pool.query(
    `SELECT gr.id, gr.receipt_number AS receiptNumber, gr.purchase_order_id AS purchaseOrderId,
            po.order_number AS poNumber, po.dealer_name AS dealerName,
            gr.received_by AS receivedBy, gr.invoice_number AS invoiceNumber, gr.invoice_url AS invoiceUrl,
            gr.notes, gr.status, gr.received_at AS receivedAt,
            gri.id AS itemId, gri.item_name AS itemName, gri.ordered_qty AS orderedQty,
            gri.received_qty AS receivedQty, gri.condition_status AS conditionStatus,
            gri.notes AS itemNotes
     FROM goods_receipts gr
     JOIN purchase_orders po ON po.id = gr.purchase_order_id
     LEFT JOIN goods_receipt_items gri ON gri.receipt_id = gr.id
     ${whereClause}
     ORDER BY gr.received_at DESC, gr.id DESC, gri.id ASC`,
    params
  );

  const receipts = new Map();
  for (const row of rows) {
    if (!receipts.has(row.id)) {
      receipts.set(row.id, {
        id: row.id,
        receiptNumber: row.receiptNumber,
        purchaseOrderId: row.purchaseOrderId,
        poNumber: row.poNumber,
        dealerName: row.dealerName,
        receivedBy: row.receivedBy,
        invoiceNumber: row.invoiceNumber || null,
        invoiceUrl: row.invoiceUrl || null,
        notes: row.notes || null,
        status: row.status,
        receivedAt: row.receivedAt,
        items: [],
      });
    }
    if (row.itemId) {
      receipts.get(row.id).items.push({
        id: row.itemId,
        itemName: row.itemName,
        orderedQty: Number(row.orderedQty),
        receivedQty: Number(row.receivedQty),
        conditionStatus: row.conditionStatus,
        notes: row.itemNotes || null,
      });
    }
  }
  return Array.from(receipts.values());
}

app.get('/api/goods-receipts', asyncHandler(async (req, res) => {
  const poId = req.query.poId ? Number(req.query.poId) : null;
  res.json(await getGoodsReceipts(poId));
}));

app.post('/api/goods-receipts', asyncHandler(async (req, res) => {
  const { purchaseOrderId, receivedBy, invoiceNumber, invoiceUrl, notes, items } = req.body;
  if (!purchaseOrderId || !receivedBy || !Array.isArray(items) || !items.length) {
    return res.status(400).json({ message: 'PO, penerima, dan minimal satu barang wajib diisi' });
  }

  const [[po]] = await pool.execute('SELECT id, status FROM purchase_orders WHERE id = ?', [purchaseOrderId]);
  if (!po) return res.status(404).json({ message: 'Purchase Order tidak ditemukan' });

  const receiptNumber = `GR-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute(
      `INSERT INTO goods_receipts (receipt_number, purchase_order_id, received_by, invoice_number, invoice_url, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, 'draft')`,
      [receiptNumber, purchaseOrderId, receivedBy, invoiceNumber || null, invoiceUrl || null, notes || null]
    );
    const receiptId = result.insertId;

    for (const item of items) {
      await connection.execute(
        `INSERT INTO goods_receipt_items (receipt_id, item_name, ordered_qty, received_qty, condition_status, notes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [receiptId, item.itemName, Number(item.orderedQty || 0), Number(item.receivedQty || 0),
         item.conditionStatus || 'baik', item.notes || null]
      );
    }
    await connection.commit();
    const receipts = await getGoodsReceipts(null);
    res.status(201).json(receipts.find(r => r.id === receiptId));
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}));

app.patch('/api/goods-receipts/:id/confirm', asyncHandler(async (req, res) => {
  const [[receipt]] = await pool.execute(
    'SELECT id, status, purchase_order_id AS poId FROM goods_receipts WHERE id = ?',
    [req.params.id]
  );
  if (!receipt) return res.status(404).json({ message: 'Goods receipt tidak ditemukan' });
  if (receipt.status === 'confirmed') return res.status(400).json({ message: 'Sudah dikonfirmasi' });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute("UPDATE goods_receipts SET status = 'confirmed' WHERE id = ?", [req.params.id]);
    await connection.execute("UPDATE purchase_orders SET status = 'delivered' WHERE id = ?", [receipt.poId]);
    await connection.commit();
    res.json({ ok: true });
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}));

app.delete('/api/goods-receipts/:id', asyncHandler(async (req, res) => {
  const [[receipt]] = await pool.execute('SELECT status FROM goods_receipts WHERE id = ?', [req.params.id]);
  if (!receipt) return res.status(404).json({ message: 'Goods receipt tidak ditemukan' });
  if (receipt.status === 'confirmed') return res.status(400).json({ message: 'Receipt yang sudah dikonfirmasi tidak bisa dihapus' });
  await pool.execute('DELETE FROM goods_receipts WHERE id = ?', [req.params.id]);
  res.status(204).end();
}));

// ─── WBS 1.13: Payment Endpoints ──────────────────────────────────────────────

// GET semua payment untuk satu PO
app.get('/api/purchase-orders/:id/payments', asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT id, purchase_order_id AS purchaseOrderId, payment_number AS paymentNumber,
            amount, payment_method AS paymentMethod, payment_date AS paymentDate,
            proof_url AS proofUrl, notes, created_by AS createdBy,
            created_at AS createdAt
     FROM payments
     WHERE purchase_order_id = ?
     ORDER BY created_at DESC`,
    [req.params.id]
  );
  res.json(rows);
}));

// POST buat payment baru untuk sebuah PO
app.post('/api/purchase-orders/:id/payments', asyncHandler(async (req, res) => {
  const poId = Number(req.params.id);
  const { amount, paymentMethod, paymentDate, proofUrl, notes, createdBy } = req.body;

  if (!amount || !paymentMethod || !paymentDate || !createdBy) {
    return res.status(400).json({ message: 'amount, paymentMethod, paymentDate, dan createdBy wajib diisi' });
  }

  // Ambil PO untuk cek total dan hitung total yang sudah dibayar
  const [[po]] = await pool.execute(
    'SELECT total_amount AS totalAmount, payment_status AS paymentStatus FROM purchase_orders WHERE id = ?',
    [poId]
  );
  if (!po) return res.status(404).json({ message: 'Purchase Order tidak ditemukan' });

  const [[{ paidSoFar }]] = await pool.execute(
    'SELECT COALESCE(SUM(amount), 0) AS paidSoFar FROM payments WHERE purchase_order_id = ?',
    [poId]
  );

  const newTotal = Number(paidSoFar) + Number(amount);
  if (newTotal > Number(po.totalAmount)) {
    return res.status(400).json({
      message: `Total pembayaran (${newTotal.toLocaleString('id-ID')}) melebihi total PO (${Number(po.totalAmount).toLocaleString('id-ID')})`
    });
  }

  // Generate payment number
  const [[{ cnt }]] = await pool.execute('SELECT COUNT(*) AS cnt FROM payments');
  const paymentNumber = `PAY-${new Date().getFullYear()}-${String(Number(cnt) + 1).padStart(3, '0')}`;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute(
      `INSERT INTO payments (purchase_order_id, payment_number, amount, payment_method, payment_date, proof_url, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [poId, paymentNumber, amount, paymentMethod, paymentDate, proofUrl || null, notes || null, createdBy]
    );

    // Update payment_status di purchase_orders
    let newStatus = 'partial';
    if (newTotal >= Number(po.totalAmount)) newStatus = 'paid';

    await connection.execute(
      'UPDATE purchase_orders SET payment_status = ? WHERE id = ?',
      [newStatus, poId]
    );

    await connection.commit();

    // Return payment yang baru dibuat + status PO terbaru
    const [[created]] = await connection.execute(
      `SELECT id, purchase_order_id AS purchaseOrderId, payment_number AS paymentNumber,
              amount, payment_method AS paymentMethod, payment_date AS paymentDate,
              proof_url AS proofUrl, notes, created_by AS createdBy, created_at AS createdAt
       FROM payments WHERE payment_number = ?`,
      [paymentNumber]
    );
    res.status(201).json({ payment: created, paymentStatus: newStatus, totalPaid: newTotal });
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}));

// DELETE payment (hanya jika PO belum lunas)
app.delete('/api/purchase-orders/:id/payments/:paymentId', asyncHandler(async (req, res) => {
  const [[payment]] = await pool.execute(
    'SELECT id, amount, purchase_order_id AS poId FROM payments WHERE id = ? AND purchase_order_id = ?',
    [req.params.paymentId, req.params.id]
  );
  if (!payment) return res.status(404).json({ message: 'Payment tidak ditemukan' });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute('DELETE FROM payments WHERE id = ?', [payment.id]);

    // Recalculate payment status
    const [[{ remaining }]] = await connection.execute(
      'SELECT COALESCE(SUM(amount), 0) AS remaining FROM payments WHERE purchase_order_id = ?',
      [req.params.id]
    );
    const [[{ totalAmount }]] = await connection.execute(
      'SELECT total_amount AS totalAmount FROM purchase_orders WHERE id = ?',
      [req.params.id]
    );

    let newStatus = 'unpaid';
    if (Number(remaining) >= Number(totalAmount)) newStatus = 'paid';
    else if (Number(remaining) > 0) newStatus = 'partial';

    await connection.execute(
      'UPDATE purchase_orders SET payment_status = ? WHERE id = ?',
      [newStatus, req.params.id]
    );

    await connection.commit();
    res.json({ ok: true, paymentStatus: newStatus, totalPaid: Number(remaining) });
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}));

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: "Server error", detail: error.message });
});

app.listen(port, () => {
  console.log(`API server running at http://localhost:${port}`);
});
