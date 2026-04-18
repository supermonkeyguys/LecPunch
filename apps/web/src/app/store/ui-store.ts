import { create } from 'zustand';

export type WeekKey = 'current' | 'prev1' | 'prev2' | 'prev3';

export interface SelectedMember {
  id: string;
  displayName: string;
}

export interface UIStoreState {
  currentView: 'login' | 'dashboard' | 'history' | 'team';
  selectedWeek: WeekKey;
  selectedMember: SelectedMember | null;
  setCurrentView: (view: UIStoreState['currentView']) => void;
  setSelectedWeek: (week: WeekKey) => void;
  setSelectedMember: (member: SelectedMember | null) => void;
}

export const useUIStore = create<UIStoreState>((set) => ({
  currentView: 'login',
  selectedWeek: 'current',
  selectedMember: null,
  setCurrentView: (view) => set({ currentView: view }),
  setSelectedWeek: (selectedWeek) => set({ selectedWeek }),
  setSelectedMember: (selectedMember) => set({ selectedMember })
}));
