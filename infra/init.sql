CREATE TYPE user_role AS ENUM ('admin', 'kepala_sekolah', 'guru', 'siswa');

CREATE TABLE kelas (
  id SERIAL PRIMARY KEY,
  nama_kelas VARCHAR(40) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  nama_website VARCHAR(140) NOT NULL DEFAULT 'Character Learning Center',
  logo_sekolah TEXT,
  alamat_sekolah TEXT,
  gemini_api_key TEXT,
  tema VARCHAR(30) NOT NULL DEFAULT 'terang',
  tahun_pelajaran VARCHAR(20) NOT NULL DEFAULT '2026/2027',
  semester VARCHAR(20) NOT NULL DEFAULT 'Ganjil',
  semester_aktif BOOLEAN NOT NULL DEFAULT TRUE,
  bantuan_pendaftaran_judul VARCHAR(180) NOT NULL DEFAULT 'Bagaimana cara mendaftar?',
  bantuan_pendaftaran_deskripsi VARCHAR(500) NOT NULL DEFAULT 'Panduan singkat memilih program CLC',
  bantuan_teknis_judul VARCHAR(180) NOT NULL DEFAULT 'Butuh bantuan teknis?',
  bantuan_teknis_deskripsi VARCHAR(500) NOT NULL DEFAULT 'Hubungi admin CLC untuk dukungan',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app_settings (id) VALUES (1);

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  nama VARCHAR(120) NOT NULL,
  username VARCHAR(80) UNIQUE NOT NULL,
  email VARCHAR(180) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role user_role NOT NULL,
  kelas VARCHAR(40),
  foto_profil TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE mata_pelajaran (
  id SERIAL PRIMARY KEY,
  nama_pelajaran VARCHAR(140) NOT NULL,
  deskripsi TEXT NOT NULL,
  guru_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  kelas VARCHAR(40) NOT NULL DEFAULT 'Umum',
  kapasitas INTEGER NOT NULL DEFAULT 3 CHECK (kapasitas > 0 AND kapasitas <= 3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE booking_pelajaran (
  id SERIAL PRIMARY KEY,
  siswa_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mata_pelajaran_id INTEGER NOT NULL REFERENCES mata_pelajaran(id) ON DELETE CASCADE,
  tanggal_booking TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (siswa_id, mata_pelajaran_id)
);

CREATE TYPE proposal_status AS ENUM ('menunggu', 'disetujui', 'ditolak');

CREATE TABLE proposal_program (
  id SERIAL PRIMARY KEY,
  mata_pelajaran_id INTEGER NOT NULL REFERENCES mata_pelajaran(id) ON DELETE CASCADE,
  pengusul_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  judul VARCHAR(180) NOT NULL,
  deskripsi TEXT NOT NULL,
  status proposal_status NOT NULL DEFAULT 'menunggu',
  feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX proposal_course_idx ON proposal_program(mata_pelajaran_id);

CREATE INDEX booking_course_idx ON booking_pelajaran(mata_pelajaran_id);

CREATE TABLE jadwal_mengajar (
  id SERIAL PRIMARY KEY,
  mata_pelajaran_id INTEGER NOT NULL REFERENCES mata_pelajaran(id) ON DELETE CASCADE,
  hari VARCHAR(12) NOT NULL CHECK (hari IN ('Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu')),
  jam_mulai TIME NOT NULL,
  jam_selesai TIME NOT NULL,
  ruang VARCHAR(80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (jam_selesai > jam_mulai),
  UNIQUE (mata_pelajaran_id)
);

CREATE INDEX jadwal_mengajar_course_idx ON jadwal_mengajar(mata_pelajaran_id);

INSERT INTO kelas (nama_kelas) VALUES ('Kelas VII Ararat'), ('Kelas VII Karmel'), ('Kelas VIII Sinai'), ('Kelas VIII Moria'), ('Kelas IX Sion'), ('Kelas IX Hermon');

INSERT INTO users (nama, username, email, password, role, kelas) VALUES
  ('Nadia Prameswari', 'nadia', 'nadia@clc.local', 'demo', 'siswa', 'Kelas VII Ararat'),
  ('Raka Mahendra', 'raka', 'raka@clc.local', 'demo', 'siswa', 'Kelas VII Ararat'),
  ('Salsa Kirana', 'salsa', 'salsa@clc.local', 'demo', 'siswa', 'Kelas VII Ararat'),
  ('Dimas Arya', 'dimas', 'dimas@clc.local', 'demo', 'siswa', 'Kelas VII Karmel'),
  ('Alya Putri', 'alya', 'alya@clc.local', 'demo', 'guru', NULL),
  ('Bima Santoso', 'bima', 'bima@clc.local', 'demo', 'guru', NULL),
  ('Admin CLC', 'admin', 'admin@clc.local', 'demo', 'admin', NULL),
  ('Dr. Ratna Sari', 'ratna', 'ratna@clc.local', 'demo', 'kepala_sekolah', NULL);

INSERT INTO mata_pelajaran (nama_pelajaran, deskripsi, guru_id, kapasitas, kelas) VALUES
  ('Agama Kristen', 'Hidup dalam Kasih Kristus - Siswa diajak memahami firman Tuhan dan menerapkannya dalam kehidupan sehari-hari melalui sikap mengasihi, mengampuni, menolong, berkata benar, serta menghormati sesama.', 5, 3, 'Semua Kelas'),
  ('PKN', 'Menjadi Warga yang Bertanggung Jawab - Siswa belajar bahwa iman juga diwujudkan melalui kepedulian terhadap lingkungan, menaati aturan, menghargai perbedaan, menjaga persatuan, dan melaksanakan tanggung jawab sebagai warga sekolah dan masyarakat.', 6, 3, 'Semua Kelas'),
  ('Bahasa Indonesia', 'Berkata yang Membangun - Siswa dibimbing menggunakan bahasa yang santun, jujur, tidak menyakiti, dan mampu menyampaikan pendapat dengan penuh kasih. Kegiatan dapat berupa menulis refleksi, cerita inspiratif, atau pesan kebaikan.', 5, 3, 'Semua Kelas'),
  ('Matematika', 'Belajar dengan Tekun dan Jujur - Siswa memahami bahwa proses belajar membutuhkan ketekunan dan kesabaran. Penekanan diberikan pada kejujuran dalam mengerjakan tugas, ketelitian, serta tidak mudah menyerah ketika menghadapi kesulitan.', 6, 3, 'Semua Kelas'),
  ('IPA', 'Mengagumi Karya Tuhan melalui Sains - Siswa diajak melihat keteraturan alam sebagai sesuatu yang patut disyukuri dan dijaga. Karakter diwujudkan melalui kepedulian terhadap lingkungan dan penggunaan ilmu pengetahuan secara bertanggung jawab.', 5, 3, 'Semua Kelas'),
  ('IPS', 'Peduli kepada Sesama - Siswa memahami kehidupan masyarakat dan belajar melihat kebutuhan orang lain. Kegiatan dapat diarahkan pada kepedulian sosial, berbagi, menghargai pekerjaan orang lain, serta membangun kehidupan yang damai.', 6, 3, 'Semua Kelas'),
  ('Prakarya', 'Berkarya dengan Talenta yang Tuhan Berikan - Siswa mengembangkan kreativitas dan keterampilan sebagai bentuk syukur atas talenta yang dimiliki. Proses berkarya menekankan kerja keras, tanggung jawab, kerapian, dan tidak mudah menyerah.', 5, 3, 'Semua Kelas'),
  ('PJOK', 'Menjaga Tubuh sebagai Anugerah Tuhan - Siswa membangun kebiasaan hidup sehat, disiplin berolahraga, menjaga kebersihan, menghargai lawan, menerima kemenangan dan kekalahan dengan baik, serta mengembangkan penguasaan diri.', 6, 3, 'Semua Kelas'),
  ('Bahasa Inggris', 'Berani Berkomunikasi dan Menjadi Berkat - Siswa dilatih berkomunikasi dalam Bahasa Inggris dengan percaya diri dan santun. Kemampuan berbahasa diarahkan untuk membangun relasi positif dan menjadi sarana menyampaikan pesan yang baik kepada orang lain.', 5, 3, 'Semua Kelas'),
  ('Informatika', 'Bijak dan Bertanggung Jawab di Dunia Digital - Siswa belajar menggunakan teknologi secara positif, menjaga privasi, menghormati karya orang lain, menghindari penyebaran informasi yang tidak benar, serta menggunakan media digital untuk belajar dan berkarya.', 6, 3, 'Semua Kelas'),
  ('Bahasa Mandarin', 'Belajar Bahasa, Menghargai Sesama - Siswa belajar bahasa dan budaya dengan sikap terbuka serta menghargai perbedaan. Ketekunan dalam mempelajari bahasa menjadi latihan untuk bersabar, rendah hati, dan mampu membangun hubungan dengan orang dari latar belakang yang berbeda.', 5, 3, 'Semua Kelas');

INSERT INTO mata_pelajaran (nama_pelajaran, deskripsi, guru_id, kapasitas, kelas)
SELECT mp.nama_pelajaran, mp.deskripsi, mp.guru_id, mp.kapasitas, k.nama_kelas
FROM mata_pelajaran mp
CROSS JOIN kelas k
WHERE mp.kelas = 'Semua Kelas';
DELETE FROM mata_pelajaran WHERE kelas = 'Semua Kelas';

INSERT INTO booking_pelajaran (siswa_id, mata_pelajaran_id)
SELECT u.id, mp.id
FROM users u
JOIN mata_pelajaran mp ON mp.nama_pelajaran = 'Agama Kristen' AND mp.kelas = u.kelas
WHERE u.username IN ('nadia', 'raka', 'salsa');
INSERT INTO booking_pelajaran (siswa_id, mata_pelajaran_id)
SELECT u.id, mp.id
FROM users u
JOIN mata_pelajaran mp ON mp.nama_pelajaran = 'PKN' AND mp.kelas = u.kelas
WHERE u.username IN ('nadia', 'raka');
