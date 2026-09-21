# SLC Platform

Portal Student Led Conference: katalog program, booking siswa dengan kapasitas tiga orang per mata pelajaran dan maksimal tiga mata pelajaran per siswa. Setelah mendaftar, siswa tidak dapat membatalkan pilihannya; pembatalan hanya dapat dilakukan oleh guru pengampu mata pelajaran tersebut. Admin juga dapat mengatur hari, jam, dan ruang mengajar; jadwal tersebut tersinkron ke dashboard guru dan siswa.

Dashboard siswa, guru, dan kepala sekolah menggunakan banner SLC yang sama. Aset banner disimpan sebagai satu JPEG terkompresi di `apps/web/public/slc-banner.jpg` agar loading tetap ringan. Identitas website (nama dan logo) dikelola dari menu Pengaturan dan ditampilkan kembali pada Homepage serta navigasi Dashboard.

Homepage menggunakan gambar Hero SLC sebagai background responsif dengan overlay biru agar teks tetap mudah dibaca pada berbagai ukuran layar. Section statistik dan kartu metode menggunakan efek emboss modern. Halaman About School juga memiliki ilustrasi komunitas belajar dalam format SVG yang ringan, sedangkan kartu statistiknya menggunakan gaya visual yang sama.

## Jalankan dengan Podman

```powershell
npm install
npm run db:up
npm run dev
```

Web tersedia di `http://localhost:5173`, API di `http://localhost:4000`.

Untuk deployment production, tetapkan `JWT_SECRET` yang panjang dan acak pada environment API. Saat development tanpa konfigurasi tersebut, API membuat secret acak setiap kali proses dimulai.

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

Semua mata pelajaran tersedia untuk setiap kelas. Database menyimpan satu program per kombinasi mata pelajaran dan kelas agar booking tetap terisolasi sesuai kelas siswa.

## Administrator

Masuk sebagai Administrator untuk membuka menu data kelas, guru, siswa, mata pelajaran, penjadwalan, dan laporan sistem. Administrator dapat membuat/menghapus akun non-admin, membuat program untuk guru dan kelas tertentu, serta mengimpor siswa dan mata pelajaran dari file `.xls` atau `.xlsx`.

### Import siswa dan template

Pada menu `Data siswa`, gunakan tombol **Unduh Template** untuk mengunduh `template-import-siswa.xlsx`. Isi satu siswa pada setiap baris, lalu gunakan tombol **Import Data Siswa** untuk memilih file tersebut atau file `.xls`/`.xlsx` lain.

Format kolom import siswa:

| nama | username | email | kelas | password |
| --- | --- | --- | --- | --- |
| Siti Aminah | siti | siti@sekolah.id | Kelas VII Ararat | demo |

Kolom `nama`, `email`, dan `kelas` wajib. Jika email sudah ada, data siswa akan diperbarui.
Kolom `username` tersedia sebagai informasi pada template; sistem membuat username dari bagian sebelum `@` pada email saat import. Jika `password` kosong, sistem menggunakan `demo`. Nilai `kelas` harus sesuai dengan kelas yang tersedia pada master data kelas.

### Import mata pelajaran dan template

Pada menu `Data mata pelajaran`, gunakan tombol **Unduh template** untuk mengunduh `template-import-mata-pelajaran.xlsx`. Isi satu mata pelajaran pada setiap baris, lalu pilih **Import mata pelajaran**.

Format kolom import mata pelajaran:

| nama_pelajaran | deskripsi | guru | kapasitas | kelas |
| --- | --- | --- | --- | --- |
| Matematika | Belajar dengan tekun dan jujur | alya | 3 | Kelas VII Ararat |

Semua kolom wajib. Kolom `guru` dapat diisi dengan nama, username, atau email guru. Nilai `kapasitas` harus berupa angka 1 sampai 3 dan `kelas` harus sesuai dengan master data kelas. Import disimpan sekaligus; jika ada baris tidak valid, tidak ada data pada file yang disimpan.

### Ringkasan dashboard

Ringkasan Admin menampilkan metrik total akun, mata pelajaran, pendaftaran, dan kelas. Daftar **Mapel dan penugasan guru** dibatasi enam item per halaman menggunakan pagination agar tetap rapi. Ringkasan Guru memprioritaskan Proposal Team, kemudian Daftar Siswa dan Kelas yang Diampu.

### Pengaturan identitas

Menu `Pengaturan` pada Admin dapat digunakan untuk mengubah nama website dan logo sekolah. Perubahan tersebut dibaca dari database dan ditampilkan pada Homepage publik serta sidebar Dashboard tanpa perlu mengubah kode sumber.

### Menu Pages

Menu `Pages` pada Admin digunakan untuk mengubah konten teks halaman publik:

- `Homepage`
- `Profil SLC`
- `About School`
- `Program`

Setiap halaman menyediakan editor untuk judul, deskripsi pembuka, judul section utama, dan isi section utama. Perubahan disimpan ke database dan langsung digunakan oleh halaman publik.

### Aset visual publik

- `apps/web/public/slc-banner.jpg`: banner Student Led Conference untuk dashboard, JPEG terkompresi sekitar 150 KB.
- `apps/web/public/slc-signal.jpg`: ilustrasi SLC untuk section pembelajaran Homepage, JPEG terkompresi sekitar 70 KB.
- `apps/web/public/about-school-illustration.svg`: ilustrasi ringan untuk section utama About School.

Gambar bitmap publik dikompres sebelum disimpan agar waktu muat tetap ringan. Background Hero menggunakan ukuran responsif agar komposisi gambar tetap terlihat ketika lebar browser berubah.

### Penjadwalan

Menu `Penjadwalan` mengatur satu jadwal mengajar untuk setiap mata pelajaran, termasuk hari, jam mulai, jam selesai, dan ruang opsional. Jadwal yang disimpan otomatis tersedia pada Jadwal Guru dan Jadwal Siswa yang telah memilih mata pelajaran tersebut.

Untuk database lama yang sudah memiliki volume, jalankan migration sekali:

```powershell
Get-Content infra/migrate.sql | podman exec -i db-clc psql -U clc_app -d clc
```
