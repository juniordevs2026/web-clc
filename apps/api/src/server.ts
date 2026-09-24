import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { pool } from './db.js';

const app = express();
app.use(cors());
app.use(express.json());

const asyncRoute = (handler: express.RequestHandler): express.RequestHandler => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};
const JWT_SECRET = process.env.JWT_SECRET ?? (process.env.NODE_ENV === 'production'
  ? (() => { throw new Error('JWT_SECRET wajib dikonfigurasi di production.'); })()
  : randomBytes(32).toString('hex'));
type AuthRequest = express.Request & { user?: { id: number; role: string } };
const requireAuth = (roles?: string[]): express.RequestHandler => (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ message: 'Sesi login diperlukan.' });
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as { id: number; role: string };
    if (roles && !roles.includes(payload.role)) return res.status(403).json({ message: 'Akses ditolak untuk role ini.' });
    (req as AuthRequest).user = payload;
    next();
  } catch { res.status(401).json({ message: 'Sesi login tidak valid atau sudah kedaluwarsa.' }); }
};
const requireAdmin = requireAuth(['admin']);

app.get('/api/health', asyncRoute(async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true, service: 'clc-api' });
}));

app.get('/api/public-settings', asyncRoute(async (_req, res) => {
  const { rows } = await pool.query('SELECT nama_website, logo_sekolah, page_content FROM app_settings WHERE id = 1');
  res.json(rows[0] ?? { nama_website: 'Student Lead Conference', logo_sekolah: null });
}));

app.get('/api/pages', requireAdmin, asyncRoute(async (_req, res) => {
  const { rows } = await pool.query('SELECT page_content FROM app_settings WHERE id = 1');
  res.json(rows[0]?.page_content ?? {});
}));

app.put('/api/pages', requireAdmin, asyncRoute(async (req, res) => {
  const pageSchema = z.object({ title: z.string().min(1).max(180), intro: z.string().min(1).max(600), sectionTitle: z.string().min(1).max(180), sectionText: z.string().min(1).max(1000) });
  const input = z.object({ home: pageSchema, profil: pageSchema, sekolah: pageSchema, program: pageSchema }).parse(req.body);
  await pool.query('UPDATE app_settings SET page_content = $1::jsonb, updated_at = NOW() WHERE id = 1', [JSON.stringify(input)]);
  res.json({ saved: true, pages: input });
}));

app.get('/api/settings', requireAuth(), asyncRoute(async (_req, res) => {
  const { rows } = await pool.query(`SELECT id, nama_website, logo_sekolah, alamat_sekolah, (gemini_api_key IS NOT NULL AND gemini_api_key <> '') AS gemini_terkonfigurasi, tema, tahun_pelajaran, semester, semester_aktif, TO_CHAR(booking_dibuka_at AT TIME ZONE 'Asia/Jayapura', 'YYYY-MM-DD"T"HH24:MI') AS booking_dibuka_at, TO_CHAR(booking_ditutup_at AT TIME ZONE 'Asia/Jayapura', 'YYYY-MM-DD"T"HH24:MI') AS booking_ditutup_at, bantuan_pendaftaran_judul, bantuan_pendaftaran_deskripsi, bantuan_teknis_judul, bantuan_teknis_deskripsi, updated_at FROM app_settings WHERE id = 1`);
  res.json(rows[0]);
}));
app.post('/api/login', asyncRoute(async (req, res) => {
  const input = z.object({ username: z.string().min(1), password: z.string().min(1) }).parse(req.body);
  const { rows } = await pool.query('SELECT id, nama, username, password, role, kelas, foto_profil FROM users WHERE username = $1', [input.username]);
  if (!rows.length) return res.status(401).json({ message: 'Username atau password salah.' });
  const validPassword = (await bcrypt.compare(input.password, rows[0].password)) || rows[0].password === input.password;
  if (!validPassword) return res.status(401).json({ message: 'Username atau password salah.' });
  if (rows[0].password === input.password) await pool.query('UPDATE users SET password = $1 WHERE id = $2', [await bcrypt.hash(input.password, 12), rows[0].id]);
  delete rows[0].password;
  const user = rows[0];
  const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ user, token });
}));

app.get('/api/profile/:id', requireAuth(), asyncRoute(async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const auth = (req as AuthRequest).user;
  if (auth?.id !== id && auth?.role !== 'admin') return res.status(403).json({ message: 'Kamu hanya dapat melihat profil sendiri.' });
  const { rows } = await pool.query('SELECT id, nama, username, email, role, kelas, foto_profil FROM users WHERE id = $1', [id]);
  if (!rows.length) return res.status(404).json({ message: 'Profil tidak ditemukan.' });
  res.json(rows[0]);
}));

