import { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, BookOpen, Calculator, Check, ChevronDown, Church, CircleHelp, ClipboardList, Dumbbell, FileDown, FlaskConical, Gauge, Globe2, GraduationCap, Landmark, Laptop, Languages, LayoutGrid, LogIn, LogOut, Menu, MessageCircle, Palette, Pencil, Search, Settings2, ShieldCheck, Sparkles, TrendingUp, UserPlus, Users, X, type LucideIcon } from 'lucide-react';
import * as XLSX from 'xlsx';
import SettingsPanel from './SettingsPanel';
import ProfilePanel from './ProfilePanel';
import { API, authFetch, authHeaders } from './apiClient';

type Role = 'siswa' | 'guru' | 'kepala_sekolah' | 'admin';
type Branding = { nama_website: string; logo_sekolah: string | null };
type PageContent = { title: string; intro: string; sectionTitle: string; sectionText: string };
type Pages = Record<'home' | 'profil' | 'sekolah' | 'program', PageContent>;
type Screen = 'home' | 'login' | 'app';
type LandingPage = 'home' | 'profil' | 'sekolah' | 'program';
type NavKey = 'ringkasan' | 'program' | 'progres' | 'komunitas' | 'jadwal' | 'kelas' | 'guru' | 'siswa' | 'pengguna' | 'pelajaran' | 'laporan' | 'pendaftaran' | 'pages' | 'rekapitulasi' | 'rekap_kelompok' | 'rekap_siswa';
type NavItem = { key: NavKey; label: string; icon: typeof LayoutGrid; count?: number; children?: NavItem[] };
type Course = { id: number; nama_pelajaran: string; deskripsi: string; kapasitas: number; kelas: string; guru_id: number; guru: string; terdaftar: number; booking_dibuka_at: string | null; booking_ditutup_at: string | null };
type Booking = { mata_pelajaran_id: number };
type UserRecord = { id: number; nama: string; username: string; email: string; role: Role; kelas: string | null; foto_profil: string | null };
type ClassRecord = { id: number; nama_kelas: string; jumlah_siswa: number; jumlah_program: number };
type DashboardStats = { siswa: number; guru: number; program: number; pendaftaran: number; kelas: number; akun: number };
type TeamGroup = { id: number; nama_pelajaran: string; kelas: string; kapasitas: number; terdaftar: number; anggota: { id: number; nama: string; foto_profil: string | null }[] };
type ScheduleGroup = TeamGroup & { guru: string; hari: string | null; jam_mulai: string | null; jam_selesai: string | null; ruang: string | null; team: TeamGroup['anggota']; proposals: { id: number; judul: string; deskripsi: string; status: 'menunggu' | 'disetujui' | 'ditolak'; feedback: string | null; pengusul: string; created_at: string }[] };
type TeacherProposal = { id: number; judul: string; deskripsi: string; status: 'menunggu' | 'disetujui' | 'ditolak'; feedback: string | null; nama_pelajaran: string; kelas: string; pengusul: string; mata_pelajaran_id: number; terdaftar: number };
type GroupReport = { id: number; nama_pelajaran: string; kelas: string; kapasitas: number; guru: string | null; terdaftar: number; siswa: { id: number; nama: string; email: string }[] };
type StudentReport = { id: number; nama: string; email: string; kelas: string | null; jumlah_program: number; program: { id: number; nama_pelajaran: string }[] };
const roleMeta: Record<Role, { label: string; name: string; initial: string }> = {
  siswa: { label: 'Ruang siswa', name: 'Nadia Prameswari', initial: 'NP' },
  guru: { label: 'Ruang guru', name: 'Alya Putri', initial: 'AP' },
  kepala_sekolah: { label: 'Ruang kepala sekolah', name: 'Dr. Ratna Sari', initial: 'RS' },
  admin: { label: 'Ruang administrator', name: 'Admin SLC', initial: 'AS' },
};
const userInitials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
const defaultBranding: Branding = { nama_website: 'Student Led Conference', logo_sekolah: null };
const defaultPages: Pages = {
  home: { title: 'Pimpin proses belajarmu.', intro: 'Student Led Conference adalah ruang bagi siswa untuk memahami proses belajar, menyusun tujuan, dan membagikan pertumbuhan mereka dengan percaya diri.', sectionTitle: 'Belajar. Merefleksikan. Memimpin.', sectionText: 'Setiap program SLC membantu siswa mengenali kekuatan, mengevaluasi tantangan, dan mengambil kepemilikan atas langkah belajar berikutnya.' },
  profil: { title: 'Suaramu. Perjalananmu. Kepemimpinanmu.', intro: 'Student Led Conference menempatkan siswa sebagai pemimpin dalam percakapan tentang belajar, karakter, dan masa depan mereka.', sectionTitle: 'Siswa memimpin dengan kesadaran.', sectionText: 'Kepemimpinan dimulai dari kemampuan mengenali diri, mendengarkan dengan terbuka, dan menyampaikan refleksi dengan jujur serta bertanggung jawab.' },
  sekolah: { title: 'Sekolah yang menumbuhkan pemimpin.', intro: 'SLC hadir sebagai budaya kolaboratif yang menghubungkan siswa, guru, dan keluarga untuk merayakan kemajuan serta merancang pertumbuhan berikutnya.', sectionTitle: 'Pertumbuhan adalah percakapan bersama.', sectionText: 'Kami menciptakan ruang yang aman dan terarah agar setiap siswa dapat menunjukkan bukti belajar, menerima umpan balik, dan menyusun tujuan yang bermakna.' },
  program: { title: 'Temukan ruang untuk memimpin.', intro: 'Program SLC mengajak siswa mengeksplorasi minat, mengembangkan kompetensi, dan mempresentasikan pembelajaran melalui kolaborasi yang nyata.', sectionTitle: 'Program Student Led Conference', sectionText: 'Pilih program yang mendukung refleksi, komunikasi, kreativitas, dan keberanian untuk mengambil inisiatif.' },
};

const navByRole: Record<Role, NavItem[]> = {
  siswa: [{ key: 'ringkasan', label: 'Ringkasan', icon: LayoutGrid }, { key: 'program', label: 'Pilih program', icon: BookOpen, count: 4 }, { key: 'jadwal', label: 'Jadwal saya', icon: Gauge }, { key: 'komunitas', label: 'Team', icon: Users }],
  guru: [{ key: 'ringkasan', label: 'Ringkasan', icon: LayoutGrid }, { key: 'jadwal', label: 'Jadwal saya', icon: Gauge }, { key: 'kelas', label: 'Kelola kelas', icon: BookOpen, count: 2 }, { key: 'siswa', label: 'Daftar siswa', icon: Users }],
  kepala_sekolah: [{ key: 'ringkasan', label: 'Ringkasan', icon: LayoutGrid }, { key: 'laporan', label: 'Laporan program', icon: TrendingUp }, { key: 'pendaftaran', label: 'Pendaftaran', icon: ClipboardList }],
  admin: [{ key: 'ringkasan', label: 'Ringkasan', icon: LayoutGrid }, { key: 'pages', label: 'Pages', icon: Pencil }, { key: 'kelas', label: 'Data kelas', icon: GraduationCap }, { key: 'guru', label: 'Data guru', icon: Users }, { key: 'siswa', label: 'Data siswa', icon: Users }, { key: 'pelajaran', label: 'Data mata pelajaran', icon: BookOpen }, { key: 'jadwal', label: 'Penjadwalan', icon: Gauge }, { key: 'rekapitulasi', label: 'Rekapitulasi', icon: ClipboardList, children: [{ key: 'rekap_kelompok', label: 'Rekap kelompok', icon: Users }, { key: 'rekap_siswa', label: 'Rekap siswa', icon: GraduationCap }] }, { key: 'laporan', label: 'Laporan sistem', icon: ClipboardList }],
};

