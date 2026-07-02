CREATE DATABASE IF NOT EXISTS supply_chain_dashboard;
USE supply_chain_dashboard;

DROP TABLE IF EXISTS goods_receipt_items;
DROP TABLE IF EXISTS goods_receipts;
DROP TABLE IF EXISTS stock_opname_items;
DROP TABLE IF EXISTS stock_opname;
DROP TABLE IF EXISTS documents;
DROP TABLE IF EXISTS returns;
DROP TABLE IF EXISTS warehouse_transactions;
DROP TABLE IF EXISTS sales_order_items;
DROP TABLE IF EXISTS sales_orders;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS purchase_order_items;
DROP TABLE IF EXISTS purchase_orders;
DROP TABLE IF EXISTS shipments;
DROP TABLE IF EXISTS inventory_items;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  password VARCHAR(120) NOT NULL,
  role ENUM('gudang', 'logistik', 'dealer', 'manager') NOT NULL
);

CREATE TABLE inventory_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sku VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  category VARCHAR(80) NOT NULL,
  stock INT NOT NULL DEFAULT 0,
  min_stock INT NOT NULL DEFAULT 0,
  condition_status ENUM('baik', 'rusak', 'expired') NOT NULL DEFAULT 'baik',
  rack VARCHAR(40) NOT NULL DEFAULT '',
  pallet VARCHAR(40) NOT NULL DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE shipments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tracking_number VARCHAR(60) NOT NULL UNIQUE,
  destination VARCHAR(160) NOT NULL,
  shipment_date DATE NOT NULL,
  items INT NOT NULL DEFAULT 0,
  status ENUM('pending', 'processing', 'shipped', 'delivered') NOT NULL DEFAULT 'pending',
  vehicle_plate VARCHAR(40),
  driver_name VARCHAR(120),
  origin VARCHAR(160) DEFAULT 'Jakarta Warehouse',
  estimated_delivery VARCHAR(80),
  current_location VARCHAR(160),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE purchase_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_number VARCHAR(60) NOT NULL UNIQUE,
  dealer_name VARCHAR(120) NOT NULL,
  status ENUM('pending', 'approved', 'processing', 'shipped', 'delivered', 'cancelled') NOT NULL DEFAULT 'pending',
  total_amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
  payment_status ENUM('unpaid', 'partial', 'paid') NOT NULL DEFAULT 'unpaid',
  created_at DATE NOT NULL
);

CREATE TABLE purchase_order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  purchase_order_id INT NOT NULL,
  item_name VARCHAR(160) NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  unit_price DECIMAL(14, 2) NOT NULL DEFAULT 0,
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE
);

CREATE TABLE payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  purchase_order_id INT NOT NULL,
  payment_number VARCHAR(60) NOT NULL UNIQUE,
  amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
  payment_method ENUM('transfer', 'tunai', 'cek', 'giro') NOT NULL DEFAULT 'transfer',
  payment_date DATE NOT NULL,
  proof_url VARCHAR(255),
  notes VARCHAR(255),
  created_by VARCHAR(120) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE
);

CREATE TABLE sales_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_number VARCHAR(60) NOT NULL UNIQUE,
  dealer_name VARCHAR(120) NOT NULL,
  distributor_name VARCHAR(120) NOT NULL DEFAULT 'SupplyTrack Distribution',
  status ENUM('draft', 'submitted', 'approved', 'processing', 'shipped', 'delivered', 'cancelled') NOT NULL DEFAULT 'draft',
  total_amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
  notes VARCHAR(255),
  created_at DATE NOT NULL
);

CREATE TABLE sales_order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sales_order_id INT NOT NULL,
  item_name VARCHAR(160) NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  unit_price DECIMAL(14, 2) NOT NULL DEFAULT 0,
  FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id) ON DELETE CASCADE
);

CREATE TABLE warehouse_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  transaction_type ENUM('incoming', 'outgoing') NOT NULL,
  item_id INT NOT NULL,
  item_name VARCHAR(160) NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  partner VARCHAR(120),
  notes VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
);

CREATE TABLE returns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  return_number VARCHAR(60) NOT NULL UNIQUE,
  item_name VARCHAR(160) NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  reason VARCHAR(255) NOT NULL,
  status ENUM('pending', 'approved', 'rejected', 'completed') NOT NULL DEFAULT 'pending',
  request_date DATE NOT NULL,
  requester VARCHAR(120) NOT NULL
);

CREATE TABLE documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  document_number VARCHAR(60) NOT NULL UNIQUE,
  type ENUM('po', 'so', 'surat_jalan', 'picking_list', 'retur') NOT NULL,
  related_to VARCHAR(120) NOT NULL,
  document_date DATE NOT NULL,
  status ENUM('draft', 'final') NOT NULL DEFAULT 'draft'
);

