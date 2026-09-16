import { useEffect, useState } from 'react';
import { Camera, Check, KeyRound, Save, UserRound, X } from 'lucide-react';
import { authFetch } from './apiClient';

type Role = 'siswa' | 'guru' | 'kepala_sekolah' | 'admin';
type Profile = { id: number; nama: string; username: string; email: string; role: Role; kelas: string | null; foto_profil: string | null };
const API = 'http://localhost:4000/api';

export default function ProfilePanel({ userId, onClose, onSaved }: { userId: number; onClose: () => void; onSaved: (profile: Profile) => void }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { authFetch(`/profile/${userId}`).then((response) => response.json()).then((data) => { setProfile(data); setPhoto(data.foto_profil); }).catch(() => setNotice('Profil belum dapat dimuat.')); }, [userId]);
  const choosePhoto = (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setPhoto(String(reader.result)); reader.readAsDataURL(file); };
  const save = async (event: React.FormEvent) => { event.preventDefault(); if (!profile) return; if (newPassword && newPassword.length < 6) return setNotice('Password baru minimal 6 karakter.'); setSaving(true); const response = await authFetch(`/profile/${userId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nama: profile.nama, fotoProfil: photo, passwordLama: oldPassword || undefined, passwordBaru: newPassword || undefined }) }); const data = await response.json(); setSaving(false); if (!response.ok) return setNotice(data.message ?? 'Profil gagal disimpan.'); setProfile(data); setPhoto(data.foto_profil); setOldPassword(''); setNewPassword(''); setNotice('Profil berhasil diperbarui.'); onSaved(data); };
  return <div className="utility-backdrop" onClick={onClose}><aside className="utility-panel profile-panel" onClick={(event) => event.stopPropagation()}><div className="utility-header"><div><p className="eyebrow">PROFIL PENGGUNA</p><h2>Ruang pribadimu.</h2></div><button className="icon-button" onClick={onClose}><X size={20} /></button></div>{profile && <form className="profile-form" onSubmit={save}><div className="profile-photo-editor"><div className="profile-photo-preview">{photo ? <img src={photo} alt="Foto profil" /> : <UserRound size={30} />}</div><label className="photo-button"><Camera size={14} /> Ganti foto<input type="file" accept="image/png,image/jpeg" onChange={choosePhoto} /></label></div><label>Nama lengkap<input required value={profile.nama} onChange={(event) => setProfile({ ...profile, nama: event.target.value })} /></label><label>Username<input value={profile.username} disabled /></label><label>Email<input value={profile.email} disabled /></label><div className="profile-meta"><span>Peran<strong>{profile.role.replace('_', ' ')}</strong></span>{profile.kelas && <span>Kelas<strong>{profile.kelas}</strong></span>}</div><section className="password-section"><div className="settings-section-title"><KeyRound size={17} /><div><strong>Ganti password</strong><small>Kosongkan jika belum ingin mengganti</small></div></div><input type="password" placeholder="Password lama" value={oldPassword} onChange={(event) => setOldPassword(event.target.value)} /><input type="password" placeholder="Password baru (min. 6 karakter)" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></section>{notice && <div className="settings-notice"><Check size={15} /> {notice}</div>}<button className="login-button settings-save" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan profil'} <Save size={16} /></button></form>}</aside></div>;
}