async function get<T>(path: string): Promise<T> { const response = await authFetch(path); if (!response.ok) throw new Error('API unavailable'); return response.json(); }
const fetch: typeof globalThis.fetch = (input, init) => typeof input === 'string' && input.startsWith(API) && !input.endsWith('/login') ? authFetch(input.slice(API.length), init) : globalThis.fetch(input, init);

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [landingPage, setLandingPage] = useState<LandingPage>('home');
  const [role, setRole] = useState<Role>('siswa');
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [stats, setStats] = useState<DashboardStats>({ siswa: 0, guru: 0, program: 0, pendaftaran: 0, kelas: 0, akun: 0 });
  const [booked, setBooked] = useState<number[]>([]);
  const [studentClass, setStudentClass] = useState('');
  const [notice, setNotice] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const [activeNav, setActiveNav] = useState<NavKey>('ringkasan');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [branding, setBranding] = useState<Branding>(defaultBranding);
  const [pages, setPages] = useState<Pages>(defaultPages);

  const refreshData = () => { get<Course[]>('/courses').then(setCourses).catch(() => setNotice('Data program belum dapat dimuat.')); get<DashboardStats>('/dashboard').then(setStats).catch(() => undefined); };
  const loadBranding = () => { globalThis.fetch(`${API}/public-settings`).then((response) => response.ok ? response.json() : Promise.reject(new Error('Branding unavailable'))).then((data: Branding & { page_content?: Partial<Pages> }) => { setBranding({ ...defaultBranding, ...data }); setPages({ ...defaultPages, ...(data.page_content ?? {}) } as Pages); }).catch(() => undefined); };
  useEffect(() => { loadBranding(); window.addEventListener('clc-settings-updated', loadBranding); return () => window.removeEventListener('clc-settings-updated', loadBranding); }, []);
  useEffect(() => { if (screen === 'app') refreshData(); }, [activeNav, role, screen]);
  useEffect(() => { if (!currentUser) return; setStudentClass(currentUser.kelas ?? ''); get<Booking[]>(`/students/${currentUser.id}/bookings`).then((rows) => setBooked(rows.map((row) => row.mata_pelajaran_id))).catch(() => setBooked([])); }, [currentUser]);
  const meta = roleMeta[role];
  if (screen === 'home') { const landingProps = { onLogin: () => setScreen('login'), onNavigate: setLandingPage, branding, pages }; if (landingPage === 'profil') return <ProfileLanding {...landingProps} />; if (landingPage === 'sekolah') return <SchoolLanding {...landingProps} />; if (landingPage === 'program') return <ProgramsLanding {...landingProps} />; return <HomePage {...landingProps} />; }
  if (screen === 'login') return <UsernameLoginPage branding={branding} onLogin={(user, token) => { sessionStorage.setItem('clc_token', token); setCurrentUser(user); setRole(user.role); setScreen('app'); }} onBack={() => setScreen('home')} />;
  const book = async (course: Course) => {
    try {
      const response = await authFetch('/bookings', { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ siswaId: currentUser?.id ?? 1, mataPelajaranId: course.id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setBooked([...booked, course.id]); setCourses(courses.map((item) => item.id === course.id ? { ...item, terdaftar: item.terdaftar + 1 } : item)); setNotice('Pendaftaran berhasil ditambahkan ke jadwalmu.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Pendaftaran gagal.'); }
  };
  const navItems = navByRole[role];
  return <div className="app-shell">
    <aside className={mobileNav ? 'sidebar open' : 'sidebar'}>
      <div className="brand"><BrandLogo branding={branding} /><button className="icon-button close-nav" onClick={() => setMobileNav(false)}><X size={18} /></button></div>
      <div className="workspace-label">{meta.label}</div>
      <nav>{navItems.map((item) => item.children
        ? <div className="nav-group" key={item.key}><div className="nav-group-title"><item.icon size={18} /> {item.label}</div>{item.children.map(({ key, label, icon: Icon }) => <button className={activeNav === key ? 'nav-item nav-subitem active' : 'nav-item nav-subitem'} key={key} onClick={() => { setActiveNav(key); setMobileNav(false); }}><Icon size={16} /> {label}</button>)}</div>
        : <button className={activeNav === item.key ? 'nav-item active' : 'nav-item'} key={item.key} onClick={() => { setActiveNav(item.key); setMobileNav(false); }}><item.icon size={18} /> {item.label} {item.count && <span className="nav-count">{item.count}</span>}</button>)}</nav>
      <div className="sidebar-bottom">{role === 'admin' && <button className="nav-item" onClick={() => setSettingsOpen(true)}><Settings2 size={18} /> Pengaturan</button>}<button className="nav-item" onClick={() => setHelpOpen(true)}><CircleHelp size={18} /> Pusat bantuan</button><button className="nav-item" onClick={() => { sessionStorage.removeItem('clc_token'); setCurrentUser(null); setScreen('home'); }}><LogOut size={18} /> Keluar</button></div>
      <button className="profile-mini" onClick={() => setProfileOpen(true)}><div className="avatar">{currentUser?.foto_profil ? <img src={currentUser.foto_profil} alt="" /> : userInitials(currentUser?.nama ?? meta.name)}</div><div><strong>{currentUser?.nama ?? meta.name}</strong><small>{role.replace('_', ' ')}</small></div><ChevronDown size={16} className="muted" /></button>
    </aside>
    <main className="main-content">
      <header className="topbar"><button className="icon-button menu-button" onClick={() => setMobileNav(true)}><Menu size={21} /></button><div className="crumb"><span>Ruang kerja</span><span>/</span><b>{navItems.flatMap((item) => item.children ?? [item]).find((item) => item.key === activeNav)?.label ?? 'Ringkasan'}</b></div><div className="top-actions"><span className="role-label">{currentUser?.nama ?? meta.name} · {role.replace('_', ' ')}</span><button className="icon-button" onClick={() => setHelpOpen(true)} aria-label="Cari"><Search size={19} /></button><button className="avatar top-avatar" onClick={() => setProfileOpen(true)}>{currentUser?.foto_profil ? <img src={currentUser.foto_profil} alt="" /> : userInitials(currentUser?.nama ?? meta.name)}</button></div></header>
      <div className="content-wrap">
        {activeNav === 'ringkasan' && role === 'siswa' && <StudentView studentId={currentUser?.id ?? 1} bookingKey={booked.join(',')} notice={notice} />}
        {activeNav === 'ringkasan' && role === 'guru' && <TeacherDashboard courses={courses} user={currentUser} />}
        {activeNav === 'ringkasan' && role === 'kepala_sekolah' && <LivePrincipalView courses={courses} stats={stats} />}
        {activeNav === 'ringkasan' && role === 'admin' && <LiveAdminView courses={courses} stats={stats} />}
        {activeNav === 'rekap_kelompok' && role === 'admin' && <AdminGroupReportPanel />}
        {activeNav === 'rekap_siswa' && role === 'admin' && <AdminStudentReportPanel />}
        {activeNav !== 'ringkasan' && activeNav !== 'rekap_kelompok' && activeNav !== 'rekap_siswa' && <WorkspacePanel role={role} nav={activeNav} courses={courses} booked={booked} studentClass={studentClass} userId={currentUser?.id ?? 1} onBook={book} pages={pages} />}
      </div>
    </main>
    {settingsOpen && role === 'admin' && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    {helpOpen && <UtilityPanel type="help" onClose={() => setHelpOpen(false)} />}
    {profileOpen && currentUser && <ProfilePanel userId={currentUser.id} onClose={() => setProfileOpen(false)} onSaved={(profile) => setCurrentUser({ ...currentUser, ...profile })} />}
  </div>;
}

function AdminGroupReportPanel() {
  const [items, setItems] = useState<GroupReport[]>([]);
  const [notice, setNotice] = useState('');
  useEffect(() => { get<GroupReport[]>('/reports/groups').then(setItems).catch(() => setNotice('Rekap kelompok belum dapat dimuat.')); }, []);
  return <><section className="page-intro"><div><p className="eyebrow">ADMIN / REKAP KELOMPOK</p><h1>Kelompok <em>program.</em></h1><p>Daftar kelompok siswa yang telah memilih program mata pelajaran dari kelas VII sampai kelas IX.</p></div><button className="dark-button report-export" onClick={() => window.print()}><FileDown size={16} /> Export PDF</button></section>{notice && <div className="notice">{notice}</div>}<section className="report-list">{items.map((item) => <article className="report-card" key={item.id}><div className="report-card-heading"><div><p className="eyebrow">{item.kelas}</p><h2>{item.nama_pelajaran}</h2><span>{item.guru ?? 'Guru belum ditentukan'} · {item.terdaftar}/{item.kapasitas} siswa</span></div><span className="status-pill"><Check size={12} /> Terdaftar</span></div><div className="roster-row roster-head"><span>Siswa</span><span>Email</span><span>Status</span></div>{item.siswa.map((student) => <div className="roster-row" key={student.id}><span className="roster-person"><span className="tiny-avatar">{userInitials(student.nama)}</span>{student.nama}</span><span>{student.email}</span><span className="status-pill"><Check size={12} /> Memilih</span></div>)}</article>)}{!items.length && !notice && <div className="empty-workspace"><h2>Belum ada siswa yang memilih program.</h2></div>}</section></>;
}

function AdminStudentReportPanel() {
  const [items, setItems] = useState<StudentReport[]>([]);
  const [status, setStatus] = useState<'semua' | 'sudah' | 'belum'>('semua');
  const [notice, setNotice] = useState('');
  useEffect(() => { get<StudentReport[]>('/reports/students').then(setItems).catch(() => setNotice('Rekap siswa belum dapat dimuat.')); }, []);
  const visibleItems = items.filter((item) => status === 'semua' || (status === 'sudah' ? item.jumlah_program > 0 : item.jumlah_program === 0));
  return <><section className="page-intro"><div><p className="eyebrow">ADMIN / REKAP SISWA</p><h1>Status pilihan <em>program.</em></h1><p>Periksa siswa yang sudah memilih program mata pelajaran dan siswa yang masih belum memilih.</p></div><button className="dark-button report-export" onClick={() => window.print()}><FileDown size={16} /> Export PDF</button></section><div className="report-filter"><button className={status === 'semua' ? 'dark-button' : 'light-button'} onClick={() => setStatus('semua')}>Semua ({items.length})</button><button className={status === 'sudah' ? 'dark-button' : 'light-button'} onClick={() => setStatus('sudah')}>Sudah memilih ({items.filter((item) => item.jumlah_program > 0).length})</button><button className={status === 'belum' ? 'dark-button' : 'light-button'} onClick={() => setStatus('belum')}>Belum memilih ({items.filter((item) => item.jumlah_program === 0).length})</button></div>{notice && <div className="notice">{notice}</div>}<section className="student-table report-student-table"><div className="roster-row roster-head"><span>Siswa</span><span>Kelas</span><span>Program dipilih</span><span>Status</span></div>{visibleItems.map((item) => <div className="roster-row" key={item.id}><span className="roster-person"><span className="tiny-avatar">{userInitials(item.nama)}</span><span><strong>{item.nama}</strong><small>{item.email}</small></span></span><span>{item.kelas ?? 'Belum ada kelas'}</span><span>{item.program.length ? item.program.map((program) => program.nama_pelajaran).join(', ') : '—'}</span><span className={item.jumlah_program ? 'status-pill' : 'status-pill status-muted'}>{item.jumlah_program ? <><Check size={12} /> Sudah memilih</> : 'Belum memilih'}</span></div>)}</section></>;
}

function WorkspacePanel({ role, nav, courses, booked, studentClass, userId, onBook, pages }: { role: Role; nav: NavKey; courses: Course[]; booked: number[]; studentClass: string; userId: number; onBook: (course: Course) => void; pages: Pages }) {
  const labels: Record<NavKey, { eyebrow: string; title: string; description: string }> = {
    ringkasan: { eyebrow: 'RINGKASAN', title: 'Ruang belajar yang terarah.', description: 'Semua informasi penting untuk langkah berikutnya.' },
    program: { eyebrow: 'PILIH PROGRAM', title: 'Temukan ruang belajarmu.', description: 'Pilih program yang masih memiliki kuota dan daftar sekarang.' },
    progres: { eyebrow: 'PROGRES BELAJAR', title: 'Lihat perjalananmu.', description: 'Kebiasaan kecil yang konsisten membentuk perubahan besar.' },
    komunitas: { eyebrow: 'TEAM', title: 'Belajar bersama.', description: 'Rekan siswa yang memilih program mata pelajaran yang sama.' },
    jadwal: { eyebrow: 'JADWAL SAYA', title: 'Atur ritme belajarmu.', description: 'Jadwal program yang sudah kamu ikuti.' },
    kelas: { eyebrow: 'KELOLA KELAS', title: 'Kelas yang kamu ampu.', description: 'Pantau kapasitas dan aktivitas setiap ruang belajar.' },
    guru: { eyebrow: 'DATA GURU', title: 'Tim pengajar SLC.', description: 'Kelola akun dan penugasan guru.' },
    siswa: { eyebrow: 'DAFTAR SISWA', title: 'Kenali peserta kelas.', description: 'Daftar siswa yang terdaftar di programmu.' },
    pengguna: { eyebrow: 'KELOLA PENGGUNA', title: 'Orang-orang di SLC.', description: 'Kelola akun siswa, guru, dan kepala sekolah.' },
    pelajaran: { eyebrow: 'DATA MATA PELAJARAN', title: 'Bangun program baru.', description: 'Atur mata pelajaran, kelas, dan guru pengampu.' },
    laporan: { eyebrow: role === 'admin' ? 'LAPORAN SISTEM' : 'LAPORAN PROGRAM', title: 'Data untuk keputusan yang baik.', description: 'Ringkasan aktivitas dan kinerja SLC.' },
    rekapitulasi: { eyebrow: 'REKAPITULASI', title: 'Rekapitulasi data SLC.', description: 'Pantau pilihan program siswa dari kelas VII hingga IX.' },
    rekap_kelompok: { eyebrow: 'ADMIN / REKAP KELOMPOK', title: 'Kelompok program siswa.', description: 'Seluruh siswa yang memilih program mata pelajaran, dikelompokkan berdasarkan kelas dan program.' },
    rekap_siswa: { eyebrow: 'ADMIN / REKAP SISWA', title: 'Status pilihan program.', description: 'Lihat siswa yang sudah dan belum memilih program mata pelajaran.' },
    pendaftaran: { eyebrow: 'PENDAFTARAN', title: 'Pendaftaran SLC.', description: 'Pantau minat siswa pada setiap program.' },
    pages: { eyebrow: 'ADMIN / PAGES', title: 'Edit halaman publik.', description: 'Ubah konten yang tampil pada halaman publik SLC.' },
  };
  const copy = labels[nav];
  if (nav === 'program') return <><section className="page-intro"><p className="eyebrow">{copy.eyebrow} / KELAS {studentClass}</p><h1>{role === 'siswa' ? 'Pilih Program SLC mu' : copy.title}</h1><p>{copy.description}</p></section><div className="course-grid">{courses.filter((course) => course.kelas === studentClass).map((course, index) => <CourseCard key={course.id} course={course} index={index} booked={booked} onBook={onBook} />)}</div></>;
  if (role === 'guru' && (nav === 'kelas' || nav === 'siswa')) return <TeacherWorkspacePanel userId={userId} view={nav} />;
  if (role === 'guru' && nav === 'jadwal') return <TeacherSchedulePanel userId={userId} />;
  if (nav === 'jadwal' && role === 'siswa') return <StudentSchedulePanel studentId={userId} />;
  if (nav === 'komunitas' && role === 'siswa') return <StudentTeamPanel studentId={userId} studentClass={studentClass} />;
  if (nav === 'pengguna') return <AdminUsersPanel />;
  if (nav === 'pages' && role === 'admin') return <AdminPagesPanel initialPages={pages} />;
  if (nav === 'kelas' && role === 'admin') return <><AdminCreateClassPanel /><AdminClassesEditPanel /></>;
  if (nav === 'guru' && role === 'admin') return <><AdminCreateUserPanel filterRole="guru" /><AdminUsersEditPanel filterRole="guru" /></>;
  if (nav === 'siswa' && role === 'admin') return <><AdminCreateUserPanel filterRole="siswa" /><AdminUsersEditPanel filterRole="siswa" /></>;
  if (nav === 'pelajaran') return <><AdminCreateCoursePanel /><AdminCoursesEditPanel courses={courses} /></>;
  if (nav === 'jadwal' && role === 'admin') return <AdminSchedulePanel />;
  const emptyMessage = nav === 'jadwal'
    ? 'Belum ada Jadwal yang terjadwal.'
    : nav === 'kelas'
      ? 'Belum ada Kelas yang terjadwal.'
      : 'Belum ada data.';
  return <><section className="page-intro"><p className="eyebrow">{copy.eyebrow}</p><h1>{copy.title}</h1><p>{copy.description}</p></section><div className="empty-workspace"><div className="empty-icon"><Sparkles size={22} /></div><h2>{emptyMessage}</h2></div></>;
}

type ScheduleRecord = { id: number; mata_pelajaran_id: number; nama_pelajaran: string; kelas: string; guru: string | null; hari: string; jam_mulai: string; jam_selesai: string; ruang: string | null; terdaftar?: number; kapasitas?: number };

function AdminSchedulePanel() {
  const [items, setItems] = useState<ScheduleRecord[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [editing, setEditing] = useState<ScheduleRecord | null>(null);
  const [form, setForm] = useState({ mataPelajaranId: 0, hari: 'Senin', jamMulai: '08:00', jamSelesai: '09:00', ruang: '' });
  const [notice, setNotice] = useState('');
  const load = () => { get<ScheduleRecord[]>('/schedules').then(setItems).catch(() => setNotice('Jadwal belum dapat dimuat.')); get<Course[]>('/courses').then((rows) => { setCourses(rows); if (!form.mataPelajaranId && rows[0]) setForm((current) => ({ ...current, mataPelajaranId: rows[0].id })); }).catch(() => setNotice('Data mata pelajaran belum dapat dimuat.')); };
  useEffect(() => { load(); }, []);
  const save = async (event: React.FormEvent) => { event.preventDefault(); const path = editing ? `/schedules/${editing.id}` : '/schedules'; const response = await fetch(`${API}${path}`, { method: editing ? 'PUT' : 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(form) }); const data = await response.json(); if (!response.ok) return setNotice(data.message ?? 'Jadwal gagal disimpan.'); setNotice('Jadwal berhasil disimpan.'); setEditing(null); setForm({ mataPelajaranId: courses[0]?.id ?? 0, hari: 'Senin', jamMulai: '08:00', jamSelesai: '09:00', ruang: '' }); load(); };
  const remove = async (item: ScheduleRecord) => { if (!window.confirm(`Hapus jadwal ${item.nama_pelajaran}?`)) return; const response = await fetch(`${API}/schedules/${item.id}`, { method: 'DELETE', headers: authHeaders() }); setNotice(response.ok ? 'Jadwal berhasil dihapus.' : 'Jadwal tidak dapat dihapus.'); load(); };
  return <><section className="page-intro"><p className="eyebrow">ADMIN / PENJADWALAN</p><h1>Atur jam <em>mengajar.</em></h1><p>Jadwal ini otomatis tampil pada dashboard guru dan siswa yang memilih mata pelajaran terkait.</p></section>{notice && <div className="notice"><Check size={16} /> {notice}</div>}<form className="course-admin-form compact-course-form" onSubmit={save}><select required value={form.mataPelajaranId} onChange={(event) => setForm({ ...form, mataPelajaranId: Number(event.target.value) })}>{courses.map((course) => <option value={course.id} key={course.id}>{course.nama_pelajaran} · {course.kelas}</option>)}</select><select value={form.hari} onChange={(event) => setForm({ ...form, hari: event.target.value })}><option>Senin</option><option>Selasa</option><option>Rabu</option><option>Kamis</option><option>Jumat</option><option>Sabtu</option></select><input required type="time" value={form.jamMulai} onChange={(event) => setForm({ ...form, jamMulai: event.target.value })} /><input required type="time" value={form.jamSelesai} onChange={(event) => setForm({ ...form, jamSelesai: event.target.value })} /><input placeholder="Ruang (opsional)" value={form.ruang} onChange={(event) => setForm({ ...form, ruang: event.target.value })} /><button className="dark-button">{editing ? 'Simpan perubahan' : 'Tambah jadwal'} <Check size={16} /></button></form><div className="program-report">{items.map((item) => <div className="program-report-row" key={item.id}><strong>{item.nama_pelajaran}</strong><span>{item.guru ?? 'Guru belum ditentukan'}</span><b>{item.hari}, {item.jam_mulai}–{item.jam_selesai}</b><span>{item.ruang ?? 'Ruang belum ditentukan'}</span><span className="row-actions"><button className="edit-button" onClick={() => { setEditing(item); setForm({ mataPelajaranId: item.mata_pelajaran_id, hari: item.hari, jamMulai: item.jam_mulai, jamSelesai: item.jam_selesai, ruang: item.ruang ?? '' }); }}><Pencil size={14} /> Edit</button><button className="delete-button" onClick={() => remove(item)}><X size={15} /></button></span></div>)}</div>{editing && <button className="text-button" onClick={() => setEditing(null)}>Batalkan edit</button>}</>;
}

function TeacherSchedulePanel({ userId }: { userId: number }) {
  const [items, setItems] = useState<ScheduleRecord[]>([]);
  useEffect(() => { get<ScheduleRecord[]>(`/teachers/${userId}/schedule`).then(setItems).catch(() => setItems([])); }, [userId]);
  return <><section className="page-intro"><p className="eyebrow">GURU / JADWAL SAYA</p><h1>Jam mengajar <em>yang terarah.</em></h1><p>Jadwal ini dikelola administrator dan tersinkron dengan siswa.</p></section>{items.length === 0 ? <div className="empty-workspace"><div className="empty-icon"><Gauge size={22} /></div><h2>Belum ada jadwal mengajar.</h2></div> : <div className="schedule-grid">{items.map((item) => <article className="schedule-card" key={item.id}><div className="schedule-card-head"><div><p className="eyebrow">{item.hari}</p><h2>{item.nama_pelajaran}</h2><span>Kelas {item.kelas} · {item.jam_mulai}–{item.jam_selesai}{item.ruang ? ` · ${item.ruang}` : ''}</span></div><strong>{item.terdaftar}/{item.kapasitas}</strong></div></article>)}</div>}</>;
}

function StudentSchedulePanel({ studentId }: { studentId: number }) {
  const [groups, setGroups] = useState<ScheduleGroup[]>([]);
  const [activeCourse, setActiveCourse] = useState<number | null>(null);
  const [form, setForm] = useState({ judul: '', deskripsi: '' });
  const [notice, setNotice] = useState('');
  const load = () => get<ScheduleGroup[]>(`/students/${studentId}/schedule`).then(setGroups).catch(() => setNotice('Jadwal belum dapat dimuat.'));
  useEffect(() => { load(); }, [studentId]);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (!activeCourse) return; const response = await fetch(`${API}/proposals`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ siswaId: studentId, mataPelajaranId: activeCourse, ...form }) }); const data = await response.json(); if (!response.ok) return setNotice(data.message ?? 'Proposal gagal diajukan.'); setNotice('Proposal berhasil diajukan ke guru.'); setForm({ judul: '', deskripsi: '' }); setActiveCourse(null); load(); };
  return <><section className="page-intro"><p className="eyebrow">JADWAL SAYA / TEAM</p><h1>Ritme belajar <em>yang kamu pilih.</em></h1><p>Program, rekan Team, dan proposal kegiatan yang sedang berjalan.</p></section>{notice && <div className="notice"><Check size={16} /> {notice}</div>}{groups.length === 0 && <div className="empty-workspace"><div className="empty-icon"><CalendarIcon /></div><h2>Belum ada jadwal.</h2><p>Pilih program terlebih dahulu untuk membentuk Team dan mengajukan proposal.</p></div>}<div className="schedule-grid">{groups.map((group) => <article className="schedule-card" key={group.id}><div className="schedule-card-head"><div><p className="eyebrow">{group.hari ?? 'JADWAL BELUM DIATUR'}</p><h2>{group.nama_pelajaran}</h2><span>Kelas {group.kelas} · Guru: {group.guru}{group.jam_mulai ? ` · ${group.jam_mulai}–${group.jam_selesai}` : ''}{group.ruang ? ` · ${group.ruang}` : ''}</span></div><strong>{group.terdaftar}/{group.kapasitas}</strong></div><div className="schedule-team"><b>Team kamu</b><div className="schedule-members">{group.team.map((member) => <span className="team-member" key={member.id}><span className="tiny-avatar">{member.nama.split(' ').map((part) => part[0]).join('')}</span>{member.nama}</span>)}</div></div><div className="proposal-list"><div className="proposal-list-title"><b>Proposal program</b><button className="text-button" onClick={() => { setActiveCourse(group.id); setForm({ judul: '', deskripsi: '' }); }}>+ Ajukan proposal</button></div>{group.proposals.length === 0 ? <small>Belum ada proposal untuk Team ini.</small> : group.proposals.map((proposal) => <div className="proposal-item" key={proposal.id}><div><strong>{proposal.judul}</strong><small>Diajukan oleh {proposal.pengusul}</small></div><span className={`proposal-status ${proposal.status}`}>{proposal.status}</span>{proposal.feedback && <p>{proposal.feedback}</p>}</div>)}</div>{activeCourse === group.id && <form className="proposal-form" onSubmit={submit}><input required placeholder="Judul proposal" value={form.judul} onChange={(event) => setForm({ ...form, judul: event.target.value })} /><textarea required rows={4} placeholder="Jelaskan kegiatan yang ingin Team laksanakan" value={form.deskripsi} onChange={(event) => setForm({ ...form, deskripsi: event.target.value })} /><div className="proposal-form-actions"><button type="button" className="text-button" onClick={() => setActiveCourse(null)}>Batal</button><button className="dark-button">Kirim ke guru <ArrowRight size={15} /></button></div></form>}</article>)}</div></>;
}

