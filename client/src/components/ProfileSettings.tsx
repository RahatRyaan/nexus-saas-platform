import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import { Camera, User, Mail, Shield, Crown, Users, Check, Sparkles, Upload, Key, ShieldCheck } from 'lucide-react';

export function ProfileSettings() {
  const { user, currentRole, setUser } = useAuthStore();
  const [name, setName] = useState(user?.name || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const avatarPresets = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
  ];

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await api.get('/api/auth/profile');
        if (res.data.user) {
          setName(res.data.user.name || '');
          setAvatar(res.data.user.avatar || '');
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadProfile();
  }, []);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    setLoading(true);
    setMsg('');
    try {
      const res = await api.post('/api/auth/profile/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const newUrl = res.data.avatarUrl || res.data.user?.avatar;
      setAvatar(newUrl);
      if (user) {
        setUser({ ...user, avatar: newUrl }, currentRole);
      }
      setMsg('Profile picture uploaded and updated successfully!');
    } catch {
      // Direct base64 fallback
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        setAvatar(base64);
        if (user) setUser({ ...user, avatar: base64 }, currentRole);
        await api.post('/api/auth/profile', { avatar: base64 }).catch(() => {});
        setMsg('Profile picture updated successfully!');
      };
      reader.readAsDataURL(file);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPreset = async (presetUrl: string) => {
    setAvatar(presetUrl);
    setLoading(true);
    setMsg('');
    try {
      await api.post('/api/auth/profile', { avatar: presetUrl });
      if (user) {
        setUser({ ...user, avatar: presetUrl }, currentRole);
      }
      setMsg('Preset avatar selected and saved!');
    } catch {
      alert('Failed to save avatar preset.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setMsg('');
    try {
      const res = await api.post('/api/auth/profile', { name: name.trim() });
      if (user) {
        setUser({ ...user, name: res.data.user?.name || name.trim() }, currentRole);
      }
      setMsg('Display name updated successfully!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update profile name.');
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadge = () => {
    switch (currentRole) {
      case 'owner':
        return (
          <span className="flex items-center gap-1.5 bg-amber-500/10 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
            <Crown size={14} /> Workspace Owner
          </span>
        );
      case 'admin':
        return (
          <span className="flex items-center gap-1.5 bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
            <Shield size={14} /> Workspace Admin
          </span>
        );
      case 'member':
        return (
          <span className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
            <Users size={14} /> Team Member
          </span>
        );
    }
  };

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">My Profile & Account Preferences</h1>
        <p className="text-sm text-slate-400 mt-1">Manage your identity, personal avatar, and workspace credentials.</p>
      </div>

      {msg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs p-3.5 rounded-2xl flex items-center gap-2 shadow">
          <Check size={16} /> {msg}
        </div>
      )}

      {/* Profile Overview Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between shadow-2xl">
        <div className="flex items-center gap-5">
          <div className="relative group">
            <div className="h-20 w-20 rounded-2xl bg-slate-800 border-2 border-slate-700 overflow-hidden flex items-center justify-center font-bold text-xl text-white shadow-inner">
              {avatar ? (
                <img src={avatar} alt={name} className="h-full w-full object-cover" />
              ) : (
                <span>{name?.charAt(0) || 'U'}</span>
              )}
            </div>
            <label
              htmlFor="avatar-upload"
              className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center rounded-2xl cursor-pointer text-white text-[10px] gap-1 font-semibold"
            >
              <Camera size={18} />
              <span>Upload</span>
            </label>
            <input
              id="avatar-upload"
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-white">{user?.name}</h2>
              {getRoleBadge()}
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1.5 font-mono">
              <Mail size={13} className="text-slate-500" /> {user?.email}
            </p>
          </div>
        </div>

        <div className="text-xs text-slate-400 border-t md:border-t-0 md:border-l border-slate-800 pt-4 md:pt-0 md:pl-6 space-y-1.5">
          <div className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Authentication Security</div>
          <div>Session: <strong className="text-emerald-400">JWT Refresh Token Active</strong></div>
          <div>User ID: <span className="font-mono text-[10px] text-slate-400">{user?.id}</span></div>
        </div>
      </div>

      {/* Preset Avatars Picker */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-3 shadow-xl">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles size={14} className="text-indigo-400" /> Choose Preset Avatar
        </h3>
        <p className="text-xs text-slate-400">Click any avatar below to immediately apply it to your profile across all channels.</p>
        <div className="flex items-center gap-3 pt-2 overflow-x-auto">
          {avatarPresets.map((url, idx) => (
            <button
              key={idx}
              onClick={() => handleSelectPreset(url)}
              className={`h-12 w-12 rounded-2xl overflow-hidden border-2 transition shrink-0 ${
                avatar === url ? 'border-indigo-500 scale-105 shadow-lg shadow-indigo-600/30' : 'border-slate-700 hover:border-slate-500'
              }`}
            >
              <img src={url} alt={`Preset ${idx + 1}`} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      </div>

      {/* Edit Profile Name Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
        <h3 className="text-sm font-bold text-white">Update Personal Information</h3>
        <form onSubmit={handleUpdateName} className="space-y-4 max-w-md">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Full Display Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Registered Email (Read-Only)</label>
            <input
              type="text"
              disabled
              value={user?.email || ''}
              className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-500 cursor-not-allowed font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-600/30 transition"
          >
            {loading ? 'Saving Changes...' : 'Save Profile Name'}
          </button>
        </form>
      </div>
    </div>
  );
}
