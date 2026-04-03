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
  setCurrentView: (view: RootState['currentView']) => void;
  setSelectedWeek: (week: WeekKey) => void;
  setSelectedMember: (member: SelectedMember | null) => void;
  updateCheckinState: (patch: Partial<CheckinState>) => void;
  setAuth: (payload: AuthState) => void;
}

export const useRootStore = create<RootState>((set) => ({
  currentView: 'login',
  selectedWeek: 'current',
  selectedMember: null,
  checkinState: {
    isCheckedIn: false,
    elapsedSeconds: 0
  },
  auth: {
    token: null,
    user: null
  },
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
  setAuth: (payload) => set({ auth: payload })
}));