app.put('/api/profile/:id', requireAuth(), asyncRoute(async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const auth = (req as AuthRequest).user;
  if (auth?.id !== id && auth?.role !== 'admin') return res.status(403).json({ message: 'Kamu hanya dapat mengubah profil sendiri.' });
  const input = z.object({ nama: z.string().min(2).max(120), fotoProfil: z.string().max(2_000_000).nullable().optional(), passwordLama: z.string().optional(), passwordBaru: z.string().min(6).optional() }).parse(req.body);
  const current = await pool.query('SELECT password FROM users WHERE id = $1', [id]);
  if (!current.rowCount) return res.status(404).json({ message: 'Profil tidak ditemukan.' });
  if (input.passwordBaru && !(await bcrypt.compare(input.passwordLama ?? '', current.rows[0].password)) && current.rows[0].password !== input.passwordLama) return res.status(401).json({ message: 'Password lama tidak sesuai.' });
  if (input.passwordBaru) await pool.query('UPDATE users SET nama = $1, foto_profil = $2, password = $3 WHERE id = $4', [input.nama, input.fotoProfil ?? null, await bcrypt.hash(input.passwordBaru, 12), id]);
  else await pool.query('UPDATE users SET nama = $1, foto_profil = $2 WHERE id = $3', [input.nama, input.fotoProfil ?? null, id]);
  const { rows } = await pool.query('SELECT id, nama, username, email, role, kelas, foto_profil FROM users WHERE id = $1', [id]);
  res.json(rows[0]);
}));

app.put('/api/settings', requireAdmin, asyncRoute(async (req, res) => {
  const input = z.object({ namaWebsite: z.string().min(1).max(140), logoSekolah: z.string().max(2_000_000).nullable().optional(), alamatSekolah: z.string().max(500), geminiApiKey: z.string().max(500).optional(), tema: z.enum(['terang', 'gelap', 'otomatis']), tahunPelajaran: z.string().min(4).max(20), semester: z.enum(['Ganjil', 'Genap']), semesterAktif: z.boolean(), bookingDibukaAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).nullable().default(null), bookingDitutupAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).nullable().default(null), bantuanPendaftaranJudul: z.string().min(1).max(180), bantuanPendaftaranDeskripsi: z.string().min(1).max(500), bantuanTeknisJudul: z.string().min(1).max(180), bantuanTeknisDeskripsi: z.string().min(1).max(500) }).superRefine((value, context) => {
    if (value.bookingDibukaAt && value.bookingDitutupAt && value.bookingDitutupAt <= value.bookingDibukaAt) context.addIssue({ code: z.ZodIssueCode.custom, path: ['bookingDitutupAt'], message: 'Waktu tutup harus setelah waktu buka.' });
  }).parse(req.body);
  const values = [input.namaWebsite, input.logoSekolah ?? null, input.alamatSekolah, input.tema, input.tahunPelajaran, input.semester, input.semesterAktif, input.bookingDibukaAt, input.bookingDitutupAt, input.bantuanPendaftaranJudul, input.bantuanPendaftaranDeskripsi, input.bantuanTeknisJudul, input.bantuanTeknisDeskripsi];
  const bookingFields = `booking_dibuka_at = CASE WHEN $8::text IS NULL THEN NULL ELSE $8::timestamp AT TIME ZONE 'Asia/Jayapura' END, booking_ditutup_at = CASE WHEN $9::text IS NULL THEN NULL ELSE $9::timestamp AT TIME ZONE 'Asia/Jayapura' END`;
  const query = input.geminiApiKey ? `UPDATE app_settings SET nama_website = $1, logo_sekolah = $2, alamat_sekolah = $3, tema = $4, tahun_pelajaran = $5, semester = $6, semester_aktif = $7, ${bookingFields}, bantuan_pendaftaran_judul = $10, bantuan_pendaftaran_deskripsi = $11, bantuan_teknis_judul = $12, bantuan_teknis_deskripsi = $13, gemini_api_key = $14, updated_at = NOW() WHERE id = 1` : `UPDATE app_settings SET nama_website = $1, logo_sekolah = $2, alamat_sekolah = $3, tema = $4, tahun_pelajaran = $5, semester = $6, semester_aktif = $7, ${bookingFields}, bantuan_pendaftaran_judul = $10, bantuan_pendaftaran_deskripsi = $11, bantuan_teknis_judul = $12, bantuan_teknis_deskripsi = $13, updated_at = NOW() WHERE id = 1`;
  await pool.query(query, input.geminiApiKey ? [...values, input.geminiApiKey] : values);
  res.json({ saved: true });
}));

app.get('/api/classes', requireAuth(), asyncRoute(async (_req, res) => {
  const { rows } = await pool.query(`SELECT k.id, k.nama_kelas, COUNT(DISTINCT u.id)::int AS jumlah_siswa, COUNT(DISTINCT mp.id)::int AS jumlah_program FROM kelas k LEFT JOIN users u ON u.kelas = k.nama_kelas AND u.role = 'siswa' LEFT JOIN mata_pelajaran mp ON mp.kelas = k.nama_kelas GROUP BY k.id ORDER BY k.nama_kelas`);
  res.json(rows);
}));

app.post('/api/classes', requireAdmin, asyncRoute(async (req, res) => {
  const input = z.object({ namaKelas: z.string().min(1).max(40) }).parse(req.body);
  const { rows } = await pool.query('INSERT INTO kelas (nama_kelas) VALUES ($1) RETURNING id, nama_kelas', [input.namaKelas]);
  res.status(201).json(rows[0]);
}));

app.put('/api/classes/:id', requireAdmin, asyncRoute(async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const input = z.object({ namaKelas: z.string().min(1).max(40) }).parse(req.body);
  const result = await pool.query('UPDATE kelas SET nama_kelas = $1 WHERE id = $2 RETURNING id, nama_kelas', [input.namaKelas, id]);
  if (!result.rowCount) return res.status(404).json({ message: 'Kelas tidak ditemukan.' });
  res.json(result.rows[0]);
}));