function CalendarIcon() { return <span className="calendar-icon">J</span>; }

function StudentTeamPanel({ studentId, studentClass }: { studentId: number; studentClass: string }) {
  const [groups, setGroups] = useState<TeamGroup[]>([]);
  const [notice, setNotice] = useState('');
  useEffect(() => { get<TeamGroup[]>(`/students/${studentId}/team`).then(setGroups).catch(() => setNotice('Data Team belum dapat dimuat.')); }, [studentId]);
  return <><section className="page-intro"><p className="eyebrow">TEAM / KELAS {studentClass}</p><h1>Belajar bersama, <em>lebih hidup.</em></h1><p>Temui rekan siswa yang berada di ruang belajar yang sama denganmu.</p></section>{notice && <div className="notice">{notice}</div>}{groups.length === 0 && !notice && <div className="empty-workspace"><div className="empty-icon"><Users size={22} /></div><h2>Belum ada Team.</h2><p>Daftar program dari menu Pilih program untuk mulai menemukan rekan belajar.</p></div>}<div className="team-grid">{groups.map((group) => <article className="team-card" key={group.id}><div className="team-card-top"><div><p className="eyebrow">PROGRAM SLC</p><h2>{group.nama_pelajaran}</h2></div><span className={group.terdaftar >= group.kapasitas ? 'team-full' : 'team-open'}>{group.terdaftar >= group.kapasitas ? 'TERISI PENUH' : 'MASIH TERSEDIA'}</span></div><div className="team-meta"><span>Kelas {group.kelas}</span><strong>{group.terdaftar}/{group.kapasitas} anggota</strong></div><div className="team-members">{group.anggota.map((member) => <div className="team-member" key={member.id}><div className="avatar team-avatar">{member.foto_profil ? <img src={member.foto_profil} alt={`Foto ${member.nama}`} /> : userInitials(member.nama)}</div><span>{member.id === studentId ? `${member.nama} (kamu)` : member.nama}</span></div>)}</div><div className="team-capacity"><span>{group.terdaftar >= group.kapasitas ? 'Semua kursi sudah terisi.' : `${group.kapasitas - group.terdaftar} kursi masih tersedia.`}</span><div className="team-progress"><i style={{ width: `${Math.min(100, group.terdaftar / group.kapasitas * 100)}%` }} /></div></div></article>)}</div></>;
}

function AdminCreateUserPanel({ filterRole }: { filterRole: 'guru' | 'siswa' }) { const [classes, setClasses] = useState<ClassRecord[]>([]); const [form, setForm] = useState({ nama: '', username: '', email: '', kelas: '', password: 'demo' }); const [notice, setNotice] = useState(''); useEffect(() => { get<ClassRecord[]>('/classes').then((items) => { setClasses(items); if (items[0]) setForm((current) => ({ ...current, kelas: items[0].nama_kelas })); }).catch(() => setNotice('Data kelas belum dapat dimuat.')); }, []); const create = async (event: React.FormEvent) => { event.preventDefault(); const response = await fetch(`${API}/users`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, role: filterRole }) }); const data = await response.json(); setNotice(response.ok ? 'Data berhasil ditambahkan.' : data.message ?? 'Data gagal ditambahkan.'); if (response.ok) setForm({ nama: '', username: '', email: '', kelas: classes[0]?.nama_kelas ?? '', password: 'demo' }); }; const importFile = async (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; try { const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' }); const sheet = workbook.Sheets[workbook.SheetNames[0]]; const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet); const siswa = rows.map((row) => ({ nama: row.nama ?? row.Nama ?? row['Nama Siswa'], email: row.email ?? row.Email, kelas: row.kelas ?? row.Kelas ?? row['Kelas Siswa'], password: row.password || 'demo' })).filter((row) => row.nama && row.email && row.kelas); if (!siswa.length) { setNotice('Tidak ada baris siswa yang valid. Isi kolom nama, email, dan kelas.'); return; } const response = await fetch(`${API}/users/import`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ siswa }) }); const data = await response.json(); setNotice(response.ok ? `${data.imported} data siswa berhasil diimpor.` : data.message ?? 'Import gagal.'); } catch { setNotice('File tidak dapat dibaca. Gunakan format XLS atau XLSX.'); } finally { event.target.value = ''; } }; const downloadTemplate = () => { const rows = classes.map((item) => ({ nama: '', username: '', email: '', kelas: item.nama_kelas, password: 'demo' })); const worksheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ nama: '', username: '', email: '', kelas: '', password: 'demo' }]); worksheet['!cols'] = [{ wch: 28 }, { wch: 20 }, { wch: 34 }, { wch: 24 }, { wch: 16 }]; const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Siswa'); XLSX.writeFile(workbook, 'template-import-siswa.xlsx'); }; return <section className="admin-create-block"><div className="admin-create-heading"><div><p className="eyebrow">AKSI ADMINISTRATOR</p><h2>Tambah {filterRole === 'guru' ? 'guru' : 'siswa'}</h2></div></div><form className="admin-form compact-create-form" onSubmit={create}><div className="form-row"><input required placeholder="Nama lengkap" value={form.nama} onChange={(event) => setForm({ ...form, nama: event.target.value })} /><input required placeholder="Username" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} /></div><div className="form-row"><input required type="email" placeholder="Email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /><select required value={form.kelas} onChange={(event) => setForm({ ...form, kelas: event.target.value })}>{classes.map((item) => <option value={item.nama_kelas} key={item.id}>{item.nama_kelas}</option>)}</select></div><button className="dark-button" type="submit"><UserPlus size={16} /> Tambah data</button></form>{filterRole === 'siswa' && <div className="admin-form import-form"><h3>Import Data Siswa</h3><p>Gunakan template dengan kolom <b>nama</b>, <b>email</b>, <b>kelas</b>, dan <b>password</b>.</p><div className="import-actions"><button type="button" className="dark-button" onClick={downloadTemplate}><XLSXIcon /> Unduh Template</button><label className="file-button"><XLSXIcon /> Import Data Siswa<input type="file" accept=".xls,.xlsx" onChange={importFile} /></label></div><small>Username dibuat dari bagian awal email. Email yang sama akan diperbarui.</small></div>}{notice && <div className="notice"><Check size={16} /> {notice}</div>}</section>; }

