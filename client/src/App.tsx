import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Kanban, MessageSquare, BookOpen, Sparkles, CreditCard, LogOut, Plus, 
  UserPlus, ChevronDown, UserCheck, Crown, ShieldCheck, Users
} from 'lucide-react';
import { useAuthStore, Role, WorkspaceItem } from './store/authStore';
import { api } from './lib/api';
import { DashboardView } from './components/DashboardView';
import { KanbanWrapper } from './components/KanbanBoard';
import { TeamChat } from './components/TeamChat';
import { KnowledgeBase } from './components/KnowledgeBase';
import { AIAssistant } from './components/AIAssistant';
import { TeamManagement } from './components/TeamManagement';
import { BillingPortal } from './components/BillingPortal';
import { ProfileSettings } from './components/ProfileSettings';

// --- Authentication View ---
function AuthView() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('owner@nexus.app');
  const [password, setPassword] = useState('Password123!');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const { setUser, setWorkspaces, setCurrentWorkspace } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAuthError('');
    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const payload = isLogin ? { email, password } : { name, email, password };
      const res = await api.post(endpoint, payload);
      localStorage.setItem('accessToken', res.data.accessToken);

      // Immediately fetch user workspaces upon login
      const wsRes = await api.get('/api/workspaces', {
        headers: { Authorization: `Bearer ${res.data.accessToken}` },
      });

      const workspaces = wsRes.data.workspaces.map((ws: any) => {
        const currentUserId = res.data.user.id || res.data.user.userId;
        const isOwner = ws.ownerId === currentUserId || ws.ownerId?._id === currentUserId;
        const memberEntry = ws.members?.find((m: any) => (m.userId?._id || m.userId) === currentUserId);
        return {
          id: ws._id,
          name: ws.name,
          slug: ws.slug,
          plan: ws.plan,
          role: isOwner ? 'owner' : memberEntry?.role || 'member',
        };
      });

      const activeWs = workspaces[0] || null;
      setUser(
        {
          id: res.data.user.id || res.data.user.userId,
          email: res.data.user.email,
          name: res.data.user.name || res.data.user.email.split('@')[0],
          defaultWorkspaceId: activeWs?.id,
          role: activeWs?.role || 'member',
        },
        activeWs?.role || 'member',
      );

      setWorkspaces(workspaces);
      if (activeWs) setCurrentWorkspace(activeWs);
    } catch (err: any) {
      setAuthError(err.response?.data?.error || 'Authentication failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const quickSelect = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('Password123!');
    setAuthError('');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-8 shadow-2xl">
        <div className="flex items-center gap-3 justify-center mb-6">
          <div className="h-10 w-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-500/30">
            N
          </div>
          <span className="text-2xl font-bold text-white tracking-tight">Nexus Workspace</span>
        </div>

        {/* Quick Demo Switcher */}
        <div className="bg-slate-950 border border-slate-800 p-1.5 rounded-xl flex gap-1 mb-6 text-xs">
          <button
            type="button"
            onClick={() => quickSelect('owner@nexus.app')}
            className={`flex-1 py-1.5 rounded-lg font-medium transition ${
              email === 'owner@nexus.app' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Owner
          </button>
          <button
            type="button"
            onClick={() => quickSelect('admin@nexus.app')}
            className={`flex-1 py-1.5 rounded-lg font-medium transition ${
              email === 'admin@nexus.app' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Admin
          </button>
          <button
            type="button"
            onClick={() => quickSelect('member@nexus.app')}
            className={`flex-1 py-1.5 rounded-lg font-medium transition ${
              email === 'member@nexus.app' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Member
          </button>
        </div>

        {authError && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-3 rounded-xl mb-4">
            {authError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <input
              type="text"
              placeholder="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 rounded-lg text-sm transition shadow-lg shadow-indigo-600/30"
          >
            {loading ? 'Authenticating...' : isLogin ? 'Sign In' : 'Register'}
          </button>
        </form>

        <button
          onClick={() => {
            setIsLogin(!isLogin);
            setAuthError('');
          }}
          className="mt-4 text-xs text-indigo-400 hover:underline w-full text-center"
        >
          {isLogin ? 'Need a new account? Sign up' : 'Already registered? Login'}
        </button>
      </div>
    </div>
  );
}

// --- Workspace Switcher Component ---
function WorkspaceSwitcher() {
  const { workspaces, currentWorkspace, setCurrentWorkspace, setWorkspaces } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [newWsName, setNewWsName] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim()) return;
    try {
      const res = await api.post('/api/workspaces', { name: newWsName });
      const created: WorkspaceItem = {
        id: res.data.workspace._id,
        name: res.data.workspace.name,
        slug: res.data.workspace.slug,
        plan: res.data.workspace.plan,
        role: 'owner',
      };
      setWorkspaces([...workspaces, created]);
      setCurrentWorkspace(created);
      setShowModal(false);
      setNewWsName('');
    } catch (err) {
      alert('Failed to create workspace');
    }
  };

  return (
    <div className="relative mb-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-2.5 py-2.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 rounded-lg transition"
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="h-6 w-6 rounded bg-indigo-600 flex items-center justify-center font-bold text-xs text-white shrink-0">
            {currentWorkspace?.name?.charAt(0) || 'W'}
          </div>
          <span className="text-xs font-bold text-white truncate">{currentWorkspace?.name || 'Select Workspace'}</span>
        </div>
        <ChevronDown size={14} className="text-slate-400 shrink-0 ml-1" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 w-full mt-1.5 bg-slate-900 border border-slate-800 rounded-xl p-1.5 z-20 shadow-2xl">
          <div className="text-[10px] font-semibold text-slate-400 px-2 py-1 uppercase tracking-wider">My Workspaces</div>
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() => {
                setCurrentWorkspace(ws);
                setIsOpen(false);
              }}
              className={`block w-full text-left px-2.5 py-1.5 text-xs rounded-lg transition ${
                currentWorkspace?.id === ws.id
                  ? 'bg-indigo-600 text-white font-medium'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              {ws.name}
            </button>
          ))}
          <div className="border-t border-slate-800 my-1"></div>
          <button
            onClick={() => {
              setShowModal(true);
              setIsOpen(false);
            }}
            className="flex items-center gap-1.5 w-full text-left px-2 py-1.5 text-xs text-indigo-400 hover:bg-slate-800 rounded-lg transition"
          >
            <Plus size={13} /> Create Workspace
          </button>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl w-full max-w-sm shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">Create New Workspace</h3>
            <p className="text-xs text-slate-400 mb-4">You will be designated as the Owner with full administrative permissions.</p>
            <form onSubmit={handleCreate}>
              <input
                type="text"
                placeholder="Workspace Name (e.g. Growth Marketing)"
                value={newWsName}
                onChange={(e) => setNewWsName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white text-xs mb-4 focus:outline-none focus:border-indigo-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 px-4 py-1.5 text-xs text-white font-medium rounded-lg shadow"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Main Layout ---
function MainLayout({ children }: { children: React.ReactNode }) {
  const { currentRole, user, logout } = useAuthStore();
  const location = useLocation();

  const getRoleBadge = (role: Role) => {
    switch (role) {
      case 'owner':
        return (
          <span className="flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
            <Crown size={12} /> Owner
          </span>
        );
      case 'admin':
        return (
          <span className="flex items-center gap-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
            <ShieldCheck size={12} /> Admin
          </span>
        );
      case 'member':
        return (
          <span className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
            <Users size={12} /> Member
          </span>
        );
    }
  };

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['owner', 'admin', 'member'] },
    { to: '/boards', label: 'Kanban Roadmap', icon: Kanban, roles: ['owner', 'admin', 'member'] },
    { to: '/chat', label: 'Team Chat', icon: MessageSquare, roles: ['owner', 'admin', 'member'] },
    { to: '/knowledge', label: 'Knowledge Base', icon: BookOpen, roles: ['owner', 'admin', 'member'] },
    { to: '/ai', label: 'AI Assistant', icon: Sparkles, roles: ['owner', 'admin', 'member'] },
    { to: '/team', label: 'Team Management', icon: UserPlus, roles: ['owner', 'admin'] },
    { to: '/billing', label: 'Billing & Plans', icon: CreditCard, roles: ['owner', 'admin', 'member'] },
    { to: '/profile', label: 'My Profile & Avatar', icon: UserCheck, roles: ['owner', 'admin', 'member'] },
  ];

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <aside className="w-64 border-r border-slate-800 bg-slate-900 flex flex-col justify-between p-4 shrink-0">
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Workspace</div>
            {getRoleBadge(currentRole)}
          </div>
          <WorkspaceSwitcher />

          <nav className="space-y-1">
            {navItems
              .filter((item) => item.roles.includes(currentRole))
              .map((item) => {
                const Icon = item.icon;
                const active = location.pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition ${
                      active
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Icon size={16} /> {item.label}
                  </Link>
                );
              })}
          </nav>
        </div>

        <div className="border-t border-slate-800 pt-4 px-2">
          <div className="flex items-center justify-between">
            <Link to="/profile" className="flex items-center gap-2 overflow-hidden hover:opacity-80 transition">
              <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center font-bold text-xs text-white shrink-0">
                {user?.avatar ? (
                  <img src={user.avatar} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  user?.name?.charAt(0) || 'U'
                )}
              </div>
              <div className="truncate">
                <p className="text-xs font-medium text-white truncate">{user?.name}</p>
                <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
              </div>
            </Link>
            <button
              onClick={logout}
              title="Logout"
              className="text-slate-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-800 transition"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-slate-950 p-8">{children}</main>
    </div>
  );
}

// --- App Root Router ---
export function App() {
  const { isAuthenticated, setUser, setWorkspaces, setCurrentWorkspace } = useAuthStore();

  useEffect(() => {
    async function initSession() {
      const token = localStorage.getItem('accessToken');
      if (token) {
        try {
          const res = await api.get('/api/auth/me');
          if (res.data.user) {
            const wsRes = await api.get('/api/workspaces');
            const workspaces = wsRes.data.workspaces.map((ws: any) => {
              const currentUserId = res.data.user.userId;
              const isOwner = ws.ownerId === currentUserId || ws.ownerId?._id === currentUserId;
              const memberEntry = ws.members?.find((m: any) => (m.userId?._id || m.userId) === currentUserId);
              return {
                id: ws._id,
                name: ws.name,
                slug: ws.slug,
                plan: ws.plan,
                role: isOwner ? 'owner' : memberEntry?.role || 'member',
              };
            });

            const activeWs = workspaces[0] || null;
            setUser(
              {
                id: res.data.user.userId,
                email: res.data.user.email,
                name: res.data.user.name || res.data.user.email.split('@')[0],
                defaultWorkspaceId: activeWs?.id || res.data.user.workspaceId,
                role: activeWs?.role || 'member',
              },
              activeWs?.role || 'member',
            );

            setWorkspaces(workspaces);
            if (activeWs) setCurrentWorkspace(activeWs);
          }
        } catch {
          localStorage.removeItem('accessToken');
        }
      }
    }
    initSession();
  }, [isAuthenticated]);

  if (!isAuthenticated) return <AuthView />;

  return (
    <BrowserRouter>
      <MainLayout>
        <Routes>
          <Route path="/dashboard" element={<DashboardView />} />
          <Route path="/boards" element={<KanbanWrapper />} />
          <Route path="/chat" element={<TeamChat />} />
          <Route path="/knowledge" element={<KnowledgeBase />} />
          <Route path="/ai" element={<AIAssistant />} />
          <Route path="/team" element={<TeamManagement />} />
          <Route path="/billing" element={<BillingPortal />} />
          <Route path="/profile" element={<ProfileSettings />} />
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
      </MainLayout>
    </BrowserRouter>
  );
}