app.delete('/api/classes/:id', requireAdmin, asyncRoute(async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const result = await pool.query('DELETE FROM kelas WHERE id = $1 RETURNING id', [id]);
  if (!result.rowCount) return res.status(404).json({ message: 'Kelas tidak ditemukan.' });
  res.status(204).send();
}));

app.get('/api/courses', requireAuth(), asyncRoute(async (_req, res) => {
  const auth = (_req as AuthRequest).user;
  const requestedClass = typeof _req.query.kelas === 'string' ? _req.query.kelas : null;
  const studentClass = auth?.role === 'siswa'
    ? (await pool.query('SELECT kelas FROM users WHERE id = $1 AND role = $2', [auth.id, 'siswa'])).rows[0]?.kelas ?? '__NO_CLASS__'
    : requestedClass;
  const { rows } = await pool.query(`
    SELECT mp.id, mp.nama_pelajaran, mp.deskripsi, mp.kapasitas, mp.kelas, mp.guru_id, u.nama AS guru,
      COUNT(bp.id)::int AS terdaftar,
      TO_CHAR(s.booking_dibuka_at AT TIME ZONE 'Asia/Jayapura', 'YYYY-MM-DD"T"HH24:MI') AS booking_dibuka_at,
      TO_CHAR(s.booking_ditutup_at AT TIME ZONE 'Asia/Jayapura', 'YYYY-MM-DD"T"HH24:MI') AS booking_ditutup_at
    FROM mata_pelajaran mp
    LEFT JOIN users u ON u.id = mp.guru_id
    LEFT JOIN booking_pelajaran bp ON bp.mata_pelajaran_id = mp.id
    LEFT JOIN users ub ON ub.id = bp.siswa_id
    CROSS JOIN app_settings s
    WHERE ($1::text IS NULL OR mp.kelas = $1)
    GROUP BY mp.id, u.nama, s.booking_dibuka_at, s.booking_ditutup_at ORDER BY mp.id
  `, [studentClass]);
  res.json(rows);
}));

app.get('/api/users', requireAdmin, asyncRoute(async (req, res) => {
  const role = typeof req.query.role === 'string' ? req.query.role : null;
  const { rows } = await pool.query(`SELECT id, nama, username, email, role, kelas, created_at FROM users WHERE ($1::text IS NULL OR role::text = $1) ORDER BY nama`, [role]);
  res.json(rows);
}));

app.get('/api/users/:id', requireAuth(), asyncRoute(async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const auth = (req as AuthRequest).user;
  if (auth?.id !== id && auth?.role !== 'admin') return res.status(403).json({ message: 'Kamu hanya dapat melihat data pengguna sendiri.' });
  const { rows } = await pool.query('SELECT id, nama, username, email, role, kelas FROM users WHERE id = $1', [id]);
  if (!rows.length) return res.status(404).json({ message: 'Pengguna tidak ditemukan.' });
  res.json(rows[0]);
}));

app.post('/api/users', requireAdmin, asyncRoute(async (req, res) => {
  const input = z.object({ nama: z.string().min(2), username: z.string().min(3).max(80).optional(), email: z.string().email(), password: z.string().min(4).default('demo'), role: z.enum(['admin', 'kepala_sekolah', 'guru', 'siswa']), kelas: z.string().max(40).optional().nullable() }).parse(req.body);
  if (input.kelas) {
    const classExists = await pool.query('SELECT 1 FROM kelas WHERE nama_kelas = $1', [input.kelas]);
    if (!classExists.rowCount) return res.status(400).json({ message: 'Kelas harus dipilih dari data kelas yang tersedia.' });
  }
  const username = input.username ?? input.email.split('@')[0];
  const { rows } = await pool.query('INSERT INTO users (nama, username, email, password, role, kelas) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, nama, username, email, role, kelas', [input.nama, username, input.email, await bcrypt.hash(input.password, 12), input.role, input.kelas ?? null]);
  res.status(201).json(rows[0]);
}));

app.put('/api/users/:id', requireAdmin, asyncRoute(async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const input = z.object({ nama: z.string().min(2), username: z.string().min(3).max(80), email: z.string().email(), role: z.enum(['admin', 'kepala_sekolah', 'guru', 'siswa']), kelas: z.string().max(40).nullable(), password: z.string().min(4).optional() }).parse(req.body);
  if (input.kelas) {
    const classExists = await pool.query('SELECT 1 FROM kelas WHERE nama_kelas = $1', [input.kelas]);
    if (!classExists.rowCount) return res.status(400).json({ message: 'Kelas harus dipilih dari data kelas yang tersedia.' });
  }
  const password = input.password ? await bcrypt.hash(input.password, 12) : null;
  const result = await pool.query('UPDATE users SET nama = $1, username = $2, email = $3, role = $4, kelas = $5, password = COALESCE($6, password) WHERE id = $7 RETURNING id, nama, username, email, role, kelas', [input.nama, input.username, input.email, input.role, input.kelas, password, id]);
  if (!result.rowCount) return res.status(404).json({ message: 'Pengguna tidak ditemukan.' });
  res.json(result.rows[0]);
}));

app.delete('/api/users/:id', requireAdmin, asyncRoute(async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const result = await pool.query("DELETE FROM users WHERE id = $1 AND role <> 'admin' RETURNING id", [id]);
  if (!result.rowCount) return res.status(404).json({ message: 'Akun tidak ditemukan atau akun administrator tidak dapat dihapus.' });
  res.status(204).send();
}));