function AdminCreateClassPanel() { const [name, setName] = useState(''); const [notice, setNotice] = useState(''); const create = async (event: React.FormEvent) => { event.preventDefault(); const response = await fetch(`${API}/classes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ namaKelas: name }) }); const data = await response.json(); setNotice(response.ok ? 'Kelas berhasil ditambahkan.' : data.message ?? 'Kelas gagal ditambahkan.'); if (response.ok) setName(''); }; return <section className="admin-create-block"><div className="admin-create-heading"><div><p className="eyebrow">AKSI ADMINISTRATOR</p><h2>Tambah kelas</h2></div></div><form className="admin-form compact-create-form" onSubmit={create}><input required placeholder="Contoh: Kelas IX Sion 1 / Kelas IX Sion 2" value={name} onChange={(event) => setName(event.target.value)} /><button className="dark-button" type="submit"><GraduationCap size={16} /> Tambah kelas</button></form>{notice && <div className="notice"><Check size={16} /> {notice}</div>}</section>; }

function AdminCreateCoursePanel() { const [teachers, setTeachers] = useState<UserRecord[]>([]); const [classes, setClasses] = useState<ClassRecord[]>([]); const [form, setForm] = useState({ namaPelajaran: '', deskripsi: '', guruId: 0, kapasitas: 3, kelas: '' }); const [notice, setNotice] = useState(''); useEffect(() => { get<UserRecord[]>('/users?role=guru').then((items) => { setTeachers(items); if (items[0]) setForm((current) => ({ ...current, guruId: items[0].id })); }).catch(() => setNotice('Data guru belum dapat dimuat.')); get<ClassRecord[]>('/classes').then((items) => { setClasses(items); if (items[0]) setForm((current) => ({ ...current, kelas: items[0].nama_kelas })); }).catch(() => setNotice('Data kelas belum dapat dimuat.')); }, []); const create = async (event: React.FormEvent) => { event.preventDefault(); const response = await fetch(`${API}/courses`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }); const data = await response.json(); setNotice(response.ok ? 'Mata pelajaran berhasil ditambahkan.' : data.message ?? 'Mata pelajaran gagal ditambahkan.'); if (response.ok) setForm({ namaPelajaran: '', deskripsi: '', guruId: teachers[0]?.id ?? 0, kapasitas: 3, kelas: classes[0]?.nama_kelas ?? '' }); }; return <section className="admin-create-block"><div className="admin-create-heading"><div><p className="eyebrow">AKSI ADMINISTRATOR</p><h2>Tambah mata pelajaran</h2></div></div><form className="course-admin-form compact-course-form" onSubmit={create}><input required placeholder="Nama mata pelajaran" value={form.namaPelajaran} onChange={(event) => setForm({ ...form, namaPelajaran: event.target.value })} /><input required placeholder="Deskripsi singkat" value={form.deskripsi} onChange={(event) => setForm({ ...form, deskripsi: event.target.value })} /><select required value={form.guruId} onChange={(event) => setForm({ ...form, guruId: Number(event.target.value) })}>{teachers.map((teacher) => <option value={teacher.id} key={teacher.id}>{teacher.nama}</option>)}</select><select required value={form.kelas} onChange={(event) => setForm({ ...form, kelas: event.target.value })}>{classes.map((item) => <option value={item.nama_kelas} key={item.id}>{item.nama_kelas}</option>)}</select><button className="dark-button" type="submit"><BookOpen size={16} /> Tambah mapel</button></form>{notice && <div className="notice"><Check size={16} /> {notice}</div>}</section>; }

function AdminUsersEditPanel({ filterRole }: { filterRole: 'guru' | 'siswa' }) {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<UserRecord | null>(null);
  const [form, setForm] = useState({ nama: '', username: '', email: '', kelas: 'X-A', password: 'demo' });
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState('');
  const load = () => get<UserRecord[]>(`/users?role=${filterRole}`).then(setUsers).catch(() => setNotice('Data pengguna belum dapat dimuat.'));
  useEffect(() => { load(); get<ClassRecord[]>('/classes').then(setClasses).catch(() => setNotice('Data kelas belum dapat dimuat.')); setPage(1); }, [filterRole]);
  const save = async (event: React.FormEvent) => { event.preventDefault(); if (!editing) return; const response = await fetch(`${API}/users/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nama: editing.nama, username: editing.username, email: editing.email, role: editing.role, kelas: editing.kelas, password: password || undefined }) }); const data = await response.json(); if (!response.ok) return setNotice(data.message ?? 'Perubahan gagal disimpan.'); setNotice('Data berhasil diperbarui.'); setEditing(null); setPassword(''); load(); };
  const create = async (event: React.FormEvent) => { event.preventDefault(); const response = await fetch(`${API}/users`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, role: filterRole }) }); const data = await response.json(); if (!response.ok) return setNotice(data.message ?? 'Data gagal ditambahkan.'); setNotice('Data berhasil ditambahkan.'); setForm({ nama: '', username: '', email: '', kelas: 'X-A', password: 'demo' }); load(); };
  const remove = async (user: UserRecord) => { if (!window.confirm(`Hapus data ${user.nama}?`)) return; const response = await fetch(`${API}/users/${user.id}`, { method: 'DELETE' }); setNotice(response.ok ? 'Data berhasil dihapus.' : 'Data tidak dapat dihapus.'); load(); };
  const title = filterRole === 'guru' ? 'Data guru' : 'Data siswa';
  const pageSize = 5; const pageCount = Math.max(1, Math.ceil(users.length / pageSize)); const visibleUsers = users.slice((page - 1) * pageSize, page * pageSize);
  return <><section className="page-intro"><p className="eyebrow">ADMIN / {title.toUpperCase()}</p><h1>{title} <em>SLC.</em></h1><p>Edit informasi akun yang sudah terdaftar atau hapus data yang tidak digunakan.</p></section>{notice && <div className="notice"><Check size={16} /> {notice}</div>}<div className="user-table"><div className="user-table-head"><span>Nama</span><span>Username</span><span>Email</span><span>Kelas</span><span>Aksi</span></div>{visibleUsers.map((user) => <div className="user-table-row" key={user.id}><strong>{user.nama}</strong><span>{user.username}</span><span>{user.email}</span><span>{user.kelas ?? '-'}</span><span className="row-actions"><button className="edit-button" onClick={() => setEditing({ ...user })}><Pencil size={14} /> Edit</button><button className="delete-button" onClick={() => remove(user)} aria-label={`Hapus ${user.nama}`}><X size={15} /></button></span></div>)}</div><Pagination page={page} pageCount={pageCount} onChange={setPage} />{editing && <div className="inline-edit-backdrop"><form className="inline-edit-form" onSubmit={save}><div className="utility-header"><div><p className="eyebrow">EDIT DATA</p><h2>{editing.nama}</h2></div><button type="button" className="icon-button" onClick={() => setEditing(null)}><X size={20} /></button></div><input required placeholder="Nama lengkap" value={editing.nama} onChange={(event) => setEditing({ ...editing, nama: event.target.value })} /><input required placeholder="Username" value={editing.username} onChange={(event) => setEditing({ ...editing, username: event.target.value })} /><input required type="email" placeholder="Email" value={editing.email} onChange={(event) => setEditing({ ...editing, email: event.target.value })} /><select required aria-label="Kelas" value={editing.kelas ?? ''} onChange={(event) => setEditing({ ...editing, kelas: event.target.value || null })}>{!editing.kelas && <option value="">Pilih kelas</option>}{editing.kelas && !classes.some((item) => item.nama_kelas === editing.kelas) && <option value={editing.kelas}>{editing.kelas}</option>}{classes.map((item) => <option value={item.nama_kelas} key={item.id}>{item.nama_kelas}</option>)}</select><input type="password" placeholder="Password baru (opsional)" value={password} onChange={(event) => setPassword(event.target.value)} /><button className="login-button">Simpan perubahan <Check size={16} /></button></form></div>}</>;
}

function Pagination({ page, pageCount, onChange }: { page: number; pageCount: number; onChange: (page: number) => void }) { return <div className="pagination"><button disabled={page === 1} onClick={() => onChange(page - 1)}>Sebelumnya</button><span>Halaman {page} dari {pageCount}</span><button disabled={page === pageCount} onClick={() => onChange(page + 1)}>Berikutnya</button></div>; }

function AdminClassesEditPanel() {
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [editing, setEditing] = useState<ClassRecord | null>(null);
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState('');
  const load = () => get<ClassRecord[]>('/classes').then(setClasses).catch(() => setNotice('Data kelas belum dapat dimuat.'));
  useEffect(() => { load(); }, []);
  const save = async (event: React.FormEvent) => { event.preventDefault(); if (!editing) return; const response = await fetch(`${API}/classes/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ namaKelas: editing.nama_kelas }) }); const data = await response.json(); if (!response.ok) return setNotice(data.message ?? 'Perubahan gagal disimpan.'); setNotice('Data kelas berhasil diperbarui.'); setEditing(null); load(); };
  const remove = async (item: ClassRecord) => { if (!window.confirm(`Hapus kelas ${item.nama_kelas}?`)) return; const response = await fetch(`${API}/classes/${item.id}`, { method: 'DELETE' }); setNotice(response.ok ? 'Kelas berhasil dihapus.' : 'Kelas tidak dapat dihapus.'); load(); };
  const pageSize = 6; const pageCount = Math.max(1, Math.ceil(classes.length / pageSize)); const visibleClasses = classes.slice((page - 1) * pageSize, page * pageSize);
  return <><section className="page-intro"><p className="eyebrow">ADMIN / DATA KELAS</p><h1>Kelola <em>kelas.</em></h1><p>Edit nama kelas tanpa kehilangan data siswa dan program yang sudah terhubung.</p></section>{notice && <div className="notice"><Check size={16} /> {notice}</div>}<div className="class-admin-grid">{visibleClasses.map((item) => <div className="class-admin-card" key={item.id}><div className="class-icon"><GraduationCap size={19} /></div><div><strong>{item.nama_kelas}</strong><small>{item.jumlah_siswa} siswa · {item.jumlah_program} program</small></div><span className="row-actions"><button className="edit-button" onClick={() => setEditing({ ...item })}><Pencil size={14} /> Edit</button><button className="delete-button" onClick={() => remove(item)} aria-label={`Hapus kelas ${item.nama_kelas}`}><X size={15} /></button></span></div>)}</div><Pagination page={page} pageCount={pageCount} onChange={setPage} />{editing && <div className="inline-edit-backdrop"><form className="inline-edit-form" onSubmit={save}><div className="utility-header"><div><p className="eyebrow">EDIT KELAS</p><h2>{editing.nama_kelas}</h2></div><button type="button" className="icon-button" onClick={() => setEditing(null)}><X size={20} /></button></div><input required value={editing.nama_kelas} onChange={(event) => setEditing({ ...editing, nama_kelas: event.target.value })} /><button className="login-button">Simpan perubahan <Check size={16} /></button></form></div>}</>;
}

function AdminCoursesEditPanel({ courses }: { courses: Course[] }) {
  const [items, setItems] = useState(courses);
  const [page, setPage] = useState(1);
  const [teachers, setTeachers] = useState<UserRecord[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [editing, setEditing] = useState<Course | null>(null);
  const [notice, setNotice] = useState('');
  useEffect(() => { setItems(courses); get<UserRecord[]>('/users?role=guru').then(setTeachers).catch(() => setNotice('Data guru belum dapat dimuat.')); get<ClassRecord[]>('/classes').then(setClasses).catch(() => setNotice('Data kelas belum dapat dimuat.')); }, [courses]);
  const importFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet);
      const mataPelajaran = rows.map((row) => ({
        namaPelajaran: String(row.nama_pelajaran ?? row.nama ?? row['Nama Mata Pelajaran'] ?? '').trim(),
        deskripsi: String(row.deskripsi ?? row.Deskripsi ?? '').trim(),
        guru: String(row.guru ?? row.Guru ?? row['Guru Pengampu'] ?? '').trim(),
        kapasitas: Number(row.kapasitas ?? row.Kapasitas ?? 3),
        kelas: String(row.kelas ?? row.Kelas ?? '').trim(),
      }));
      if (!mataPelajaran.length || mataPelajaran.some((item) => !item.namaPelajaran || !item.deskripsi || !item.guru || !item.kelas || !Number.isInteger(item.kapasitas) || item.kapasitas < 1)) {
        setNotice('File tidak valid. Isi nama_pelajaran, deskripsi, guru, kapasitas (minimal 1), dan kelas pada setiap baris.');
        return;
      }
      const response = await fetch(`${API}/courses/import`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mataPelajaran }) });
      const data = await response.json();
      if (!response.ok) { setNotice(data.message ?? 'Import mata pelajaran gagal.'); return; }
      setItems((current) => [...current, ...data.mataPelajaran]);
      setNotice(`${data.imported} mata pelajaran berhasil diimpor.`);
    } catch {
      setNotice('File tidak dapat dibaca. Gunakan format XLS atau XLSX.');
    } finally {
      event.target.value = '';
    }
  };
  const downloadTemplate = () => {
    const worksheet = XLSX.utils.json_to_sheet([{ nama_pelajaran: '', deskripsi: '', guru: teachers[0]?.username ?? '', kapasitas: 3, kelas: classes[0]?.nama_kelas ?? '' }]);
    worksheet['!cols'] = [{ wch: 28 }, { wch: 58 }, { wch: 24 }, { wch: 12 }, { wch: 26 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Mata Pelajaran');
    XLSX.writeFile(workbook, 'template-import-mata-pelajaran.xlsx');
  };
  const cancelAllBookings = async () => {
    if (!window.confirm('Batalkan seluruh booking siswa? Semua pendaftaran aktif akan dihapus dan siswa harus melakukan booking ulang.')) return;
    const response = await fetch(`${API}/bookings`, { method: 'DELETE' });
    const data = await response.json();
    if (!response.ok) { setNotice(data.message ?? 'Seluruh booking gagal dibatalkan.'); return; }
    setItems((current) => current.map((item) => ({ ...item, terdaftar: 0 })));
    setNotice(`${data.cancelled} booking siswa berhasil dibatalkan.`);
  };
  const save = async (event: React.FormEvent) => { event.preventDefault(); if (!editing) return; const response = await fetch(`${API}/courses/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ namaPelajaran: editing.nama_pelajaran.trim(), deskripsi: editing.deskripsi.trim(), guruId: Number(editing.guru_id), kapasitas: Number(editing.kapasitas), kelas: editing.kelas.trim() }) }); const data = await response.json(); if (!response.ok) return setNotice(data.message ?? 'Perubahan gagal disimpan.'); setNotice('Mata pelajaran berhasil diperbarui.'); setEditing(null); setItems(items.map((item) => item.id === data.id ? { ...item, ...data, guru: teachers.find((teacher) => teacher.id === data.guru_id)?.nama ?? item.guru } : item)); };
  const remove = async (course: Course) => { if (!window.confirm(`Hapus mata pelajaran ${course.nama_pelajaran}?`)) return; const response = await fetch(`${API}/courses/${course.id}`, { method: 'DELETE' }); setNotice(response.ok ? 'Mata pelajaran berhasil dihapus.' : 'Mata pelajaran tidak dapat dihapus.'); if (response.ok) setItems(items.filter((item) => item.id !== course.id)); };
  const pageSize = 6; const pageCount = Math.max(1, Math.ceil(items.length / pageSize)); const visibleItems = items.slice((page - 1) * pageSize, page * pageSize);
  return <><section className="page-intro"><p className="eyebrow">ADMIN / DATA MATA PELAJARAN</p><h1>Edit mata <em>pelajaran.</em></h1><p>Perbarui nama, deskripsi, kapasitas, kelas, dan guru pengampu.</p></section><div className="admin-form import-form"><h3>Import mata pelajaran</h3><p>Gunakan template dengan kolom <b>nama_pelajaran</b>, <b>deskripsi</b>, <b>guru</b>, <b>kapasitas</b>, dan <b>kelas</b>.</p><div className="import-actions"><button type="button" className="dark-button" onClick={downloadTemplate}><XLSXIcon /> Unduh template</button><label className="file-button"><XLSXIcon /> Import mata pelajaran<input type="file" accept=".xls,.xlsx" onChange={importFile} /></label></div><small>Kolom guru dapat diisi nama, username, atau email guru. Kelas harus sesuai data kelas yang tersedia.</small></div><div className="admin-form import-form"><h3>Reset booking siswa</h3><p>Hapus seluruh booking siswa agar proses pendaftaran dapat dimulai kembali setelah perubahan mata pelajaran.</p><button type="button" className="reject-button" onClick={cancelAllBookings}>Batalkan seluruh booking</button></div>{notice && <div className="notice"><Check size={16} /> {notice}</div>}<div className="program-report">{visibleItems.map((course) => <div className="program-report-row" key={course.id}><span className="report-course-number">0{course.id}</span><strong>{course.nama_pelajaran}</strong><span>{course.guru}</span><b>Kelas {course.kelas}</b><span className="row-actions"><button className="edit-button" onClick={() => setEditing({ ...course })}><Pencil size={14} /> Edit</button><button className="delete-button" onClick={() => remove(course)} aria-label={`Hapus ${course.nama_pelajaran}`}><X size={15} /></button></span></div>)}</div><Pagination page={page} pageCount={pageCount} onChange={setPage} />{editing && <div className="inline-edit-backdrop"><form className="inline-edit-form" onSubmit={save}><div className="utility-header"><div><p className="eyebrow">EDIT MATA PELAJARAN</p><h2>{editing.nama_pelajaran}</h2></div><button type="button" className="icon-button" onClick={() => setEditing(null)}><X size={20} /></button></div><input required value={editing.nama_pelajaran} onChange={(event) => setEditing({ ...editing, nama_pelajaran: event.target.value })} /><textarea required rows={4} value={editing.deskripsi} onChange={(event) => setEditing({ ...editing, deskripsi: event.target.value })} /><div className="form-row"><select value={editing.guru_id} onChange={(event) => setEditing({ ...editing, guru_id: Number(event.target.value) })}>{teachers.map((teacher) => <option value={teacher.id} key={teacher.id}>{teacher.nama}</option>)}</select><input required type="number" min="1" value={editing.kapasitas} onChange={(event) => setEditing({ ...editing, kapasitas: Number(event.target.value) })} /></div><select required value={editing.kelas} onChange={(event) => setEditing({ ...editing, kelas: event.target.value })}>{!classes.some((item) => item.nama_kelas === editing.kelas) && <option value={editing.kelas}>{editing.kelas} (data lama)</option>}{classes.map((item) => <option value={item.nama_kelas} key={item.id}>{item.nama_kelas}</option>)}</select><button className="login-button">Simpan perubahan <Check size={16} /></button></form></div>}</>;
}

