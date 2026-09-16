# Panduan Deployment dan Restore CLC

## Persiapan

Server atau PC tujuan membutuhkan:

- Git
- Node.js 20 atau lebih baru
- npm
- Podman Desktop atau Docker dengan Compose

## Menjalankan dari source

```powershell
git clone https://github.com/juniordevs2026/web-clc.git
cd web-clc
npm.cmd install
Copy-Item apps\api\.env.example apps\api\.env
```

Isi `apps\api\.env` dengan secret production yang panjang dan acak:

```env
DATABASE_URL=postgresql://clc_app:CHANGE_THIS_PASSWORD@localhost:5432/clc
JWT_SECRET=CHANGE_THIS_TO_A_LONG_RANDOM_SECRET
PORT=4000
```

Sesuaikan password pada `infra\compose.yml` agar sama dengan password di
`DATABASE_URL`, lalu jalankan:

```powershell
npm.cmd run db:up
npm.cmd run build
npm.cmd run dev
```

Web berjalan di `http://localhost:5173` dan API di `http://localhost:4000`.
Untuk production, jalankan hasil build API dengan `npm.cmd start --workspace apps/api`
dan sajikan folder `apps\web\dist` melalui web server/reverse proxy.

## Memulihkan database dari backup

Pastikan container PostgreSQL sudah berjalan, kemudian buat database kosong dan
restore file dump:

```powershell
podman exec db-clc psql -U clc_app -d postgres -c "DROP DATABASE IF EXISTS clc;"
podman exec db-clc psql -U clc_app -d postgres -c "CREATE DATABASE clc OWNER clc_app;"
Get-Content .\clc-backup.sql | podman exec -i db-clc psql -U clc_app -d clc
```

Jika dump dibuat dalam format custom, gunakan:

```powershell
cmd /c "podman exec -i db-clc pg_restore -U clc_app -d clc --clean --if-exists < clc-backup.dump"
```

Setelah restore, pastikan API dapat membaca data:

```powershell
Invoke-RestMethod http://localhost:4000/api/health
```

## Membuat backup

Backup source sebaiknya tidak menyertakan `node_modules`, `dist`, `.git`, atau
file `.env`. Backup database berisi data akun dan harus disimpan di lokasi aman.

Contoh backup database:

```powershell
cmd /c "podman exec db-clc pg_dump -U clc_app -d clc --format=custom > clc-backup.dump"
```

Simpan arsip source dan dump database secara terpisah, dengan akses terbatas.
Setelah restore di PC/server baru, ganti `JWT_SECRET` dan kredensial database
sesuai environment tersebut.