app.post('/api/courses', requireAdmin, asyncRoute(async (req, res) => {
  const input = z.object({ namaPelajaran: z.string().min(2), deskripsi: z.string().min(5), guruId: z.number().int().positive(), kapasitas: z.number().int().positive().default(3), kelas: z.string().min(1).max(40) }).parse(req.body);
  const classExists = await pool.query('SELECT 1 FROM kelas WHERE nama_kelas = $1', [input.kelas]);
  if (!classExists.rowCount) return res.status(400).json({ message: 'Kelas mata pelajaran harus dipilih dari data kelas yang tersedia.' });
  const { rows } = await pool.query('INSERT INTO mata_pelajaran (nama_pelajaran, deskripsi, guru_id, kapasitas, kelas) VALUES ($1, $2, $3, $4, $5) RETURNING id, nama_pelajaran, deskripsi, kapasitas, kelas', [input.namaPelajaran, input.deskripsi, input.guruId, input.kapasitas, input.kelas]);
  res.status(201).json(rows[0]);
}));

app.post('/api/courses/import', requireAdmin, asyncRoute(async (req, res) => {
  const input = z.object({
    mataPelajaran: z.array(z.object({
      namaPelajaran: z.string().trim().min(2).max(140),
      deskripsi: z.string().trim().min(5),
      guru: z.string().trim().min(1).max(180),
      kapasitas: z.coerce.number().int().positive().default(3),
      kelas: z.string().trim().min(1).max(40),
    })).min(1),
  }).parse(req.body);

  const resolved = [];
  for (let index = 0; index < input.mataPelajaran.length; index += 1) {
    const item = input.mataPelajaran[index];
    const classExists = await pool.query('SELECT 1 FROM kelas WHERE nama_kelas = $1', [item.kelas]);
    if (!classExists.rowCount) return res.status(400).json({ message: `Baris ${index + 2}: kelas "${item.kelas}" tidak ditemukan.` });
    const teacher = await pool.query(
      `SELECT id, nama FROM users
       WHERE role = 'guru' AND (username = $1 OR email = $1 OR nama = $1)
       LIMIT 1`,
      [item.guru],
    );
    if (!teacher.rowCount) return res.status(400).json({ message: `Baris ${index + 2}: guru "${item.guru}" tidak ditemukan. Gunakan nama, username, atau email guru.` });
    resolved.push({ ...item, guruId: teacher.rows[0].id, guruNama: teacher.rows[0].nama });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const imported = [];
    for (const item of resolved) {
      const result = await client.query(
        `INSERT INTO mata_pelajaran (nama_pelajaran, deskripsi, guru_id, kapasitas, kelas)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, nama_pelajaran, deskripsi, guru_id, kapasitas, kelas`,
        [item.namaPelajaran, item.deskripsi, item.guruId, item.kapasitas, item.kelas],
      );
      imported.push({ ...result.rows[0], guru: item.guruNama, terdaftar: 0 });
    }
    await client.query('COMMIT');
    res.status(201).json({ imported: imported.length, mataPelajaran: imported });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

app.put('/api/courses/:id', requireAdmin, asyncRoute(async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const input = z.object({ namaPelajaran: z.string().trim().min(2).max(140), deskripsi: z.string().trim().min(5), guruId: z.coerce.number().int().positive(), kapasitas: z.coerce.number().int().positive(), kelas: z.string().trim().min(1).max(40) }).parse(req.body);
  const classExists = await pool.query('SELECT 1 FROM kelas WHERE nama_kelas = $1', [input.kelas]);
  if (!classExists.rowCount) return res.status(400).json({ message: 'Kelas mata pelajaran harus dipilih dari data kelas yang tersedia.' });
  const result = await pool.query('UPDATE mata_pelajaran SET nama_pelajaran = $1, deskripsi = $2, guru_id = $3, kapasitas = $4, kelas = $5 WHERE id = $6 RETURNING id, nama_pelajaran, deskripsi, guru_id, kapasitas, kelas', [input.namaPelajaran, input.deskripsi, input.guruId, input.kapasitas, input.kelas, id]);
  if (!result.rowCount) return res.status(404).json({ message: 'Mata pelajaran tidak ditemukan.' });
  res.json(result.rows[0]);
}));

app.delete('/api/courses/:id', requireAdmin, asyncRoute(async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const result = await pool.query('DELETE FROM mata_pelajaran WHERE id = $1 RETURNING id', [id]);
  if (!result.rowCount) return res.status(404).json({ message: 'Mata pelajaran tidak ditemukan.' });
  res.status(204).send();
}));

const scheduleInput = z.object({ mataPelajaranId: z.number().int().positive(), hari: z.enum(['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']), jamMulai: z.string().regex(/^\d{2}:\d{2}$/), jamSelesai: z.string().regex(/^\d{2}:\d{2}$/), ruang: z.string().max(80).optional().nullable() });
app.get('/api/schedules', requireAdmin, asyncRoute(async (_req, res) => {
  const { rows } = await pool.query(`SELECT jm.id, jm.mata_pelajaran_id, jm.hari, TO_CHAR(jm.jam_mulai, 'HH24:MI') AS jam_mulai, TO_CHAR(jm.jam_selesai, 'HH24:MI') AS jam_selesai, jm.ruang, mp.nama_pelajaran, mp.kelas, u.nama AS guru FROM jadwal_mengajar jm JOIN mata_pelajaran mp ON mp.id = jm.mata_pelajaran_id LEFT JOIN users u ON u.id = mp.guru_id ORDER BY CASE jm.hari WHEN 'Senin' THEN 1 WHEN 'Selasa' THEN 2 WHEN 'Rabu' THEN 3 WHEN 'Kamis' THEN 4 WHEN 'Jumat' THEN 5 ELSE 6 END, jm.jam_mulai`);
  res.json(rows);
}));
app.post('/api/schedules', requireAdmin, asyncRoute(async (req, res) => {
  const input = scheduleInput.parse(req.body);
  const { rows } = await pool.query(`INSERT INTO jadwal_mengajar (mata_pelajaran_id, hari, jam_mulai, jam_selesai, ruang) VALUES ($1, $2, $3, $4, $5) RETURNING id, mata_pelajaran_id, hari, TO_CHAR(jam_mulai, 'HH24:MI') AS jam_mulai, TO_CHAR(jam_selesai, 'HH24:MI') AS jam_selesai, ruang`, [input.mataPelajaranId, input.hari, input.jamMulai, input.jamSelesai, input.ruang ?? null]);
  res.status(201).json(rows[0]);
}));
app.put('/api/schedules/:id', requireAdmin, asyncRoute(async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const input = scheduleInput.parse(req.body);
  const { rows } = await pool.query(`UPDATE jadwal_mengajar SET mata_pelajaran_id = $1, hari = $2, jam_mulai = $3, jam_selesai = $4, ruang = $5 WHERE id = $6 RETURNING id, mata_pelajaran_id, hari, TO_CHAR(jam_mulai, 'HH24:MI') AS jam_mulai, TO_CHAR(jam_selesai, 'HH24:MI') AS jam_selesai, ruang`, [input.mataPelajaranId, input.hari, input.jamMulai, input.jamSelesai, input.ruang ?? null, id]);
  if (!rows.length) return res.status(404).json({ message: 'Jadwal tidak ditemukan.' });
  res.json(rows[0]);
}));
app.delete('/api/schedules/:id', requireAdmin, asyncRoute(async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const result = await pool.query('DELETE FROM jadwal_mengajar WHERE id = $1 RETURNING id', [id]);
  if (!result.rowCount) return res.status(404).json({ message: 'Jadwal tidak ditemukan.' });
  res.status(204).send();
}));