function AdminUsersPanel({ filterRole }: { filterRole?: 'guru' | 'siswa' } = {}) {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [form, setForm] = useState({ nama: '', email: '', password: 'demo', role: 'siswa' as Role, kelas: 'X-A' });
  const [notice, setNotice] = useState('');
  const load = () => get<UserRecord[]>(filterRole ? `/users?role=${filterRole}` : '/users').then(setUsers).catch(() => setNotice('Data pengguna belum dapat dimuat.'));
  useEffect(() => { load(); if (filterRole === 'siswa') get<ClassRecord[]>('/classes').then(setClasses).catch(() => setNotice('Data kelas belum dapat dimuat.')); }, []);
  const create = async (event: React.FormEvent) => { event.preventDefault(); const response = await fetch(`${API}/users`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, role: filterRole ?? form.role }) }); const data = await response.json(); if (!response.ok) return setNotice(data.message ?? 'Akun gagal dibuat.'); setNotice('Akun berhasil ditambahkan.'); setForm({ nama: '', email: '', password: 'demo', role: 'siswa', kelas: 'X-A' }); load(); };
  const remove = async (id: number) => { const response = await fetch(`${API}/users/${id}`, { method: 'DELETE' }); setNotice(response.ok ? 'Akun berhasil dihapus.' : 'Akun tidak dapat dihapus.'); load(); };
  const importFile = async (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' }); const rows = XLSX.utils.sheet_to_json<Record<string, string>>(workbook.Sheets[workbook.SheetNames[0]]); const siswa = rows.map((row) => ({ nama: row.nama ?? row.Nama ?? row['Nama Siswa'], email: row.email ?? row.Email, kelas: row.kelas ?? row.Kelas ?? row['Kelas Siswa'], password: row.password ?? 'demo' })).filter((row) => row.nama && row.email && row.kelas); const response = await fetch(`${API}/users/import`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ siswa }) }); const data = await response.json(); setNotice(response.ok ? `${data.imported} data siswa berhasil diimpor.` : data.message ?? 'Import gagal.'); load(); event.target.value = ''; };
  const downloadTemplate = () => { const rows = classes.map((item) => ({ nama: '', email: '', kelas: item.nama_kelas, password: 'demo' })); const worksheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ nama: '', email: '', kelas: '', password: 'demo' }]); worksheet['!cols'] = [{ wch: 28 }, { wch: 34 }, { wch: 24 }, { wch: 16 }]; const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Siswa'); XLSX.writeFile(workbook, 'template-import-siswa.xlsx'); };
  const title = filterRole === 'guru' ? 'Data guru' : filterRole === 'siswa' ? 'Data siswa' : 'Data pengguna';
  return <><section className="page-intro"><p className="eyebrow">ADMIN / {title.toUpperCase()}</p><h1>{title} <em>SLC.</em></h1><p>{filterRole === 'siswa' ? 'Tambah, impor, atau hapus data siswa.' : filterRole === 'guru' ? 'Kelola tim guru yang mengajar di SLC.' : 'Kelola akun kepala sekolah dan administrator.'}</p></section><div className="admin-form-grid"><form className="admin-form" onSubmit={create}><h3>Tambah {filterRole === 'guru' ? 'guru' : filterRole === 'siswa' ? 'siswa' : 'akun'}</h3><input required placeholder="Nama lengkap" value={form.nama} onChange={(event) => setForm({ ...form, nama: event.target.value })} /><input required type="email" placeholder="Alamat email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /><div className="form-row"><select value={filterRole ?? form.role} disabled={Boolean(filterRole)} onChange={(event) => setForm({ ...form, role: event.target.value as Role })}><option value="siswa">Siswa</option><option value="guru">Guru</option><option value="kepala_sekolah">Kepala sekolah</option></select>{filterRole === 'siswa' ? <select required value={form.kelas} onChange={(event) => setForm({ ...form, kelas: event.target.value })}><option value="">Pilih kelas</option>{classes.map((item) => <option value={item.nama_kelas} key={item.id}>{item.nama_kelas}</option>)}</select> : <input placeholder="Kelas" value={form.kelas} onChange={(event) => setForm({ ...form, kelas: event.target.value })} />}</div><button className="dark-button" type="submit"><UserPlus size={16} /> Tambah data</button></form>{filterRole === 'siswa' && <div className="admin-form import-form"><h3>Impor siswa dari XLS</h3><p>Kolom wajib: <b>nama</b>, <b>email</b>, dan <b>kelas</b>.</p><div className="import-actions"><button type="button" className="dark-button" onClick={downloadTemplate}><XLSXIcon /> Unduh template</button><label className="file-button"><XLSXIcon /> Pilih file XLS/XLSX<input type="file" accept=".xls,.xlsx" onChange={importFile} /></label></div><small>Isi nama, email, dan kelas pada template. Password kosong akan memakai <b>demo</b>; email yang sama akan diperbarui.</small></div>}</div>{notice && <div className="notice"><Check size={16} /> {notice}</div>}<div className="user-table"><div className="user-table-head"><span>Nama</span><span>Email</span><span>Peran</span><span>Kelas</span><span /></div>{users.map((user) => <div className="user-table-row" key={user.id}><strong>{user.nama}</strong><span>{user.email}</span><span className="role-badge">{user.role.replace('_', ' ')}</span><span>{user.kelas ?? '-'}</span><button className="delete-button" onClick={() => remove(user.id)} aria-label={`Hapus ${user.nama}`}><X size={15} /></button></div>)}</div></>;
}

function AdminPagesPanel({ initialPages }: { initialPages: Pages }) {
  const [pages, setPages] = useState<Pages>(initialPages);
  const [active, setActive] = useState<keyof Pages>('home');
  const [notice, setNotice] = useState('');
  const page = pages[active];
  useEffect(() => { get<Partial<Pages>>('/pages').then((data) => setPages({ ...defaultPages, ...data } as Pages)).catch(() => undefined); }, []);
  const update = (key: keyof PageContent, value: string) => setPages((current) => ({ ...current, [active]: { ...current[active], [key]: value } }));
  const save = async (event: React.FormEvent) => { event.preventDefault(); const response = await fetch(`${API}/pages`, { method: 'PUT', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(pages) }); const data = await response.json(); setNotice(response.ok ? 'Konten halaman berhasil disimpan.' : data.message ?? 'Konten halaman gagal disimpan.'); if (response.ok) window.dispatchEvent(new Event('clc-settings-updated')); };
  return <><section className="page-intro"><p className="eyebrow">ADMIN / PAGES</p><h1>Edit <em>halaman publik.</em></h1><p>Ubah judul, deskripsi, dan teks utama Homepage, About SLC, About School, serta Program.</p></section><div className="page-editor-tabs">{(['home', 'profil', 'sekolah', 'program'] as const).map((key) => <button type="button" className={active === key ? 'active' : ''} key={key} onClick={() => setActive(key)}>{key === 'home' ? 'Homepage' : key === 'profil' ? 'About SLC' : key === 'sekolah' ? 'About School' : 'Program'}</button>)}</div><form className="page-editor-form" onSubmit={save}><label>Judul halaman<textarea rows={2} required value={page.title} onChange={(event) => update('title', event.target.value)} /></label><label>Deskripsi pembuka<textarea rows={4} required value={page.intro} onChange={(event) => update('intro', event.target.value)} /></label><label>Judul section utama<textarea rows={2} required value={page.sectionTitle} onChange={(event) => update('sectionTitle', event.target.value)} /></label><label>Isi section utama<textarea rows={5} required value={page.sectionText} onChange={(event) => update('sectionText', event.target.value)} /></label><button className="login-button">Simpan halaman <Check size={16} /></button></form>{notice && <div className="notice"><Check size={16} /> {notice}</div>}</>;
}

