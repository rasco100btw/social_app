import { create } from 'zustand';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (user: User) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  login: (user) => set({ user, isAuthenticated: true }),
  logout: () => set({ user: null, isAuthenticated: false }),
  updateUser: (updates) => set((state) => {
    if (!state.user) return state;

    // Handle both avatar_url and avatar fields
    const avatar = updates.avatar_url || updates.avatar;

    return {
      ...state,
      user: {
        ...state.user,
        ...updates,
        // Update both avatar fields to ensure consistency
        ...(avatar ? { avatar, avatar_url: avatar } : {}),
      },
    };
  }),
}));