app.post('/api/users/import', requireAdmin, asyncRoute(async (req, res) => {
  const input = z.object({ siswa: z.array(z.object({ nama: z.string().min(2), email: z.string().email(), kelas: z.string().min(1).max(40), password: z.string().min(4).optional() })).min(1) }).parse(req.body);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const siswa of input.siswa) {
      await client.query("INSERT INTO users (nama, username, email, password, role, kelas) VALUES ($1, $2, $3, $4, 'siswa', $5) ON CONFLICT (email) DO UPDATE SET nama = EXCLUDED.nama, username = EXCLUDED.username, kelas = EXCLUDED.kelas", [siswa.nama, siswa.email.split('@')[0], siswa.email, await bcrypt.hash(siswa.password ?? 'demo', 12), siswa.kelas]);
    }
    await client.query('COMMIT');
    res.status(201).json({ imported: input.siswa.length });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}));

app.get('/api/dashboard', requireAuth(), asyncRoute(async (_req, res) => {
  const result = await pool.query(`
    SELECT
      (SELECT COUNT(*)::int FROM users WHERE role = 'siswa') AS siswa,
      (SELECT COUNT(*)::int FROM users WHERE role = 'guru') AS guru,
      (SELECT COUNT(*)::int FROM mata_pelajaran) AS program,
      (SELECT COUNT(*)::int FROM booking_pelajaran) AS pendaftaran,
      (SELECT COUNT(*)::int FROM kelas) AS kelas,
      (SELECT COUNT(*)::int FROM users) AS akun
  `);
  res.json(result.rows[0]);
}));

app.get('/api/reports/groups', requireAdmin, asyncRoute(async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT mp.id, mp.nama_pelajaran, mp.kelas, mp.kapasitas, u.nama AS guru,
      COUNT(siswa.id)::int AS terdaftar,
      COALESCE(json_agg(
        json_build_object('id', siswa.id, 'nama', siswa.nama, 'email', siswa.email)
        ORDER BY siswa.nama
      ) FILTER (WHERE siswa.id IS NOT NULL), '[]'::json) AS siswa
    FROM mata_pelajaran mp
    LEFT JOIN users u ON u.id = mp.guru_id
    LEFT JOIN booking_pelajaran bp ON bp.mata_pelajaran_id = mp.id
    LEFT JOIN users siswa ON siswa.id = bp.siswa_id AND siswa.role = 'siswa' AND siswa.kelas = mp.kelas
    GROUP BY mp.id, u.nama
    HAVING COUNT(siswa.id) > 0
    ORDER BY mp.kelas, mp.nama_pelajaran
  `);
  res.json(rows);
}));

app.get('/api/reports/students', requireAdmin, asyncRoute(async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT siswa.id, siswa.nama, siswa.email, siswa.kelas,
      COUNT(bp.id)::int AS jumlah_program,
      COALESCE(json_agg(
        json_build_object('id', mp.id, 'nama_pelajaran', mp.nama_pelajaran)
        ORDER BY mp.nama_pelajaran
      ) FILTER (WHERE mp.id IS NOT NULL), '[]'::json) AS program
    FROM users siswa
    LEFT JOIN booking_pelajaran bp ON bp.siswa_id = siswa.id
    LEFT JOIN mata_pelajaran mp ON mp.id = bp.mata_pelajaran_id
    WHERE siswa.role = 'siswa'
    GROUP BY siswa.id
    ORDER BY siswa.kelas, siswa.nama
  `);
  res.json(rows);
}));

