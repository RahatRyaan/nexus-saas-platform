import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import { Kanban, MessageSquare, BookOpen, CreditCard, Crown, ShieldCheck, Users, CheckCircle, Activity, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

export function DashboardView() {
  const { user, currentWorkspace, currentRole } = useAuthStore();
  const [stats, setStats] = useState({ boards: 0, messages: 0, docs: 0, members: 0 });
  const [activities, setActivities] = useState<any[]>([]);

  useEffect(() => {
    async function loadDashboardData() {
      if (!currentWorkspace) return;
      try {
        const [boardsRes, docsRes, wsRes, actRes] = await Promise.all([
          api.get(`/api/boards?workspaceId=${currentWorkspace.id}`),
          api.get(`/api/knowledge?workspaceId=${currentWorkspace.id}`),
          api.get(`/api/workspaces/${currentWorkspace.id}`),
          api.get(`/api/workspaces/${currentWorkspace.id}/activity`).catch(() => ({ data: { logs: [] } })),
        ]);

        setStats({
          boards: boardsRes.data.boards?.length || 0,
          docs: docsRes.data.documents?.length || 0,
          members: wsRes.data.workspace?.members?.length || 1,
          messages: 12,
        });

        setActivities(actRes.data.logs || []);
      } catch (err) {
        console.error('Failed to load dashboard statistics', err);
      }
    }
    loadDashboardData();
  }, [currentWorkspace]);

  if (!currentWorkspace) {
    return <div className="text-slate-400 text-sm">Please select or create a workspace from the sidebar.</div>;
  }

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">
          {currentWorkspace.name} Overview
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Signed in as <span className="text-white font-medium">{user?.name}</span> ({user?.email})
        </p>
      </div>

      {/* Role Banner */}
      <div className={`p-4 rounded-xl border flex items-start gap-3.5 ${
        currentRole === 'owner'
          ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
          : currentRole === 'admin'
          ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300'
          : 'bg-slate-900 border-slate-800 text-slate-300'
      }`}>
        {currentRole === 'owner' && <Crown className="shrink-0 mt-0.5" size={18} />}
        {currentRole === 'admin' && <ShieldCheck className="shrink-0 mt-0.5" size={18} />}
        {currentRole === 'member' && <Users className="shrink-0 mt-0.5" size={18} />}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-1">
            {currentRole === 'owner' && '👑 Workspace Owner Privileges Active'}
            {currentRole === 'admin' && '🛡️ Workspace Admin Access'}
            {currentRole === 'member' && '👥 Team Member Collaboration Mode'}
          </h3>
          <p className="text-xs opacity-90 leading-relaxed">
            {currentRole === 'owner' && 'You have unrestricted control over SSLCommerz payments, role promotions, member management, and workspace settings.'}
            {currentRole === 'admin' && 'You can invite colleagues, moderate roadmap lists, and inspect system audit logs.'}
            {currentRole === 'member' && 'You have full access to create/move Kanban cards, chat with colleagues in real-time, and query the AI knowledge base.'}
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex justify-between items-center text-slate-400 text-xs mb-2">
            <span>Roadmap Boards</span>
            <Kanban size={16} className="text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white">{stats.boards}</div>
          <Link to="/boards" className="text-[11px] text-indigo-400 hover:underline mt-2 inline-block">View Boards &rarr;</Link>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex justify-between items-center text-slate-400 text-xs mb-2">
            <span>Knowledge Docs</span>
            <BookOpen size={16} className="text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white">{stats.docs}</div>
          <Link to="/knowledge" className="text-[11px] text-indigo-400 hover:underline mt-2 inline-block">Manage Docs &rarr;</Link>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex justify-between items-center text-slate-400 text-xs mb-2">
            <span>Team Members</span>
            <Users size={16} className="text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white">{stats.members}</div>
          <Link to="/team" className="text-[11px] text-indigo-400 hover:underline mt-2 inline-block">Manage Team &rarr;</Link>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex justify-between items-center text-slate-400 text-xs mb-2">
            <span>Workspace Tier</span>
            <CreditCard size={16} className="text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 capitalize">{currentWorkspace.plan} Plan</div>
          <Link to="/billing" className="text-[11px] text-emerald-400 hover:underline mt-2 inline-block">Billing Portal &rarr;</Link>
        </div>
      </div>

      {/* Quick Launch & Activity Feed */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <CheckCircle size={16} className="text-indigo-400" /> Quick Workspace Actions
          </h2>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <Link to="/boards" className="bg-slate-950 hover:bg-slate-800/80 border border-slate-800 p-3 rounded-lg text-slate-200 flex flex-col gap-1 transition">
              <span className="font-semibold text-white">Open Kanban</span>
              <span className="text-[11px] text-slate-400">Manage real-time tasks</span>
            </Link>
            <Link to="/chat" className="bg-slate-950 hover:bg-slate-800/80 border border-slate-800 p-3 rounded-lg text-slate-200 flex flex-col gap-1 transition">
              <span className="font-semibold text-white">Team Chat</span>
              <span className="text-[11px] text-slate-400">Live Socket.io channels</span>
            </Link>
            <Link to="/ai" className="bg-slate-950 hover:bg-slate-800/80 border border-slate-800 p-3 rounded-lg text-slate-200 flex flex-col gap-1 transition">
              <span className="font-semibold text-white">AI Assistant</span>
              <span className="text-[11px] text-slate-400">RAG Q&A & task breakdown</span>
            </Link>
            <Link to="/knowledge" className="bg-slate-950 hover:bg-slate-800/80 border border-slate-800 p-3 rounded-lg text-slate-200 flex flex-col gap-1 transition">
              <span className="font-semibold text-white">Knowledge Base</span>
              <span className="text-[11px] text-slate-400">pgvector vector search</span>
            </Link>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Activity size={16} className="text-indigo-400" /> Recent Audit Activity
          </h2>
          <div className="space-y-2.5">
            {activities.length === 0 ? (
              <div className="text-xs text-slate-500 py-4">No recent activity logged for this workspace.</div>
            ) : (
              activities.slice(0, 4).map((act, i) => (
                <div key={i} className="flex justify-between items-center text-xs p-2.5 rounded bg-slate-950/60 border border-slate-800/80">
                  <span className="text-slate-300 font-mono text-[11px]">{act.action}</span>
                  <span className="text-slate-500 text-[10px]">{new Date(act.timestamp).toLocaleTimeString()}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