function AdminClassesPanel() {
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [name, setName] = useState('');
  const [notice, setNotice] = useState('');
  const load = () => get<ClassRecord[]>('/classes').then(setClasses).catch(() => setNotice('Data kelas belum dapat dimuat.'));
  useEffect(() => { load(); }, []);
  const create = async (event: React.FormEvent) => { event.preventDefault(); const response = await fetch(`${API}/classes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ namaKelas: name }) }); const data = await response.json(); if (!response.ok) return setNotice(data.message ?? 'Kelas gagal dibuat.'); setName(''); setNotice('Kelas berhasil ditambahkan.'); load(); };
  const remove = async (id: number) => { const response = await fetch(`${API}/classes/${id}`, { method: 'DELETE' }); setNotice(response.ok ? 'Kelas berhasil dihapus.' : 'Kelas tidak dapat dihapus.'); load(); };
  return <><section className="page-intro"><p className="eyebrow">ADMIN / DATA KELAS</p><h1>Ruang untuk <em>bertumbuh.</em></h1><p>Buat dan kelola daftar kelas yang menjadi akses program SLC.</p></section><form className="admin-form class-create-form" onSubmit={create}><h3>Tambah kelas</h3><input required placeholder="Contoh: Kelas IX Sion 1 / Kelas IX Sion 2" value={name} onChange={(event) => setName(event.target.value)} /><button className="dark-button" type="submit"><GraduationCap size={16} /> Tambah kelas</button></form>{notice && <div className="notice"><Check size={16} /> {notice}</div>}<div className="class-admin-grid">{classes.map((item) => <div className="class-admin-card" key={item.id}><div className="class-icon"><GraduationCap size={19} /></div><div><strong>{item.nama_kelas}</strong><small>{item.jumlah_siswa} siswa · {item.jumlah_program} program</small></div><button className="delete-button" onClick={() => remove(item.id)} aria-label={`Hapus kelas ${item.nama_kelas}`}><X size={15} /></button></div>)}</div></>;
}

function XLSXIcon() { return <span className="file-icon">XLS</span>; }

function AdminCoursesPanel({ courses }: { courses: Course[] }) {
  const [items, setItems] = useState(courses);
  const [teachers, setTeachers] = useState<UserRecord[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [form, setForm] = useState({ namaPelajaran: '', deskripsi: '', guruId: 5, kapasitas: 3, kelas: 'X-A' });
  const [notice, setNotice] = useState('');
  useEffect(() => { setItems(courses); get<UserRecord[]>('/users?role=guru').then(setTeachers).catch(() => setNotice('Data guru belum dapat dimuat.')); get<ClassRecord[]>('/classes').then(setClasses).catch(() => setNotice('Data kelas belum dapat dimuat.')); }, [courses]);
  const create = async (event: React.FormEvent) => { event.preventDefault(); const response = await fetch(`${API}/courses`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }); const data = await response.json(); if (!response.ok) return setNotice(data.message ?? 'Program gagal dibuat.'); setItems([...items, { ...data, guru: form.guruId === 5 ? 'Alya Putri' : 'Bima Santoso', terdaftar: 0 }]); setForm({ namaPelajaran: '', deskripsi: '', guruId: 5, kapasitas: 3, kelas: 'X-A' }); setNotice('Mata pelajaran berhasil dibuat.'); };
  const importFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet);
      const mataPelajaran = rows.map((row) => ({
        namaPelajaran: String(row.nama_pelajaran ?? row.nama ?? row['Nama Mata Pelajaran'] ?? '').trim(),
        deskripsi: String(row.deskripsi ?? row.Deskripsi ?? '').trim(),
        guru: String(row.guru ?? row.Guru ?? row['Guru Pengampu'] ?? '').trim(),
        kapasitas: Number(row.kapasitas ?? row.Kapasitas ?? 3),
        kelas: String(row.kelas ?? row.Kelas ?? '').trim(),
      }));
      if (!mataPelajaran.length || mataPelajaran.some((item) => !item.namaPelajaran || !item.deskripsi || !item.guru || !item.kelas || !Number.isInteger(item.kapasitas) || item.kapasitas < 1 || item.kapasitas > 3)) {
        setNotice('File tidak valid. Isi nama_pelajaran, deskripsi, guru, kapasitas (1-3), dan kelas pada setiap baris.');
        return;
      }
      const response = await fetch(`${API}/courses/import`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mataPelajaran }) });
      const data = await response.json();
      if (!response.ok) { setNotice(data.message ?? 'Import mata pelajaran gagal.'); return; }
      setItems((current) => [...current, ...data.mataPelajaran]);
      setNotice(`${data.imported} mata pelajaran berhasil diimpor.`);
    } catch {
      setNotice('File tidak dapat dibaca. Gunakan format XLS atau XLSX.');
    } finally {
      event.target.value = '';
    }
  };
  const downloadTemplate = () => {
    const worksheet = XLSX.utils.json_to_sheet([{ nama_pelajaran: '', deskripsi: '', guru: teachers[0]?.username ?? '', kapasitas: 3, kelas: classes[0]?.nama_kelas ?? '' }]);
    worksheet['!cols'] = [{ wch: 28 }, { wch: 58 }, { wch: 24 }, { wch: 12 }, { wch: 26 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Mata Pelajaran');
    XLSX.writeFile(workbook, 'template-import-mata-pelajaran.xlsx');
  };
  const cancelAllBookings = async () => {
    if (!window.confirm('Batalkan seluruh booking siswa? Semua pendaftaran aktif akan dihapus dan siswa harus melakukan booking ulang.')) return;
    const response = await fetch(`${API}/bookings`, { method: 'DELETE' });
    const data = await response.json();
    if (!response.ok) { setNotice(data.message ?? 'Seluruh booking gagal dibatalkan.'); return; }
    setItems((current) => current.map((item) => ({ ...item, terdaftar: 0 })));
    setNotice(`${data.cancelled} booking siswa berhasil dibatalkan.`);
  };
  const assignTeacher = async (course: Course, guruId: number) => { const response = await fetch(`${API}/courses/${course.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ namaPelajaran: course.nama_pelajaran, deskripsi: course.deskripsi, guruId, kapasitas: course.kapasitas, kelas: course.kelas }) }); const data = await response.json(); if (!response.ok) return setNotice(data.message ?? 'Penugasan guru gagal disimpan.'); const teacher = teachers.find((item) => item.id === guruId); setItems(items.map((item) => item.id === course.id ? { ...item, ...data, guru: teacher?.nama ?? item.guru } : item)); setNotice(`Guru ${teacher?.nama ?? ''} ditugaskan ke ${course.nama_pelajaran}.`); };
  const remove = async (id: number) => { const response = await fetch(`${API}/courses/${id}`, { method: 'DELETE' }); if (response.ok) { setItems(items.filter((item) => item.id !== id)); setNotice('Mata pelajaran berhasil dihapus.'); } };
  return <><section className="page-intro"><p className="eyebrow">ADMIN / DATA MATA PELAJARAN</p><h1>Bangun program <em>berikutnya.</em></h1><p>Buat mata pelajaran, tentukan kelas, lalu tugaskan guru pengampu.</p></section><form className="course-admin-form" onSubmit={create}><input required placeholder="Nama mata pelajaran" value={form.namaPelajaran} onChange={(event) => setForm({ ...form, namaPelajaran: event.target.value })} /><input required placeholder="Deskripsi singkat" value={form.deskripsi} onChange={(event) => setForm({ ...form, deskripsi: event.target.value })} /><select value={form.guruId} onChange={(event) => setForm({ ...form, guruId: Number(event.target.value) })}>{teachers.map((teacher) => <option value={teacher.id} key={teacher.id}>{teacher.nama}</option>)}</select><input required placeholder="Kelas" value={form.kelas} onChange={(event) => setForm({ ...form, kelas: event.target.value })} /><button className="dark-button" type="submit"><BookOpen size={16} /> Buat program</button></form><div className="admin-form import-form"><h3>Import mata pelajaran dari XLS</h3><p>Kolom wajib: <b>nama_pelajaran</b>, <b>deskripsi</b>, <b>guru</b>, <b>kapasitas</b>, dan <b>kelas</b>.</p><div className="import-actions"><button type="button" className="dark-button" onClick={downloadTemplate}><XLSXIcon /> Unduh template</button><label className="file-button"><XLSXIcon /> Import mata pelajaran<input type="file" accept=".xls,.xlsx" onChange={importFile} /></label></div><small>Kolom guru dapat diisi nama, username, atau email guru. Kelas harus sesuai data kelas yang tersedia.</small></div><div className="admin-form import-form"><h3>Reset booking siswa</h3><p>Hapus seluruh booking siswa agar proses pendaftaran dapat dimulai kembali setelah perubahan mata pelajaran.</p><button type="button" className="reject-button" onClick={cancelAllBookings}>Batalkan seluruh booking</button></div>{notice && <div className="notice"><Check size={16} /> {notice}</div>}<div className="program-report">{items.map((course) => { const SubjectIcon = getSubjectIcon(course.nama_pelajaran); return <div className="program-report-row" key={course.id}><span className="report-course-number subject-report-icon" aria-hidden="true"><SubjectIcon size={18} strokeWidth={1.8} /></span><strong>{course.nama_pelajaran}</strong><select className="assignment-select" value={course.guru_id} onChange={(event) => assignTeacher(course, Number(event.target.value))}>{teachers.map((teacher) => <option value={teacher.id} key={teacher.id}>{teacher.nama}</option>)}</select><b>{course.kelas}</b><button className="delete-button" onClick={() => remove(course.id)} aria-label={`Hapus ${course.nama_pelajaran}`}><X size={15} /></button></div>; })}</div></>;
}

function CourseCard({ course, index, booked, onBook }: { course: Course; index: number; booked: number[]; onBook: (course: Course) => void }) {
  const [, setClock] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const isBooked = booked.includes(course.id);
  const full = course.terdaftar >= course.kapasitas;
  const bookingLimitReached = !isBooked && booked.length >= 3;
  const now = Date.now();
  const beforeOpening = Boolean(course.booking_dibuka_at && now < parseBookingTime(course.booking_dibuka_at));
  const afterClosing = Boolean(course.booking_ditutup_at && now >= parseBookingTime(course.booking_ditutup_at));
  const bookingClosed = beforeOpening || afterClosing;
  const status = beforeOpening ? `Dibuka ${formatBookingTime(course.booking_dibuka_at)}` : afterClosing ? 'Booking ditutup' : full ? 'PENUH' : bookingLimitReached ? 'BATAS TERCAPAI' : 'TERSEDIA';
  const SubjectIcon = getSubjectIcon(course.nama_pelajaran);
  return <article className="course-card"><div className={`course-cover cover-${index % 4}`}><div className="course-cover-meta"><span className="tag">{status}</span><span className="capacity">{course.terdaftar}/{course.kapasitas} kursi</span></div><div className="cover-line" /></div><div className="course-body"><div className="course-heading"><SubjectIcon size={22} strokeWidth={1.8} aria-hidden="true" /><h3>{course.nama_pelajaran}</h3></div><p>{course.deskripsi}</p><div className="course-footer"><span className="mentor"><span className="tiny-avatar">{course.guru?.split(' ').map((part) => part[0]).join('')}</span>{course.guru}</span>{isBooked ? <span className="book-button booked">Terdaftar</span> : <button className="book-button" disabled={full || bookingLimitReached || bookingClosed} onClick={() => onBook(course)}>{bookingClosed ? beforeOpening ? `Buka ${formatBookingTime(course.booking_dibuka_at)}` : 'Ditutup' : full ? 'Penuh' : bookingLimitReached ? 'Maks. 3 mapel' : 'Daftar'}</button>}</div></div></article>;
}

function formatBookingTime(value: string | null) {
  if (!value) return '';
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jayapura' }).format(new Date(parseBookingTime(value)));
}

function parseBookingTime(value: string) {
  return new Date(`${value}:00+09:00`).getTime();
}

function UtilityPanel({ type, onClose }: { type: 'settings' | 'help'; onClose: () => void }) {
  const [saved, setSaved] = useState(false);
  const [help, setHelp] = useState({ bantuan_pendaftaran_judul: 'Bagaimana cara mendaftar?', bantuan_pendaftaran_deskripsi: 'Panduan singkat memilih program SLC', bantuan_teknis_judul: 'Butuh bantuan teknis?', bantuan_teknis_deskripsi: 'Hubungi admin SLC untuk dukungan' });
  useEffect(() => { if (type === 'help') authFetch('/settings').then((response) => response.json()).then((data) => setHelp((current) => ({ ...current, ...data }))).catch(() => undefined); }, [type]);
  return <div className="utility-backdrop" onClick={onClose}><aside className="utility-panel" onClick={(event) => event.stopPropagation()}><div className="utility-header"><div><p className="eyebrow">{type === 'settings' ? 'PENGATURAN' : 'PUSAT BANTUAN'}</p><h2>{type === 'settings' ? 'Atur ruang kerjamu.' : 'Ada yang bisa dibantu?'}</h2></div><button className="icon-button" onClick={onClose}><X size={20} /></button></div>{type === 'settings' ? <><label className="setting-row"><span><strong>Notifikasi email</strong><small>Terima kabar tentang pendaftaran dan kelas</small></span><input type="checkbox" defaultChecked /></label><label className="setting-row"><span><strong>Ringkasan mingguan</strong><small>Terima progres belajar setiap Senin</small></span><input type="checkbox" defaultChecked /></label><label className="setting-row"><span><strong>Mode tampilan</strong><small>Gunakan mode terang yang nyaman</small></span><select defaultValue="terang"><option value="terang">Terang</option><option value="otomatis">Otomatis</option></select></label><button className="login-button" onClick={() => setSaved(true)}>{saved ? <><Check size={16} /> Tersimpan</> : 'Simpan pengaturan'}</button></> : <div className="help-list"><button><CircleHelp size={18} /><span><strong>{help.bantuan_pendaftaran_judul}</strong><small>{help.bantuan_pendaftaran_deskripsi}</small></span><ArrowUpRight size={15} /></button><button><BookOpen size={18} /><span><strong>{help.bantuan_teknis_judul}</strong><small>{help.bantuan_teknis_deskripsi}</small></span><ArrowUpRight size={15} /></button></div>}</aside></div>;
}

function BrandLogo({ branding }: { branding: Branding }) { return <span className="brand-logo-content">{branding.logo_sekolah ? <img src={branding.logo_sekolah} alt="" /> : <span className="brand-mark"><Sparkles size={16} /></span>}<span>{branding.nama_website}</span></span>; }

function HomePage({ onLogin, onNavigate, branding, pages }: { onLogin: () => void; onNavigate: (page: LandingPage) => void; branding: Branding; pages: Pages }) {
  return <div className="marketing-shell">
    <LandingNav active="home" onLogin={onLogin} onNavigate={onNavigate} branding={branding} />
    <main>
      <section className="landing-hero"><div className="hero-kicker"><span /> STUDENT LEAD CONFERENCE</div><h1>{pages.home.title}</h1><p>{pages.home.intro}</p><div className="hero-actions"><button className="dark-button" onClick={onLogin}>Masuk ke ruang kerja <ArrowRight size={16} /></button><span className="hero-caption">Ruang untuk memimpin<br />proses belajarmu.</span></div></section>
      <section className="landing-signal"><div className="signal-grid"><div className="signal-visual signal-image"><img src="/slc-signal.jpg" alt="Siswa SLC memimpin dan membagikan proses belajar" /><span className="signal-label">/ 01</span></div><div className="signal-copy"><p className="eyebrow">CARA BELAJAR YANG BERMAKNA</p><h2>{pages.home.sectionTitle}</h2><p>{pages.home.sectionText}</p><div className="stat-strip"><div><strong>4</strong><span>tema belajar</span></div><div><strong>3</strong><span>siswa per ruang</span></div><div><strong>1</strong><span>tujuan bersama</span></div></div></div></div><p className="signal-message">Melalui SLC, siswa belajar mengenali diri, berbagi proses, dan memimpin langkah berikutnya.</p></section>
      <section className="landing-programs" id="programs"><div className="section-heading"><div><p className="eyebrow">METODE SLC</p><h2>Belajar dengan kepemilikan</h2></div><span className="section-index">02 / 04</span></div><div className="method-grid"><div><span>01</span><h3>Kenali proses</h3><p>Temukan kekuatan, minat, dan tantangan yang membentuk perjalanan belajarmu.</p></div><div><span>02</span><h3>Bagikan refleksi</h3><p>Latih keberanian berkomunikasi agar setiap suara punya ruang.</p></div><div><span>03</span><h3>Pimpin langkah</h3><p>Ubah wawasan dan umpan balik menjadi tujuan serta aksi nyata.</p></div></div></section>
      <section className="landing-footer" id="community"><p className="eyebrow">SIAP MEMIMPIN</p><h2>Perjalanan belajarmu<br /><em>layak untuk dibagikan.</em></h2><button className="light-button" onClick={onLogin}>Buka SLC <ArrowUpRight size={16} /></button></section>
    </main>
  </div>;
}