app.get('/api/classes/:guruId', requireAuth(['guru']), asyncRoute(async (req, res) => {
  const guruId = z.coerce.number().int().positive().parse(req.params.guruId);
  const auth = (req as AuthRequest).user;
  if (auth?.id !== guruId) return res.status(403).json({ message: 'Kamu hanya dapat melihat kelas yang kamu ampu.' });
  const { rows } = await pool.query(`
    SELECT mp.id, mp.nama_pelajaran, mp.deskripsi, mp.kapasitas, mp.kelas,
      jm.hari, TO_CHAR(jm.jam_mulai, 'HH24:MI') AS jam_mulai, TO_CHAR(jm.jam_selesai, 'HH24:MI') AS jam_selesai, jm.ruang,
      COALESCE(json_agg(json_build_object('id', u.id, 'nama', u.nama, 'email', u.email) ORDER BY u.nama)
      FILTER (WHERE u.id IS NOT NULL), '[]'::json) AS students
    FROM mata_pelajaran mp
    LEFT JOIN booking_pelajaran bp ON bp.mata_pelajaran_id = mp.id
    LEFT JOIN jadwal_mengajar jm ON jm.mata_pelajaran_id = mp.id
    LEFT JOIN users u ON u.id = bp.siswa_id AND u.kelas = mp.kelas
    WHERE mp.guru_id = $1 GROUP BY mp.id, jm.id ORDER BY mp.id
  `, [guruId]);
  res.json(rows);
}));

app.get('/api/teachers/:teacherId/schedule', requireAuth(['guru']), asyncRoute(async (req, res) => {
  const teacherId = z.coerce.number().int().positive().parse(req.params.teacherId);
  const auth = (req as AuthRequest).user;
  if (auth?.id !== teacherId) return res.status(403).json({ message: 'Kamu hanya dapat melihat jadwalmu sendiri.' });
  const { rows } = await pool.query(`SELECT jm.id, jm.mata_pelajaran_id, mp.nama_pelajaran, mp.kelas, jm.hari, TO_CHAR(jm.jam_mulai, 'HH24:MI') AS jam_mulai, TO_CHAR(jm.jam_selesai, 'HH24:MI') AS jam_selesai, jm.ruang, COUNT(bp.id)::int AS terdaftar, mp.kapasitas FROM jadwal_mengajar jm JOIN mata_pelajaran mp ON mp.id = jm.mata_pelajaran_id LEFT JOIN booking_pelajaran bp ON bp.mata_pelajaran_id = mp.id WHERE mp.guru_id = $1 GROUP BY jm.id, mp.id ORDER BY CASE jm.hari WHEN 'Senin' THEN 1 WHEN 'Selasa' THEN 2 WHEN 'Rabu' THEN 3 WHEN 'Kamis' THEN 4 WHEN 'Jumat' THEN 5 ELSE 6 END, jm.jam_mulai`, [teacherId]);
  res.json(rows);
}));

app.get('/api/students/:studentId/bookings', requireAuth(['siswa']), asyncRoute(async (req, res) => {
  const studentId = z.coerce.number().int().positive().parse(req.params.studentId);
  const auth = (req as AuthRequest).user;
  if (auth?.id !== studentId) return res.status(403).json({ message: 'Kamu hanya dapat melihat pendaftaranmu sendiri.' });
  const { rows } = await pool.query(`
    SELECT bp.id, bp.mata_pelajaran_id, bp.tanggal_booking, mp.nama_pelajaran, u.nama AS guru
    FROM booking_pelajaran bp
    JOIN mata_pelajaran mp ON mp.id = bp.mata_pelajaran_id
    LEFT JOIN users u ON u.id = mp.guru_id
    WHERE bp.siswa_id = $1 ORDER BY bp.tanggal_booking DESC
  `, [studentId]);
  res.json(rows);
}));

app.get('/api/students/:studentId/team', requireAuth(['siswa']), asyncRoute(async (req, res) => {
  const studentId = z.coerce.number().int().positive().parse(req.params.studentId);
  const auth = (req as AuthRequest).user;
  if (auth?.id !== studentId) return res.status(403).json({ message: 'Kamu hanya dapat melihat Team-mu sendiri.' });
  const { rows } = await pool.query(`
    SELECT mp.id, mp.nama_pelajaran, mp.kelas, mp.kapasitas,
      COUNT(bp.id)::int AS terdaftar,
      COALESCE(json_agg(json_build_object('id', u.id, 'nama', u.nama, 'foto_profil', u.foto_profil) ORDER BY u.nama)
        FILTER (WHERE u.id IS NOT NULL), '[]'::json) AS anggota
    FROM mata_pelajaran mp
    JOIN booking_pelajaran mine ON mine.mata_pelajaran_id = mp.id AND mine.siswa_id = $1
    LEFT JOIN booking_pelajaran bp ON bp.mata_pelajaran_id = mp.id
    LEFT JOIN users u ON u.id = bp.siswa_id
    GROUP BY mp.id ORDER BY mp.id
  `, [studentId]);
  res.json(rows);
}));

