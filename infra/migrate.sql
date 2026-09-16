CREATE TABLE IF NOT EXISTS kelas (
	id SERIAL PRIMARY KEY,
	nama_kelas VARCHAR(40) UNIQUE NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS app_settings (
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
INSERT INTO app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS bantuan_pendaftaran_judul VARCHAR(180) NOT NULL DEFAULT 'Bagaimana cara mendaftar?';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS bantuan_pendaftaran_deskripsi VARCHAR(500) NOT NULL DEFAULT 'Panduan singkat memilih program CLC';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS bantuan_teknis_judul VARCHAR(180) NOT NULL DEFAULT 'Butuh bantuan teknis?';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS bantuan_teknis_deskripsi VARCHAR(500) NOT NULL DEFAULT 'Hubungi admin CLC untuk dukungan';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS page_content JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE TABLE IF NOT EXISTS jadwal_mengajar (
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
CREATE INDEX IF NOT EXISTS jadwal_mengajar_course_idx ON jadwal_mengajar(mata_pelajaran_id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS kelas VARCHAR(40);
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(80);
ALTER TABLE users ADD COLUMN IF NOT EXISTS foto_profil TEXT;
UPDATE users SET username = split_part(email, '@', 1) WHERE username IS NULL OR username = '';
CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users(username);
ALTER TABLE users ALTER COLUMN username SET NOT NULL;
ALTER TABLE mata_pelajaran ADD COLUMN IF NOT EXISTS kelas VARCHAR(40) NOT NULL DEFAULT 'Umum';
UPDATE mata_pelajaran SET kapasitas = 3 WHERE kapasitas > 3;
DO $$ BEGIN
	ALTER TABLE mata_pelajaran ADD CONSTRAINT mata_pelajaran_kapasitas_maksimal CHECK (kapasitas > 0 AND kapasitas <= 3);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
UPDATE users SET kelas = 'Kelas VII Ararat' WHERE email IN ('nadia@clc.local', 'raka@clc.local', 'salsa@clc.local');
UPDATE users SET kelas = 'Kelas VII Karmel' WHERE email = 'dimas@clc.local';
CREATE TEMP TABLE _mata_pelajaran_seed AS
SELECT DISTINCT ON (nama_pelajaran) nama_pelajaran, deskripsi, guru_id, kapasitas
FROM mata_pelajaran
ORDER BY nama_pelajaran, id;
DELETE FROM mata_pelajaran;
DELETE FROM kelas;
INSERT INTO kelas (nama_kelas) VALUES ('Kelas VII Ararat'), ('Kelas VII Karmel'), ('Kelas VIII Sinai'), ('Kelas VIII Moria'), ('Kelas IX Sion'), ('Kelas IX Hermon');
INSERT INTO mata_pelajaran (nama_pelajaran, deskripsi, guru_id, kapasitas, kelas)
SELECT mp.nama_pelajaran, mp.deskripsi, mp.guru_id, mp.kapasitas, k.nama_kelas
FROM _mata_pelajaran_seed mp
CROSS JOIN kelas k;
DROP TABLE _mata_pelajaran_seed;
INSERT INTO booking_pelajaran (siswa_id, mata_pelajaran_id)
SELECT v.siswa_id, mp.id FROM (VALUES (1, 'Agama Kristen'), (2, 'Agama Kristen'), (3, 'Agama Kristen'), (1, 'PKN'), (2, 'PKN')) AS v(siswa_id, nama_pelajaran)
JOIN users u ON u.id = v.siswa_id
JOIN mata_pelajaran mp ON mp.nama_pelajaran = v.nama_pelajaran AND mp.kelas = u.kelas;
DO $$ BEGIN
	CREATE TYPE proposal_status AS ENUM ('menunggu', 'disetujui', 'ditolak');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE TABLE IF NOT EXISTS proposal_program (
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
CREATE INDEX IF NOT EXISTS proposal_course_idx ON proposal_program(mata_pelajaran_id);