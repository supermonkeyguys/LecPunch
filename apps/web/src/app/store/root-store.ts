import { create } from 'zustand';
import type { User } from '@lecpunch/shared';

type WeekKey = 'current' | 'prev1' | 'prev2' | 'prev3';

interface SelectedMember {
  id: string;
  displayName: string;
}

interface CheckinState {
  isCheckedIn: boolean;
  elapsedSeconds: number;
}

interface AuthState {
  token: string | null;
  user: User | null;
}

interface RootState {
  currentView: 'login' | 'dashboard' | 'history' | 'team';
  selectedWeek: WeekKey;
  selectedMember: SelectedMember | null;
  checkinState: CheckinState;
  auth: AuthState;
  authInitializing: boolean;
  setCurrentView: (view: RootState['currentView']) => void;
  setSelectedWeek: (week: WeekKey) => void;
  setSelectedMember: (member: SelectedMember | null) => void;
  updateCheckinState: (patch: Partial<CheckinState>) => void;
  setAuth: (payload: AuthState) => void;
  updateUser: (patch: Partial<User>) => void;
  setAuthInitializing: (value: boolean) => void;
}

// Synchronously restore auth from localStorage before any component renders
const _storedToken = localStorage.getItem('lecpunch.token');
const _storedUser = (() => {
  try {
    const raw = localStorage.getItem('lecpunch.user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
})();

export const useRootStore = create<RootState>((set) => ({
  currentView: 'login',
  selectedWeek: 'current',
  selectedMember: null,
  checkinState: {
    isCheckedIn: false,
    elapsedSeconds: 0
  },
  auth: {
    token: _storedToken,
    user: _storedUser
  },
  authInitializing: false,
  setCurrentView: (view) => set({ currentView: view }),
  setSelectedWeek: (selectedWeek) => set({ selectedWeek }),
  setSelectedMember: (selectedMember) => set({ selectedMember }),
  updateCheckinState: (patch) =>
    set((state) => ({
      checkinState: {
        ...state.checkinState,
        ...patch
      }
    })),
  setAuth: (payload) => set({ auth: payload }),
  updateUser: (patch) =>
    set((state) => ({
      auth: {
        ...state.auth,
        user: state.auth.user ? { ...state.auth.user, ...patch } : null
      }
    })),
  setAuthInitializing: (value) => set({ authInitializing: value })
}));