app.get('/api/students/:studentId/schedule', requireAuth(['siswa']), asyncRoute(async (req, res) => {
  const studentId = z.coerce.number().int().positive().parse(req.params.studentId);
  const auth = (req as AuthRequest).user;
  if (auth?.id !== studentId) return res.status(403).json({ message: 'Kamu hanya dapat melihat jadwalmu sendiri.' });
  const { rows } = await pool.query(`
    SELECT mp.id, mp.nama_pelajaran, mp.kelas, mp.kapasitas, guru.nama AS guru,
      jm.hari, TO_CHAR(jm.jam_mulai, 'HH24:MI') AS jam_mulai, TO_CHAR(jm.jam_selesai, 'HH24:MI') AS jam_selesai, jm.ruang,
      (SELECT COUNT(*)::int FROM booking_pelajaran bcount WHERE bcount.mata_pelajaran_id = mp.id) AS terdaftar,
      COALESCE((SELECT json_agg(json_build_object('id', tm.id, 'nama', tm.nama, 'foto_profil', tm.foto_profil) ORDER BY tm.nama)
        FROM booking_pelajaran bt JOIN users tm ON tm.id = bt.siswa_id WHERE bt.mata_pelajaran_id = mp.id), '[]'::json) AS team,
      COALESCE((SELECT json_agg(json_build_object('id', pp.id, 'judul', pp.judul, 'deskripsi', pp.deskripsi, 'status', pp.status, 'feedback', pp.feedback, 'pengusul', pu.nama, 'created_at', pp.created_at) ORDER BY pp.created_at DESC)
        FROM proposal_program pp JOIN users pu ON pu.id = pp.pengusul_id WHERE pp.mata_pelajaran_id = mp.id), '[]'::json) AS proposals
    FROM booking_pelajaran mine
    JOIN mata_pelajaran mp ON mp.id = mine.mata_pelajaran_id
    LEFT JOIN users guru ON guru.id = mp.guru_id
    LEFT JOIN jadwal_mengajar jm ON jm.mata_pelajaran_id = mp.id
    WHERE mine.siswa_id = $1 ORDER BY mp.id
  `, [studentId]);
  res.json(rows);
}));

app.post('/api/proposals', requireAuth(['siswa']), asyncRoute(async (req, res) => {
  const input = z.object({ siswaId: z.number().int().positive(), mataPelajaranId: z.number().int().positive(), judul: z.string().min(3).max(180), deskripsi: z.string().min(10) }).parse(req.body);
  const auth = (req as AuthRequest).user;
  if (auth?.id !== input.siswaId) return res.status(403).json({ message: 'Proposal harus diajukan oleh akun siswa yang sedang login.' });
  const allowed = await pool.query('SELECT 1 FROM booking_pelajaran WHERE siswa_id = $1 AND mata_pelajaran_id = $2', [input.siswaId, input.mataPelajaranId]);
  if (!allowed.rowCount) return res.status(403).json({ message: 'Hanya anggota Team yang dapat mengajukan proposal.' });
  const { rows } = await pool.query('INSERT INTO proposal_program (mata_pelajaran_id, pengusul_id, judul, deskripsi) VALUES ($1, $2, $3, $4) RETURNING id, judul, deskripsi, status, feedback, created_at', [input.mataPelajaranId, input.siswaId, input.judul, input.deskripsi]);
  res.status(201).json(rows[0]);
}));

app.get('/api/teachers/:teacherId/proposals', requireAuth(['guru']), asyncRoute(async (req, res) => {
  const teacherId = z.coerce.number().int().positive().parse(req.params.teacherId);
  const auth = (req as AuthRequest).user;
  if (auth?.id !== teacherId) return res.status(403).json({ message: 'Kamu hanya dapat melihat proposal untuk kelasmu sendiri.' });
  const { rows } = await pool.query(`
    SELECT pp.id, pp.judul, pp.deskripsi, pp.status, pp.feedback, pp.created_at,
      mp.id AS mata_pelajaran_id, mp.nama_pelajaran, mp.kelas, pengusul.nama AS pengusul,
      (SELECT COUNT(*)::int FROM booking_pelajaran bx WHERE bx.mata_pelajaran_id = mp.id) AS terdaftar
    FROM proposal_program pp
    JOIN mata_pelajaran mp ON mp.id = pp.mata_pelajaran_id
    JOIN users pengusul ON pengusul.id = pp.pengusul_id
    WHERE mp.guru_id = $1 ORDER BY pp.created_at DESC
  `, [teacherId]);
  res.json(rows);
}));

app.put('/api/proposals/:id', requireAuth(['guru']), asyncRoute(async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const input = z.object({ guruId: z.number().int().positive(), status: z.enum(['disetujui', 'ditolak']), feedback: z.string().min(3).max(1000) }).parse(req.body);
  const auth = (req as AuthRequest).user;
  if (auth?.id !== input.guruId) return res.status(403).json({ message: 'Proposal hanya dapat diproses oleh guru yang sedang login.' });
  const result = await pool.query(`UPDATE proposal_program pp SET status = $1, feedback = $2, updated_at = NOW() FROM mata_pelajaran mp WHERE pp.id = $3 AND mp.id = pp.mata_pelajaran_id AND mp.guru_id = $4 RETURNING pp.id, pp.status, pp.feedback`, [input.status, input.feedback, id, input.guruId]);
  if (!result.rowCount) return res.status(403).json({ message: 'Proposal tidak ditemukan atau bukan tanggung jawab guru ini.' });
  res.json(result.rows[0]);
}));

