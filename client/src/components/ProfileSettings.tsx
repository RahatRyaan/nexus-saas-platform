import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import { Camera, User, Mail, Shield, Crown, Users, Check, Sparkles, Upload } from 'lucide-react';

export function ProfileSettings() {
  const { user, currentRole, setUser } = useAuthStore();
  const [name, setName] = useState(user?.name || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

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
    setAvatarFile(file);

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
      setMsg('Profile picture updated successfully!');
    } catch (err) {
      alert('Failed to upload profile picture.');
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
      const res = await api.post('/api/auth/profile', { name });
      if (user) {
        setUser({ ...user, name: res.data.user.name }, currentRole);
      }
      setMsg('Name updated successfully!');
    } catch (err) {
      alert('Failed to update profile name.');
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadge = () => {
    switch (currentRole) {
      case 'owner':
        return (
          <span className="flex items-center gap-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
            <Crown size={14} /> Workspace Owner
          </span>
        );
      case 'admin':
        return (
          <span className="flex items-center gap-1.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
            <Shield size={14} /> Workspace Admin
          </span>
        );
      case 'member':
        return (
          <span className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
            <Users size={14} /> Team Member
          </span>
        );
    }
  };

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">My Profile & Account Details</h1>
        <p className="text-sm text-slate-400 mt-1">Manage your identity, avatar, and role authorization credentials.</p>
      </div>

      {msg && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs p-3.5 rounded-xl flex items-center gap-2">
          <Check size={16} /> {msg}
        </div>
      )}

      {/* Profile Overview Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between shadow-xl">
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
              className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center rounded-2xl cursor-pointer text-white text-[10px] gap-1"
            >
              <Camera size={18} />
              <span>Change</span>
            </label>
            <input
              id="avatar-upload"
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-white">{user?.name}</h2>
              {getRoleBadge()}
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1.5 font-mono">
              <Mail size={13} className="text-slate-500" /> {user?.email}
            </p>
          </div>
        </div>

        <div className="text-xs text-slate-400 border-t md:border-t-0 md:border-l border-slate-800 pt-4 md:pt-0 md:pl-6 space-y-1">
          <div className="text-slate-500 text-[11px] font-semibold uppercase">Workspace Authorization</div>
          <div>Role Tier: <strong className="text-white capitalize">{currentRole}</strong></div>
          <div>User ID: <span className="font-mono text-[10px] text-slate-400">{user?.id}</span></div>
        </div>
      </div>

      {/* Edit Profile Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-white">Update Personal Details</h3>
        <form onSubmit={handleUpdateName} className="space-y-4 max-w-md">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Account Email (Read-Only)</label>
            <input
              type="text"
              disabled
              value={user?.email || ''}
              className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-500 cursor-not-allowed font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-2 rounded-lg shadow"
          >
            {loading ? 'Saving...' : 'Save Profile Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
