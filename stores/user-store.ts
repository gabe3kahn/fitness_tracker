import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';

interface Profile {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

interface UserStore {
  user: User | null;
  profile: Profile | null;
  setUser: (user: User | null) => void;
  setProfile: (profile: Profile | null) => void;
}

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  profile: null,
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
}));
