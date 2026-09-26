import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuthStore, Role } from '../store/authStore';
import { UserPlus, Trash2, Shield, Crown, Users, Check, Copy, UserCheck, AlertCircle, Sparkles, Link as LinkIcon } from 'lucide-react';

export function TeamManagement() {
  const { currentWorkspace, currentRole, cachedMembers, setCachedMembers } = useAuthStore();
  const [members, setMembers] = useState<any[]>(cachedMembers || []);
  const [activeTab, setActiveTab] = useState<'direct' | 'invite'>('direct');
  
  // Direct Add state
  const [directEmail, setDirectEmail] = useState('');
  const [directName, setDirectName] = useState('');
  const [directRole, setDirectRole] = useState<'admin' | 'member'>('member');
  
  // Invite state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [inviteResult, setInviteResult] = useState<{ url: string; token: string } | null>(null);

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const isOwner = currentRole === 'owner';
  const isAdmin = currentRole === 'owner' || currentRole === 'admin';

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchMembers = async () => {
    if (!currentWorkspace) return;
    try {
      const res = await api.get(`/api/workspaces/${currentWorkspace.id}`);
      const list = res.data.workspace.members || [];
      const ownerObj = res.data.workspace.ownerId;
      
      const combined: any[] = [];
      if (ownerObj) {
        combined.push({
          userId: ownerObj,
          role: 'owner',
          joinedAt: res.data.workspace.createdAt,
          isOwner: true,
        });
      }
      list.forEach((m: any) => {
        const mId = m.userId?._id || m.userId;
        const oId = ownerObj?._id || ownerObj;
        if (String(mId) !== String(oId)) {
          combined.push(m);
        }
      });

      setMembers(combined);
      setCachedMembers(combined);
    } catch (err) {
      console.error('Failed to load members', err);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [currentWorkspace]);

  const handleDirectAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directEmail.trim() || !currentWorkspace) return;
    setLoading(true);
    try {
      await api.post(`/api/workspaces/${currentWorkspace.id}/members/direct-add`, {
        email: directEmail.trim(),
        name: directName.trim() || undefined,
        role: directRole,
      });
      setDirectEmail('');
      setDirectName('');
      showToast(`User ${directEmail} added directly as ${directRole.toUpperCase()}!`);
      await fetchMembers();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to add member directly', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !currentWorkspace) return;
    setLoading(true);
    try {
      const res = await api.post(`/api/workspaces/${currentWorkspace.id}/invite`, {
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      setInviteResult({
        url: res.data.inviteUrl || `${window.location.origin}/invite/accept?token=${res.data.inviteToken}`,
        token: res.data.inviteToken,
      });
      setInviteEmail('');
      showToast('Invitation link generated successfully!');
      await fetchMembers();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to generate invitation', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!currentWorkspace) return;
    try {
      await api.patch(`/api/workspaces/${currentWorkspace.id}/members/${userId}/role`, {
        role: newRole,
      });
      showToast(`Role updated to ${newRole.toUpperCase()}!`);
      await fetchMembers();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to update member role', 'error');
    }
  };

  const handleRemove = async (userId: string, userName: string) => {
    if (!window.confirm(`Are you sure you want to remove ${userName || 'this member'} from the workspace?`)) return;
    if (!currentWorkspace) return;

    try {
      await api.delete(`/api/workspaces/${currentWorkspace.id}/members/${userId}`);
      showToast(`Member removed successfully from ${currentWorkspace.name}`);
      await fetchMembers();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to remove member', 'error');
    }
  };

  const copyInviteLink = () => {
    if (inviteResult?.url) {
      navigator.clipboard.writeText(inviteResult.url);
      showToast('Invite link copied to clipboard!');
    }
  };

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <Users className="text-indigo-400" /> Team & Member Authorization
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Manage workspace members, assign roles, invite collaborators, and configure access levels.
        </p>
      </div>

      {toast && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center gap-2 border shadow-lg ${
            toast.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}
        >
          {toast.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Add / Invite Member Panel */}
      {isAdmin && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex gap-3 border-b border-slate-800 pb-3">
            <button
              onClick={() => setActiveTab('direct')}
              className={`text-xs font-bold px-4 py-2 rounded-xl transition flex items-center gap-1.5 ${
                activeTab === 'direct' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserPlus size={14} /> Direct Add Member (Instant)
            </button>
            <button
              onClick={() => setActiveTab('invite')}
              className={`text-xs font-bold px-4 py-2 rounded-xl transition flex items-center gap-1.5 ${
                activeTab === 'invite' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <LinkIcon size={14} /> Generate Email Invite Link
            </button>
          </div>

          {activeTab === 'direct' ? (
            <form onSubmit={handleDirectAdd} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-300">User Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="colleague@company.com"
                  value={directEmail}
                  onChange={(e) => setDirectEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-300">Full Name (Optional)</label>
                <input
                  type="text"
                  placeholder="Jane Smith"
                  value={directName}
                  onChange={(e) => setDirectName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-300">Assign Role</label>
                <select
                  value={directRole}
                  onChange={(e) => setDirectRole(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="member">Member (Collaborator)</option>
                  <option value="admin">Admin (Manager)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={loading || !directEmail.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/30 transition h-[38px]"
              >
                <UserCheck size={14} /> Add Directly
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <form onSubmit={handleInvite} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-300">Invite Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="invitee@nexus.app"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-300">Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="member">Member (Collaborator)</option>
                    <option value="admin">Admin (Manager)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={loading || !inviteEmail.trim()}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/30 transition h-[38px]"
                >
                  <LinkIcon size={14} /> Create Invite Link
                </button>
              </form>

              {inviteResult && (
                <div className="bg-slate-950 border border-indigo-500/30 rounded-xl p-3.5 flex items-center justify-between gap-3 mt-3">
                  <div className="text-xs text-slate-300 font-mono truncate">{inviteResult.url}</div>
                  <button
                    onClick={copyInviteLink}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 shrink-0 font-medium"
                  >
                    <Copy size={13} /> Copy
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Members Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-slate-800 bg-slate-950/60 flex justify-between items-center">
          <div className="text-xs font-bold text-white uppercase tracking-wider">
            Active Members ({members.length})
          </div>
          <button onClick={fetchMembers} className="text-xs text-indigo-400 hover:underline">
            Refresh List
          </button>
        </div>

        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="p-4">Member</th>
              <th className="p-4">Email</th>
              <th className="p-4">Role Tier</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-200">
            {members.map((m, i) => {
              const uObj = m.userId || {};
              const uId = uObj._id ? uObj._id.toString() : (uObj.toString ? uObj.toString() : String(uObj));
              const uName = uObj.name || (uObj.email ? uObj.email.split('@')[0] : 'Workspace Member');
              const uEmail = uObj.email || '—';
              const uAvatar = uObj.avatar;
              const isOwnerRow = m.role === 'owner' || m.isOwner;

              return (
                <tr key={uId || i} className="hover:bg-slate-800/40 transition">
                  <td className="p-4 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center font-bold text-xs text-white shrink-0">
                      {uAvatar ? (
                        <img src={uAvatar} alt={uName} className="h-full w-full object-cover" />
                      ) : (
                        uName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-white">{uName}</div>
                      {isOwnerRow && <div className="text-[10px] text-amber-400 font-semibold">Workspace Creator</div>}
                    </div>
                  </td>
                  <td className="p-4 font-mono text-slate-400 text-[11px]">{uEmail}</td>
                  <td className="p-4">
                    {isOwner && !isOwnerRow ? (
                      <select
                        value={m.role}
                        onChange={(e) => handleRoleChange(uId, e.target.value)}
                        className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1 font-medium focus:outline-none focus:border-indigo-500"
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                          m.role === 'owner'
                            ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                            : m.role === 'admin'
                            ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/30'
                            : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {m.role === 'owner' ? <Crown size={11} /> : m.role === 'admin' ? <Shield size={11} /> : <Users size={11} />}
                        {m.role}
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    {!isOwnerRow && isAdmin ? (
                      <button
                        onClick={() => handleRemove(uId, uName)}
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-1 rounded-lg text-xs font-semibold transition"
                      >
                        Remove
                      </button>
                    ) : (
                      <span className="text-slate-500 text-[11px] italic">Protected</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