CREATE TABLE stock_opname (
  id INT AUTO_INCREMENT PRIMARY KEY,
  opname_number VARCHAR(60) NOT NULL UNIQUE,
  conducted_by VARCHAR(120) NOT NULL,
  notes VARCHAR(255),
  status ENUM('draft', 'selesai') NOT NULL DEFAULT 'selesai',
  conducted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE stock_opname_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  opname_id INT NOT NULL,
  item_id INT NOT NULL,
  item_name VARCHAR(160) NOT NULL,
  sku VARCHAR(40) NOT NULL,
  system_stock INT NOT NULL DEFAULT 0,
  physical_stock INT NOT NULL DEFAULT 0,
  difference INT GENERATED ALWAYS AS (physical_stock - system_stock) STORED,
  FOREIGN KEY (opname_id) REFERENCES stock_opname(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
);

CREATE TABLE goods_receipts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  receipt_number VARCHAR(60) NOT NULL UNIQUE,
  purchase_order_id INT NOT NULL,
  received_by VARCHAR(120) NOT NULL,
  invoice_number VARCHAR(80),
  invoice_url VARCHAR(500),
  notes VARCHAR(255),
  status ENUM('draft', 'confirmed') NOT NULL DEFAULT 'draft',
  received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE
);

CREATE TABLE goods_receipt_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  receipt_id INT NOT NULL,
  item_name VARCHAR(160) NOT NULL,
  ordered_qty INT NOT NULL DEFAULT 0,
  received_qty INT NOT NULL DEFAULT 0,
  condition_status ENUM('baik', 'rusak', 'expired') NOT NULL DEFAULT 'baik',
  notes VARCHAR(255),
  FOREIGN KEY (receipt_id) REFERENCES goods_receipts(id) ON DELETE CASCADE
);

INSERT INTO users (name, email, password, role) VALUES
('Ahmad Santoso', 'gudang@supplytrack.com', 'demo123', 'gudang'),
('Budi Prasetyo', 'logistik@supplytrack.com', 'demo123', 'logistik'),
('Citra Dewi', 'dealer@supplytrack.com', 'demo123', 'dealer'),
('Dian Kusuma', 'manager@supplytrack.com', 'demo123', 'manager');

INSERT INTO inventory_items (sku, name, category, stock, min_stock, condition_status, rack, pallet) VALUES
('SKU-001', 'Monitor LED 24"',    'Elektronik', 45,  20,  'baik',  'Rak A', 'Palet A-01'),
('SKU-002', 'Keyboard Wireless',  'Elektronik', 120, 50,  'baik',  'Rak A', 'Palet A-02'),
('SKU-003', 'Mouse Gaming',       'Elektronik', 8,   30,  'baik',  'Rak A', 'Palet A-03'),
('SKU-004', 'Webcam HD',          'Elektronik', 5,   15,  'rusak', 'Rak B', 'Palet B-01'),
('SKU-005', 'Headset Bluetooth',  'Elektronik', 67,  25,  'baik',  'Rak B', 'Palet B-02'),
('SKU-006', 'USB Hub 4 Port',     'Aksesoris',  3,   20,  'baik',  'Rak C', 'Palet C-01'),
('SKU-007', 'Power Bank 10000mAh','Aksesoris',  89,  40,  'baik',  'Rak C', 'Palet C-02'),
('SKU-008', 'Kabel USB-C',        'Kabel',      200, 100, 'baik',  'Rak D', 'Palet D-01');

INSERT INTO shipments (tracking_number, destination, shipment_date, items, status, vehicle_plate, driver_name, origin, estimated_delivery, current_location) VALUES
('SHP-2024-001', 'Dealer Jakarta Selatan', '2024-01-15', 12, 'delivered', 'B 1234 ABC', 'Rudi Hartono', 'Jakarta Warehouse', '2024-01-15 18:00', 'Dealer Jakarta Selatan'),
('SHP-2024-002', 'Dealer Surabaya Pusat', '2024-01-14', 8, 'shipped', 'B 5678 DEF', 'Agus Setiawan', 'Jakarta Warehouse', '2024-01-16 14:00', 'Semarang Rest Area'),
('SHP-2024-003', 'Dealer Bandung Utara', '2024-01-13', 15, 'processing', 'B 9012 GHI', 'Hendra Wijaya', 'Jakarta Warehouse', '2024-01-14 10:00', 'Gudang Packing'),
('SHP-2024-004', 'Dealer Medan Timur', '2024-01-12', 6, 'pending', 'B 3456 JKL', 'Eko Prasetyo', 'Jakarta Warehouse', '2024-01-18 12:00', 'Menunggu pickup'),
('SHP-2024-005', 'Dealer Makassar Barat', '2024-01-11', 20, 'delivered', 'B 7890 MNO', 'Faisal Rahman', 'Jakarta Warehouse', '2024-01-13 16:00', 'Dealer Makassar Barat'),
('SHP-2024-006', 'Dealer Semarang Tengah', '2024-01-10', 10, 'shipped', 'B 3344 QWE', 'Taufik Hidayat', 'Jakarta Warehouse', '2024-01-11 20:00', 'Cirebon');