app.post('/api/bookings', requireAuth(['siswa']), asyncRoute(async (req, res) => {
  const input = z.object({ siswaId: z.number().int().positive(), mataPelajaranId: z.number().int().positive() }).parse(req.body);
  const auth = (req as AuthRequest).user;
  if (auth?.id !== input.siswaId) return res.status(403).json({ message: 'Pendaftaran harus dilakukan oleh akun siswa yang sedang login.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const bookingWindow = await client.query(`SELECT booking_dibuka_at, booking_ditutup_at, semester_aktif FROM app_settings WHERE id = 1 FOR SHARE`);
    const settings = bookingWindow.rows[0];
    if (!settings?.semester_aktif || (settings.booking_dibuka_at && new Date() < new Date(settings.booking_dibuka_at)) || (settings.booking_ditutup_at && new Date() >= new Date(settings.booking_ditutup_at))) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: !settings?.semester_aktif ? 'Pendaftaran sedang ditutup karena semester tidak aktif.' : settings.booking_dibuka_at && new Date() < new Date(settings.booking_dibuka_at) ? 'Pendaftaran belum dibuka.' : 'Pendaftaran sudah ditutup.' });
    }
    const course = await client.query('SELECT kapasitas, kelas FROM mata_pelajaran WHERE id = $1 FOR UPDATE', [input.mataPelajaranId]);
    if (!course.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Program tidak ditemukan.' });
    }
    const existing = await client.query('SELECT 1 FROM booking_pelajaran WHERE siswa_id = $1 AND mata_pelajaran_id = $2', [input.siswaId, input.mataPelajaranId]);
    if (existing.rowCount) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'Kamu sudah terdaftar di program ini.' });
    }
    const student = await client.query("SELECT kelas FROM users WHERE id = $1 AND role = 'siswa'", [input.siswaId]);
    if (!student.rowCount || student.rows[0].kelas !== course.rows[0].kelas) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Program ini hanya tersedia untuk kelas siswa tersebut.' });
    }
    const studentBookings = await client.query(`
      SELECT COUNT(*)::int AS total
      FROM booking_pelajaran bp
      JOIN mata_pelajaran mp ON mp.id = bp.mata_pelajaran_id
      WHERE bp.siswa_id = $1 AND mp.kelas = $2
    `, [input.siswaId, student.rows[0].kelas]);
    if (studentBookings.rows[0].total >= 3) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'Kamu sudah mencapai maksimal 3 mata pelajaran di kelas ini.' });
    }
    const count = await client.query('SELECT COUNT(*)::int AS total FROM booking_pelajaran WHERE mata_pelajaran_id = $1', [input.mataPelajaranId]);
    if (count.rows[0].total >= course.rows[0].kapasitas) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'Kuota program ini sudah penuh.' });
    }
    const created = await client.query('INSERT INTO booking_pelajaran (siswa_id, mata_pelajaran_id) VALUES ($1, $2) RETURNING id, tanggal_booking', [input.siswaId, input.mataPelajaranId]);
    await client.query('COMMIT');
    res.status(201).json(created.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

app.delete('/api/bookings/:mataPelajaranId', requireAuth(), asyncRoute(async (_req, res) => {
  res.status(403).json({ message: 'Siswa tidak dapat membatalkan pendaftaran. Hubungi guru mata pelajaran.' });
}));

app.delete('/api/bookings', requireAdmin, asyncRoute(async (_req, res) => {
  const result = await pool.query('DELETE FROM booking_pelajaran RETURNING id');
  res.json({ cancelled: result.rowCount ?? 0, message: 'Seluruh pendaftaran siswa berhasil dibatalkan.' });
}));

app.delete('/api/teachers/:teacherId/bookings/:mataPelajaranId/:studentId', requireAuth(['guru']), asyncRoute(async (req, res) => {
  const teacherId = z.coerce.number().int().positive().parse(req.params.teacherId);
  const mataPelajaranId = z.coerce.number().int().positive().parse(req.params.mataPelajaranId);
  const studentId = z.coerce.number().int().positive().parse(req.params.studentId);
  const auth = (req as AuthRequest).user;
  if (auth?.id !== teacherId) return res.status(403).json({ message: 'Pembatalan hanya dapat dilakukan oleh akun guru yang sedang login.' });
  const result = await pool.query(`
    DELETE FROM booking_pelajaran bp
    USING mata_pelajaran mp
    WHERE bp.mata_pelajaran_id = mp.id
      AND bp.mata_pelajaran_id = $1
      AND bp.siswa_id = $2
      AND mp.guru_id = $3
    RETURNING bp.id
  `, [mataPelajaranId, studentId, teacherId]);
  if (!result.rowCount) return res.status(404).json({ message: 'Pendaftaran tidak ditemukan atau bukan mata pelajaran yang kamu ampu.' });
  res.json({ message: 'Pendaftaran siswa berhasil dibatalkan.' });
}));

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  res.status(400).json({ message: 'Permintaan tidak dapat diproses.' });
});

export default app;

if (process.env.VERCEL !== '1') {
  const port = Number(process.env.PORT ?? 4000);
  app.listen(port, () => console.log(`SLC API listening on http://localhost:${port}`));
}