function LandingNav({ active, onLogin, onNavigate, branding }: { active: LandingPage; onLogin: () => void; onNavigate: (page: LandingPage) => void; branding: Branding }) { return <header className="landing-nav"><button className="brand landing-brand" onClick={() => onNavigate('home')}><BrandLogo branding={branding} /></button><nav><button className={active === 'profil' ? 'active' : ''} onClick={() => onNavigate('profil')}>About SLC</button><button className={active === 'sekolah' ? 'active' : ''} onClick={() => onNavigate('sekolah')}>About School</button><button className={active === 'program' ? 'active' : ''} onClick={() => onNavigate('program')}>Program</button></nav><button className="outline-button" onClick={onLogin}><LogIn size={15} /> Masuk</button></header>; }

function LandingFrame({ active, eyebrow, title, intro, children, onLogin, onNavigate, branding }: { active: LandingPage; eyebrow: string; title: React.ReactNode; intro: string; children: React.ReactNode; onLogin: () => void; onNavigate: (page: LandingPage) => void; branding: Branding }) { return <div className="marketing-shell"><LandingNav active={active} onLogin={onLogin} onNavigate={onNavigate} branding={branding} /><main className="landing-inner-page"><section className="landing-page-hero"><p className="hero-kicker"><span /> {eyebrow}</p><h1>{title}</h1><p>{intro}</p></section>{children}<section className="landing-page-cta"><p className="eyebrow">MULAI LANGKAHMU</p><h2>Ruang untuk memimpin<br /><em>selalu tersedia.</em></h2><button className="light-button" onClick={onLogin}>Masuk ke SLC <ArrowRight size={16} /></button></section></main></div>; }

function ProfileLanding(props: { onLogin: () => void; onNavigate: (page: LandingPage) => void; branding: Branding; pages: Pages }) { const page = props.pages.profil; return <LandingFrame active="profil" eyebrow="ABOUT SLC" title={page.title} intro={page.intro} {...props}><section className="landing-info-grid"><div className="landing-blue-card"><span>01 / OUR POINT OF VIEW</span><h2>{page.sectionTitle}</h2><p>{page.sectionText}</p></div><div className="landing-copy-block"><p className="eyebrow">SLC DALAM SATU KALIMAT</p><h2>Belajar untuk memimpin<br /><em>dengan kesadaran.</em></h2><p>Student Led Conference mempertemukan refleksi dengan percakapan. Siswa tidak hanya menerima hasil belajar, tetapi memahami proses dan menyusun langkah yang akan mereka bawa ke masa depan.</p></div></section><section className="landing-values"><div><b>01</b><h3>Berani merefleksi</h3><p>Kesadaran diri menjadi awal dari pertumbuhan.</p></div><div><b>02</b><h3>Hadir berdialog</h3><p>Setiap suara dan umpan balik memiliki ruang.</p></div><div><b>03</b><h3>Memimpin langkah</h3><p>Refleksi diterjemahkan menjadi tujuan dan aksi.</p></div></section></LandingFrame>; }

function SchoolLanding(props: { onLogin: () => void; onNavigate: (page: LandingPage) => void; branding: Branding; pages: Pages }) { const page = props.pages.sekolah; return <LandingFrame active="sekolah" eyebrow="ABOUT SCHOOL" title={page.title} intro={page.intro} {...props}><section className="school-story"><div className="school-illustration"><img src="/about-school-illustration.svg" alt="Ilustrasi siswa belajar bersama dalam komunitas SLC" /><span className="school-number">/ 02</span></div><div><p className="eyebrow">A CULTURE OF STUDENT LEADERSHIP</p><h2>{page.sectionTitle}</h2><p>{page.sectionText}</p></div></section><section className="school-stats"><div><strong>4</strong><span>Tema pengembangan</span></div><div><strong>3</strong><span>Siswa maksimal per Team</span></div><div><strong>1</strong><span>Komunitas belajar</span></div></section></LandingFrame>; }

const subjectIcons: Record<string, LucideIcon> = {
  'Agama Kristen': Church,
  PKN: Landmark,
  'Bahasa Indonesia': MessageCircle,
  Matematika: Calculator,
  IPA: FlaskConical,
  IPS: Globe2,
  Prakarya: Palette,
  PJOK: Dumbbell,
  'Bahasa Inggris': Languages,
  Informatika: Laptop,
  'Bahasa Mandarin': Languages,
};
const getSubjectIcon = (name: string) => subjectIcons[name.replace(/ [12]$/, '')] ?? BookOpen;

function ProgramsLanding(props: { onLogin: () => void; onNavigate: (page: LandingPage) => void; branding: Branding; pages: Pages }) { const page = props.pages.program; const programs = [['Agama Kristen', 'Hidup dalam Kasih Kristus', 'X-A'], ['PKN', 'Menjadi Warga yang Bertanggung Jawab', 'X-A'], ['Bahasa Indonesia', 'Berkata yang Membangun', 'X-A'], ['Matematika', 'Belajar dengan Tekun dan Jujur', 'X-A'], ['IPA', 'Mengagumi Karya Tuhan melalui Sains', 'X-A'], ['IPS', 'Peduli kepada Sesama', 'X-B'], ['Prakarya', 'Berkarya dengan Talenta yang Tuhan Berikan', 'X-B'], ['PJOK', 'Menjaga Tubuh sebagai Anugerah Tuhan', 'X-B'], ['Bahasa Inggris', 'Berani Berkomunikasi dan Menjadi Berkat', 'X-B'], ['Informatika', 'Bijak dan Bertanggung Jawab di Dunia Digital', 'X-B'], ['Bahasa Mandarin', 'Belajar Bahasa, Menghargai Sesama', 'X-B']]; return <LandingFrame active="program" eyebrow="PROGRAM SLC" title={page.title} intro={page.intro} {...props}><section className="public-program-grid"><div className="page-content-note"><h2>{page.sectionTitle}</h2><p>{page.sectionText}</p></div>{programs.map(([name, note, className]) => { const SubjectIcon = subjectIcons[name] ?? BookOpen; return <div key={name}><span className="subject-icon" aria-hidden="true"><SubjectIcon size={22} strokeWidth={1.8} /></span><h3>{name}</h3><p>{note}</p><b>Untuk kelas {className}</b></div>; })}</section></LandingFrame>; }

function UsernameLoginPage({ branding, onLogin, onBack }: { branding: Branding; onLogin: (user: UserRecord, token: string) => void; onBack: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setLoading(true); setError(''); try { const response = await fetch(`${API}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) }); const data = await response.json(); if (!response.ok) throw new Error(data.message); onLogin(data.user as UserRecord, data.token); } catch (loginError) { setError(loginError instanceof Error ? loginError.message : 'Login gagal.'); } finally { setLoading(false); } };
  return <div className="login-shell"><div className="login-aside"><button className="back-link" onClick={onBack}><ArrowUpRight size={15} /> Kembali ke SLC</button><div><div className="brand"><BrandLogo branding={branding} /></div><h1>Langkah baik<br /><em>dimulai di sini.</em></h1><p>Masuk dengan akun yang diberikan administrator. Role dashboard akan ditentukan otomatis dari akunmu.</p></div><span className="login-aside-note">{branding.nama_website} / 2026</span></div><div className="login-panel"><div className="login-panel-top"><span className="eyebrow">PORTAL MASUK</span><span className="secure-label"><ShieldCheck size={14} /> Portal aman</span></div><h2>Masuk ke<br /><em>ruang kerjamu.</em></h2><form onSubmit={submit}><label>Username<input required autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Masukkan username" /></label><label>Password<input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Masukkan password" /></label>{error && <div className="login-error">{error}</div>}<button className="login-button" disabled={loading}>{loading ? 'Memeriksa akun...' : 'Masuk ke ruang kerja'} <ArrowRight size={17} /></button></form></div></div>;
}

function LoginPage({ onLogin, onBack }: { onLogin: (role: Role) => void; onBack: () => void }) {
  const [role, setRole] = useState<Role>('siswa');
  return <div className="login-shell"><div className="login-aside"><button className="back-link" onClick={onBack}><ArrowUpRight size={15} /> Kembali ke SLC</button><div><div className="brand"><span className="brand-mark"><Sparkles size={16} /></span><span>SLC<span className="brand-dot">.</span></span></div><h1>Langkah baik<br /><em>dimulai di sini.</em></h1><p>Ruang belajar, langkah kecil berikutnya, dan komunitas yang hadir untuk memperhatikan prosesmu.</p></div><span className="login-aside-note">SLC / 2026</span></div><div className="login-panel"><div className="login-panel-top"><span className="eyebrow">SELAMAT DATANG KEMBALI</span><span className="secure-label"><ShieldCheck size={14} /> Portal aman</span></div><h2>Masuk ke<br /><em>ruang kerjamu.</em></h2><label>Alamat email<input type="email" defaultValue={roleMeta[role].name === 'Nadia Prameswari' ? 'nadia@clc.local' : ''} placeholder="kamu@sekolah.id" /></label><label>Kata sandi<div className="password-wrap"><input type="password" defaultValue="demo" /><span>Lihat</span></div></label><div className="role-picker"><span>Masuk sebagai</span><select value={role} onChange={(event) => setRole(event.target.value as Role)}><option value="siswa">Siswa</option><option value="guru">Guru</option><option value="kepala_sekolah">Kepala sekolah</option><option value="admin">Administrator</option></select></div><button className="login-button" onClick={() => onLogin(role)}>Masuk ke ruang kerja <ArrowRight size={17} /></button><p className="demo-note">Portal demo: pilih peran untuk melihat dashboard yang sesuai.</p></div></div>;
}

function StudentView({ studentId, bookingKey, notice }: { studentId: number; bookingKey: string; notice: string }) {
  const [groups, setGroups] = useState<ScheduleGroup[]>([]);
  const [summaryError, setSummaryError] = useState('');
  useEffect(() => {
    get<ScheduleGroup[]>(`/students/${studentId}/schedule`).then(setGroups).catch(() => setSummaryError('Ringkasan mata pelajaran belum dapat dimuat.'));
  }, [studentId, bookingKey]);
  return <>
    <CharacterBanner />
    <section className="section-heading"><div><p className="eyebrow">RINGKASAN BELAJAR</p><h2>Mata pelajaran dan proposal Team</h2></div></section>
    {notice && <div className="notice"><Check size={16} /> {notice}</div>}
    {summaryError && <div className="notice"><Check size={16} /> {summaryError}</div>}
    {groups.length === 0 && !summaryError && <div className="empty-workspace"><div className="empty-icon"><BookOpen size={22} /></div><h2>Belum ada mata pelajaran yang dipilih.</h2><p>Pilih program terlebih dahulu untuk melihat ringkasan belajar dan proposal Team.</p></div>}
    <div className="student-summary-grid">{groups.map((group) => <article className="student-summary-card" key={group.id}><div className="student-summary-heading"><div><p className="eyebrow">MATA PELAJARAN / KELAS {group.kelas}</p><h3>{group.nama_pelajaran}</h3><span>Guru: {group.guru}</span></div><strong>{group.terdaftar}/{group.kapasitas}</strong></div><div className="student-summary-proposals"><div className="proposal-list-title"><b>Ringkasan proposal Team</b><span>{group.proposals.length} proposal</span></div>{group.proposals.length === 0 ? <small>Belum ada proposal yang diajukan siswa atau Team ini.</small> : group.proposals.map((proposal) => <div className="proposal-item" key={proposal.id}><div><strong>{proposal.judul}</strong><small>Diajukan oleh {proposal.pengusul}</small></div><span className={`proposal-status ${proposal.status}`}>{proposal.status}</span></div>)}</div></article>)}</div>
  </>;
}

function CharacterBanner() {
  return <section className="student-hero-banner"><img src="/slc-banner.jpg" alt="Siswa memimpin proses belajar melalui Student Led Conference" /></section>;
}

function TeacherDashboard({ courses, user }: { courses: Course[]; user: UserRecord | null }) { return <div className="teacher-dashboard">{user && <TeacherProposalPanel teacherId={user.id} />}<LiveTeacherView courses={courses} user={user} /></div>; }

function TeacherProposalPanel({ teacherId }: { teacherId: number }) {
  const [proposals, setProposals] = useState<TeacherProposal[]>([]);
  const [feedback, setFeedback] = useState<Record<number, string>>({});
  const [notice, setNotice] = useState('');
  const load = () => get<TeacherProposal[]>(`/teachers/${teacherId}/proposals`).then(setProposals).catch(() => setNotice('Proposal belum dapat dimuat.'));
  useEffect(() => { load(); }, [teacherId]);
  const decide = async (proposal: TeacherProposal, status: 'disetujui' | 'ditolak') => { const text = feedback[proposal.id] ?? ''; if (text.length < 3) return setNotice('Feedback minimal 3 karakter.'); const response = await fetch(`${API}/proposals/${proposal.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guruId: teacherId, status, feedback: text }) }); const data = await response.json(); if (!response.ok) return setNotice(data.message ?? 'Keputusan gagal disimpan.'); setNotice('Keputusan proposal berhasil disimpan.'); setProposals(proposals.map((item) => item.id === proposal.id ? { ...item, status: data.status, feedback: data.feedback } : item)); };
  return <section className="proposal-review"><div className="section-heading"><div><p className="eyebrow">PROPOSAL TEAM</p><h2>Proposal yang menunggu</h2></div></div>{notice && <div className="notice"><Check size={16} /> {notice}</div>}{proposals.length === 0 && <p className="muted-copy">Belum ada proposal dari Team siswa.</p>}{proposals.map((proposal) => <article className="review-card" key={proposal.id}><div className="review-card-head"><div><strong>{proposal.judul}</strong><small>{proposal.nama_pelajaran} · Kelas {proposal.kelas} · diajukan {proposal.pengusul}</small></div><span className={`proposal-status ${proposal.status}`}>{proposal.status}</span></div><p>{proposal.deskripsi}</p>{proposal.status === 'menunggu' ? <><textarea rows={3} placeholder="Tulis feedback untuk Team" value={feedback[proposal.id] ?? ''} onChange={(event) => setFeedback({ ...feedback, [proposal.id]: event.target.value })} /><div className="review-actions"><button className="reject-button" onClick={() => decide(proposal, 'ditolak')}>Tolak</button><button className="approve-button" onClick={() => decide(proposal, 'disetujui')}>Setujui <Check size={14} /></button></div></> : <div className="review-feedback">Feedback: {proposal.feedback}</div>}</article>)}</section>;
}