INSERT INTO purchase_orders (order_number, dealer_name, status, total_amount, payment_status, created_at) VALUES
('PO001', 'Bandung Auto Parts', 'shipped', 8000000, 'partial', '2024-01-14'),
('PO002', 'Surabaya Motors', 'processing', 18500000, 'unpaid', '2024-01-13'),
('PO003', 'Yogya Industrial', 'delivered', 10200000, 'paid', '2024-01-12'),
('PO004', 'Semarang Parts Co', 'pending', 6750000, 'unpaid', '2024-01-15');

INSERT INTO purchase_order_items (purchase_order_id, item_name, quantity, unit_price) VALUES
(1, 'Electronic Component A', 100, 50000),
(1, 'Cable Bundle C', 200, 15000),
(2, 'Motor Assembly B', 50, 250000),
(2, 'Power Supply E', 75, 80000),
(3, 'Sensor Unit D', 25, 120000),
(3, 'Control Board F', 40, 180000),
(4, 'Hydraulic Pump G', 15, 450000);

INSERT INTO warehouse_transactions (transaction_type, item_id, item_name, quantity, partner, notes, created_at) VALUES
('incoming', 1, 'Monitor LED 24"', 120, 'Supplier Jakarta', 'Stok awal barang masuk', '2024-01-15 08:00:00'),
('incoming', 2, 'Keyboard Wireless', 80, 'Supplier Bandung', 'Restock mingguan', '2024-01-15 09:00:00'),
('outgoing', 1, 'Monitor LED 24"', 30, 'Dealer Jakarta', 'Pengiriman dealer', '2024-01-15 13:00:00'),
('outgoing', 3, 'Mouse Gaming', 12, 'Dealer Bandung', 'Pengiriman dealer', '2024-01-14 15:00:00');

INSERT INTO returns (return_number, item_name, quantity, reason, status, request_date, requester) VALUES
('RTN-001', 'Monitor LED 24"', 2, 'Barang cacat', 'pending', '2024-01-15', 'Dealer Jakarta'),
('RTN-002', 'Keyboard Wireless', 5, 'Salah kirim', 'approved', '2024-01-14', 'Dealer Surabaya'),
('RTN-003', 'Mouse Gaming', 3, 'Tidak sesuai pesanan', 'completed', '2024-01-13', 'Dealer Bandung'),
('RTN-004', 'Webcam HD', 1, 'Barang rusak', 'rejected', '2024-01-12', 'Dealer Medan'),
('RTN-005', 'Headset Bluetooth', 4, 'Expired', 'pending', '2024-01-11', 'Dealer Makassar');

INSERT INTO documents (document_number, type, related_to, document_date, status) VALUES
('PO-2024-001', 'po', 'Dealer Jakarta', '2024-01-15', 'final'),
('SJ-2024-001', 'surat_jalan', 'SHP-001', '2024-01-15', 'final'),
('PL-2024-001', 'picking_list', 'SHP-001', '2024-01-15', 'final'),
('PO-2024-002', 'po', 'Dealer Surabaya', '2024-01-14', 'draft'),
('SJ-2024-002', 'surat_jalan', 'SHP-002', '2024-01-14', 'final'),
('PL-2024-002', 'picking_list', 'SHP-002', '2024-01-14', 'draft'),
('PO-2024-003', 'po', 'Dealer Bandung', '2024-01-13', 'final'),
('SJ-2024-003', 'surat_jalan', 'SHP-003', '2024-01-13', 'final');

INSERT INTO payments (purchase_order_id, payment_number, amount, payment_method, payment_date, proof_url, notes, created_by) VALUES
(1, 'PAY-2024-001', 4000000, 'transfer', '2024-01-14', NULL, 'Pembayaran DP 50%', 'Dealer Bandung'),
(3, 'PAY-2024-002', 10200000, 'transfer', '2024-01-12', NULL, 'Pelunasan penuh', 'Dealer Yogya');

INSERT INTO sales_orders (order_number, dealer_name, distributor_name, status, total_amount, notes, created_at) VALUES
('SO-2024-001', 'Dealer Jakarta', 'SupplyTrack Distribution', 'delivered', 13500000, 'Pesanan rutin bulanan', '2024-01-15'),
('SO-2024-002', 'Dealer Surabaya', 'SupplyTrack Distribution', 'approved', 7500000, NULL, '2024-01-14'),
('SO-2024-003', 'Dealer Bandung', 'SupplyTrack Distribution', 'submitted', 4200000, 'Mohon diprioritaskan', '2024-01-13'),
('SO-2024-004', 'Dealer Medan', 'SupplyTrack Distribution', 'draft', 2800000, NULL, '2024-01-12');

INSERT INTO sales_order_items (sales_order_id, item_name, quantity, unit_price) VALUES
(1, 'Monitor LED 24"', 30, 250000),
(1, 'Keyboard Wireless', 50, 120000),
(2, 'Mouse Gaming', 25, 150000),
(2, 'Headset Bluetooth', 20, 200000),
(3, 'Webcam HD', 15, 180000),
(3, 'USB Hub 7 Port', 30, 80000),
(4, 'Laptop Stand Adjustable', 20, 140000);
