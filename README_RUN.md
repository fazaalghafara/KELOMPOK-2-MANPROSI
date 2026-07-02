# Menjalankan SupplyTrack

## 1. Import database MySQL

Jalankan file:

```bash
mysql -u root -p < database/supply_chain_dashboard.sql
```

Atau buka phpMyAdmin/MySQL Workbench, lalu import `database/supply_chain_dashboard.sql`.

Kalau database versi lama sudah pernah di-import, import ulang file SQL ini agar tabel baru seperti `warehouse_transactions`, `purchase_orders`, dan `purchase_order_items` ikut dibuat.

## 2. Konfigurasi koneksi database

Salin `.env.example` menjadi `.env`, lalu sesuaikan user dan password MySQL:

```env
PORT=4000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=supply_chain_dashboard
```

## 3. Jalankan aplikasi

Frontend dan backend sekaligus:

```bash
npm run dev:full
```

Atau jalankan terpisah:

```bash
npm run server
npm run dev
```

Frontend: `http://localhost:5173`
Backend API: `http://localhost:4000/api`

## Akun demo

- `gudang@supplytrack.com` / `demo123`
- `logistik@supplytrack.com` / `demo123`
- `dealer@supplytrack.com` / `demo123`
- `manager@supplytrack.com` / `demo123`