function LiveTeacherView({ courses, user }: { courses: Course[]; user: UserRecord | null }) { const myCourses = courses.filter((course) => course.guru_id === user?.id); const [classes, setClasses] = useState<{ id: number; nama_pelajaran: string; students: { id: number; nama: string; email: string }[] }[]>([]); useEffect(() => { if (user) get<typeof classes>(`/classes/${user.id}`).then(setClasses).catch(() => setClasses([])); }, [user]); const students = classes.flatMap((item) => item.students.map((student) => ({ ...student, program: item.nama_pelajaran }))); return <><CharacterBanner /><div className="metric-row"><Metric label="Program aktif" value={String(myCourses.length)} hint="dari data administrator" icon={<BookOpen />} /><Metric label="Siswa terdaftar" value={String(students.length)} hint="di semua kelas" icon={<Users />} /><Metric label="Kelas aktif" value={String(classes.length)} hint="penugasan saat ini" icon={<GraduationCap />} /></div><section className="table-section"><div className="section-heading"><div><p className="eyebrow">KELAS YANG DIAMPU</p><h2>Aktivitas kelas</h2></div></div><div className="class-list">{myCourses.map((course) => <div className="class-row" key={course.id}><div className="class-icon"><BookOpen size={19} /></div><div className="class-info"><strong>{course.nama_pelajaran}</strong><span>Kelas {course.kelas} · {course.deskripsi}</span></div><div className="class-capacity"><b>{course.terdaftar}/{course.kapasitas}</b><small>siswa terdaftar</small></div></div>)}</div></section><section className="student-table"><div className="section-heading"><div><p className="eyebrow">DAFTAR SISWA</p><h2>Siswa di ruang belajarmu</h2></div></div><div className="roster-row roster-head"><span>Siswa</span><span>Program</span><span>Status</span></div>{students.map((student) => <div className="roster-row" key={`${student.id}-${student.program}`}><span className="roster-person"><span className="tiny-avatar">{student.nama.split(' ').map((part) => part[0]).join('')}</span>{student.nama}</span><span>{student.program}</span><span className="status-pill"><Check size={12} /> Terdaftar</span></div>)}</section></>; }

function TeacherWorkspacePanel({ userId, view }: { userId: number; view: 'kelas' | 'siswa' }) {
  const [classes, setClasses] = useState<{ id: number; nama_pelajaran: string; deskripsi: string; kapasitas: number; students: { id: number; nama: string; email: string }[] }[]>([]);
  const [notice, setNotice] = useState('');
  useEffect(() => { get<typeof classes>(`/classes/${userId}`).then(setClasses).catch(() => setNotice('Data kelas guru belum dapat dimuat.')); }, [userId]);
  const removeBooking = async (courseId: number, studentId: number, studentName: string) => {
    if (!window.confirm(`Batalkan pendaftaran ${studentName}?`)) return;
    const response = await authFetch(`/teachers/${userId}/bookings/${courseId}/${studentId}`, { method: 'DELETE' });
    const data = await response.json();
    if (!response.ok) return setNotice(data.message ?? 'Pembatalan pendaftaran gagal.');
    setClasses((current) => current.map((item) => item.id === courseId ? { ...item, students: item.students.filter((student) => student.id !== studentId) } : item));
    setNotice('Pendaftaran siswa berhasil dibatalkan.');
  };
  const students = classes.flatMap((item) => item.students.map((student) => ({ ...student, courseId: item.id, program: item.nama_pelajaran })));
  return <><section className="page-intro"><p className="eyebrow">GURU / {view === 'kelas' ? 'KELOLA KELAS' : 'DAFTAR SISWA'}</p><h1>{view === 'kelas' ? <>Kelasmu, <em>lebih terarah.</em></> : <>Siswa di ruang <em>belajarmu.</em></>}</h1><p>{view === 'kelas' ? 'Daftar mata pelajaran yang diampu dan kapasitas setiap kelas.' : 'Daftar siswa yang booking mata pelajaran yang kamu ampu.'}</p></section>{notice && <div className="notice"><Check size={16} /> {notice}</div>}{view === 'kelas' ? <div className="class-list">{classes.map((item) => <div className="class-row" key={item.id}><div className="class-icon"><BookOpen size={19} /></div><div className="class-info"><strong>{item.nama_pelajaran}</strong><span>{item.deskripsi}</span></div><div className="class-capacity"><b>{item.students.length}/{item.kapasitas}</b><small>siswa terdaftar</small></div></div>)}</div> : <div className="student-table"><div className="roster-row roster-head"><span>Siswa</span><span>Program</span><span>Status</span><span>Aksi</span></div>{students.map((student) => <div className="roster-row" key={`${student.id}-${student.courseId}`}><span className="roster-person"><span className="tiny-avatar">{student.nama.split(' ').map((part) => part[0]).join('')}</span>{student.nama}</span><span>{student.program}</span><span className="status-pill"><Check size={12} /> Terdaftar</span><button className="delete-button" onClick={() => removeBooking(student.courseId, student.id, student.nama)}>Batalkan</button></div>)}</div>}{!notice && classes.length === 0 && <div className="empty-workspace"><div className="empty-icon"><BookOpen size={22} /></div><h2>{view === 'kelas' ? 'Belum ada mata pelajaran yang diampu.' : 'Belum ada siswa yang terdaftar.'}</h2></div>}</>;
}

function TeacherView({ courses }: { courses: Course[] }) { const myCourses = courses.filter((course) => course.guru === 'Alya Putri'); return <><section className="page-intro"><p className="eyebrow">GURU / KELOLA KELAS</p><h1>Kelasmu, <em>lebih terarah.</em></h1><p>Pantau percakapan dan perkembangan yang terjadi di ruang belajar.</p></section><div className="metric-row"><Metric label="Program aktif" value={String(myCourses.length || 2)} hint="semester ini" icon={<BookOpen />} /><Metric label="Siswa terdaftar" value={String(myCourses.reduce((sum, course) => sum + course.terdaftar, 0) || 5)} hint="di semua kelas" icon={<Users />} /><Metric label="Kehadiran rata-rata" value="94%" hint="naik 8% bulan ini" icon={<Check />} /></div></>; }

function LivePrincipalView({ courses, stats }: { courses: Course[]; stats: DashboardStats }) { return <><section className="page-intro"><p className="eyebrow">KEPALA SEKOLAH / LAPORAN</p><h1>SLC dalam <em>satu pandangan.</em></h1><p>Angka dan program yang tampil mengikuti data administrator secara langsung.</p></section><CharacterBanner /><div className="metric-row"><Metric label="Total siswa" value={String(stats.siswa)} hint="data akun siswa" icon={<GraduationCap />} /><Metric label="Tim pengajar" value={String(stats.guru)} hint="data akun guru" icon={<Users />} /><Metric label="Program aktif" value={String(stats.program)} hint={`${stats.kelas} kelas terdaftar`} icon={<BookOpen />} /><Metric label="Pendaftaran" value={String(stats.pendaftaran)} hint="booking berhasil" icon={<Gauge />} /></div><section className="table-section"><div className="section-heading"><div><p className="eyebrow">KESEHATAN PROGRAM</p><h2>Program SLC saat ini</h2></div><span className="report-readonly"><ShieldCheck size={14} /> Hanya lihat</span></div><div className="program-report">{courses.map((course) => { const SubjectIcon = getSubjectIcon(course.nama_pelajaran); return <div className="program-report-row" key={course.id}><span className="report-course-number subject-report-icon" aria-hidden="true"><SubjectIcon size={18} strokeWidth={1.8} /></span><strong>{course.nama_pelajaran}</strong><span>{course.guru}</span><b>Kelas {course.kelas} · {course.terdaftar}/{course.kapasitas}</b><span className="health-dot" /></div>; })}</div></section></>; }

function PrincipalView({ courses }: { courses: Course[] }) { return <><section className="page-intro"><p className="eyebrow">KEPALA SEKOLAH / LAPORAN</p><h1>SLC dalam <em>satu pandangan.</em></h1><p>Pantauan tenang dan jelas tentang program yang menggerakkan komunitas sekolah.</p></section><div className="metric-row"><Metric label="Total siswa" value="124" hint="naik 12% dari semester lalu" icon={<GraduationCap />} /><Metric label="Tim pengajar" value="18" hint="2 guru baru bulan ini" icon={<Users />} /><Metric label="Program aktif" value={String(courses.length || 4)} hint="dalam 4 tema" icon={<BookOpen />} /><Metric label="Pendaftaran" value="286" hint="semester ini" icon={<Gauge />} /></div></>; }

function LiveAdminView({ courses, stats }: { courses: Course[]; stats: DashboardStats }) {
  const [page, setPage] = useState(1);
  const pageSize = 6;
  const pageCount = Math.max(1, Math.ceil(courses.length / pageSize));
  const visibleCourses = courses.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => { setPage(1); }, [courses.length]);
  return <><section className="page-intro"><p className="eyebrow">ADMIN / DASHBOARD</p><h1>Jaga SLC tetap <em>bergerak.</em></h1><p>Ringkasan ini membaca data akun, kelas, mapel, dan booking dari database.</p></section><div className="metric-row"><Metric label="Total akun" value={String(stats.akun)} hint={`${stats.guru} guru · ${stats.siswa} siswa`} icon={<Users />} /><Metric label="Mata pelajaran" value={String(stats.program)} hint={`${stats.kelas} kelas aktif`} icon={<BookOpen />} /><Metric label="Pendaftaran" value={String(stats.pendaftaran)} hint="booking berhasil" icon={<TrendingUp />} /><Metric label="Kelas" value={String(stats.kelas)} hint="dari menu Data Kelas" icon={<GraduationCap />} /></div><section className="table-section"><div className="section-heading"><div><p className="eyebrow">PROGRAM TERKINI</p><h2>Mapel dan penugasan guru</h2></div><span className="report-readonly"><Check size={14} /> Sinkron database</span></div><div className="program-report">{visibleCourses.map((course) => { const SubjectIcon = getSubjectIcon(course.nama_pelajaran); return <div className="program-report-row" key={course.id}><span className="report-course-number subject-report-icon" aria-hidden="true"><SubjectIcon size={18} strokeWidth={1.8} /></span><strong>{course.nama_pelajaran}</strong><span>{course.guru}</span><b>Kelas {course.kelas} · {course.terdaftar}/{course.kapasitas}</b><span className="health-dot" /></div>; })}</div><Pagination page={page} pageCount={pageCount} onChange={setPage} /></section></>; }

function AdminView({ courses }: { courses: Course[] }) { return <><section className="page-intro"><p className="eyebrow">ADMIN / DASHBOARD</p><h1>Jaga SLC tetap <em>bergerak.</em></h1></section><div className="metric-row"><Metric label="Mata pelajaran" value={String(courses.length)} hint="data program" icon={<BookOpen />} /></div></>; }
function LeadershipView({ role, courses }: { role: Role; courses: Course[] }) { return <><section className="page-intro"><p className="eyebrow">{role === 'admin' ? 'ADMINISTRATION' : 'LEADERSHIP REPORT'}</p><h1>The SLC <em>at a glance.</em></h1><p>Clear signals from the programs shaping your school community.</p></section><div className="metric-row"><Metric label="Total students" value="124" hint="12% vs last term" icon={<GraduationCap />} /><Metric label="Teaching team" value="18" hint="2 new this month" icon={<Users />} /><Metric label="Active programs" value={String(courses.length || 4)} hint="across 4 themes" icon={<BookOpen />} /><Metric label="Registrations" value="286" hint="this semester" icon={<Gauge />} /></div><section className="report-grid"><div className="report-panel"><div className="section-heading"><div><p className="eyebrow">PROGRAM MOMENTUM</p><h2>Registration flow</h2></div><span className="trend">+18.4%</span></div><div className="fake-chart"><div className="chart-grid"><span /><span /><span /><span /></div><div className="chart-line"><i /><i /><i /><i /><i /><i /><i /><i /></div><div className="chart-labels"><span>Aug 01</span><span>Aug 15</span><span>Sep 01</span><span>Sep 16</span></div></div></div><div className="report-panel dark-panel"><p className="eyebrow">MOST ACTIVE</p><h2>Public Speaking</h2><p>88% of available seats filled this semester.</p><div className="progress"><span style={{ width: '88%' }} /></div><div className="panel-bottom"><span>22 / 25 seats</span><ArrowUpRight size={17} /></div></div></section></>; }
function Metric({ label, value, hint, icon }: { label: string; value: string; hint: string; icon: React.ReactNode }) { return <div className="metric"><div className="metric-icon">{icon}</div><span>{label}</span><strong>{value}</strong><small>{hint}</small></div>; }
