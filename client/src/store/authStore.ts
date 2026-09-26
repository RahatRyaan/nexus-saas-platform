import { create } from 'zustand';

export type Role = 'owner' | 'admin' | 'member';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  defaultWorkspaceId?: string;
  role?: Role;
}

export interface WorkspaceItem {
  id: string;
  name: string;
  slug: string;
  role: Role;
  plan: 'free' | 'pro';
}

interface AuthState {
  user: User | null;
  workspaces: WorkspaceItem[];
  currentWorkspace: WorkspaceItem | null;
  currentRole: Role;
  isAuthenticated: boolean;
  setUser: (user: User | null, role?: Role) => void;
  setWorkspaces: (workspaces: WorkspaceItem[]) => void;
  setCurrentWorkspace: (workspace: WorkspaceItem) => void;
  setCurrentRole: (role: Role) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  workspaces: [],
  currentWorkspace: null,
  currentRole: 'member',
  isAuthenticated: false,
  setUser: (user, role = 'member') =>
    set({
      user: user ? { ...user, role } : null,
      isAuthenticated: !!user,
      currentRole: role,
    }),
  setWorkspaces: (workspaces) => set({ workspaces }),
  setCurrentWorkspace: (currentWorkspace) =>
    set({
      currentWorkspace,
      currentRole: currentWorkspace.role,
    }),
  setCurrentRole: (currentRole) => set({ currentRole }),
  logout: () => {
    localStorage.removeItem('accessToken');
    set({
      user: null,
      workspaces: [],
      currentWorkspace: null,
      currentRole: 'member',
      isAuthenticated: false,
    });
  },
}));
