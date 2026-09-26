import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';

export function TeamManagement() {
  const { currentWorkspace } = useAuthStore();
  const [members, setMembers] = useState<any[]>([]);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchMembers = async () => {
    if (!currentWorkspace) return;
    try {
      const res = await api.get(`/api/workspaces/${currentWorkspace.id}`);
      setMembers(res.data.workspace.members || []);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchMembers(); }, [currentWorkspace]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      await api.post(`/api/workspaces/${currentWorkspace?.id}/invite`, { email, role: 'member' });
      setEmail('');
      alert('Invitation sent');
    } catch (err: any) { alert(err.response?.data?.error || 'Failed'); }
    finally { setLoading(false); }
  };

  const handleRemove = async (userId: string) => {
    if (!window.confirm('Are you sure?')) return;
    try {
        await api.delete(`/api/workspaces/${currentWorkspace?.id}/members/${userId}`);
        fetchMembers();
    } catch (err) { alert('Failed to remove member'); }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Team Management</h2>
      <form onSubmit={handleInvite} className="flex gap-2">
        <input 
            type="email" 
            placeholder="User Email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            className="bg-slate-900 border border-slate-800 rounded p-2 text-white text-sm"
        />
        <button type="submit" disabled={loading} className="bg-indigo-600 px-4 py-2 text-white rounded text-sm">
            {loading ? 'Inviting...' : 'Invite'}
        </button>
      </form>

      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950 text-slate-400 p-2">
                <tr><th className="p-3">User</th><th className="p-3">Role</th><th className="p-3">Actions</th></tr>
            </thead>
            <tbody>
                {members.map((m: any) => (
                    <tr key={m.userId._id || m.userId} className="border-t border-slate-800">
                        <td className="p-3">{m.userId.name || m.userId.email || 'Unknown'}</td>
                        <td className="p-3">{m.role}</td>
                        <td className="p-3">
                            <button onClick={() => handleRemove(m.userId._id || m.userId)} className="text-red-400 text-xs">Remove</button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>
    </div>
  );
}
