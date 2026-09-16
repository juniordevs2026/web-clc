# CLC Platform

Portal Character Learning Center: katalog program, booking siswa dengan kapasitas tiga orang per mata pelajaran dan maksimal tiga mata pelajaran per siswa. Siswa dapat membatalkan salah satu pendaftaran untuk menggantinya dengan mata pelajaran lain selama kuota tersedia, tanpa mengubah batas Team. Admin juga dapat mengatur hari, jam, dan ruang mengajar; jadwal tersebut tersinkron ke dashboard guru dan siswa.

Dashboard siswa, guru, dan kepala sekolah menggunakan banner karakter CLC yang sama. Aset banner disimpan dalam format JPEG terkompresi di `apps/web/public/student-hero.jpg` agar loading tetap ringan. Identitas website (nama dan logo) dikelola dari menu Pengaturan dan ditampilkan kembali pada Homepage serta navigasi Dashboard.

## Jalankan dengan Podman

```powershell
npm install
npm run db:up
npm run dev
```

Web tersedia di `http://localhost:5173`, API di `http://localhost:4000`.

Akun demo ditanam di `infra/init.sql`. Login menggunakan username dan password `demo`:
- Siswa: `nadia` / `demo`
- Guru: `alya` / `demo`
- Kepala sekolah: `ratna` / `demo`
- Admin: `admin` / `demo`

Database memakai container `db-clc`. Untuk mengulang seed dari nol, jalankan `npm run db:down`, hapus volume `clc_pgdata`, lalu `npm run db:up`.

Master data kelas bawaan terdiri dari:

- Kelas VII Ararat
- Kelas VII Karmel
- Kelas VIII Sinai
- Kelas VIII Moria
- Kelas IX Sion
- Kelas IX Hermon

Setiap kelas memiliki mata pelajaran sendiri dan siswa hanya melihat mata pelajaran yang sesuai dengan kelasnya.

## Administrator

Masuk sebagai Administrator untuk membuka menu data kelas, guru, siswa, mata pelajaran, penjadwalan, dan laporan sistem. Administrator dapat membuat/menghapus akun non-admin, membuat program untuk guru dan kelas tertentu, serta mengimpor siswa dari file `.xls` atau `.xlsx`.

### Import siswa dan template

Pada menu `Data siswa`, gunakan tombol **Unduh Template** untuk mengunduh `template-import-siswa.xlsx`. Isi satu siswa pada setiap baris, lalu gunakan tombol **Import Data Siswa** untuk memilih file tersebut atau file `.xls`/`.xlsx` lain.

Format kolom import siswa:

| nama | username | email | kelas | password |
| --- | --- | --- | --- | --- |
| Siti Aminah | siti | siti@sekolah.id | Kelas VII Ararat | demo |

Kolom `nama`, `email`, dan `kelas` wajib. Jika email sudah ada, data siswa akan diperbarui.
Kolom `username` tersedia sebagai informasi pada template; sistem membuat username dari bagian sebelum `@` pada email saat import. Jika `password` kosong, sistem menggunakan `demo`. Nilai `kelas` harus sesuai dengan kelas yang tersedia pada master data kelas.

### Ringkasan dashboard

Ringkasan Admin menampilkan metrik total akun, mata pelajaran, pendaftaran, dan kelas. Daftar **Mapel dan penugasan guru** dibatasi enam item per halaman menggunakan pagination agar tetap rapi. Ringkasan Guru memprioritaskan Proposal Team, kemudian Daftar Siswa dan Kelas yang Diampu.

### Pengaturan identitas

Menu `Pengaturan` pada Admin dapat digunakan untuk mengubah nama website dan logo sekolah. Perubahan tersebut dibaca dari database dan ditampilkan pada Homepage publik serta sidebar Dashboard tanpa perlu mengubah kode sumber.

### Penjadwalan

Menu `Penjadwalan` mengatur satu jadwal mengajar untuk setiap mata pelajaran, termasuk hari, jam mulai, jam selesai, dan ruang opsional. Jadwal yang disimpan otomatis tersedia pada Jadwal Guru dan Jadwal Siswa yang telah memilih mata pelajaran tersebut.

Untuk database lama yang sudah memiliki volume, jalankan migration sekali:

```powershell
Get-Content infra/migrate.sql | podman exec -i db-clc psql -U clc_app -d clc
```
