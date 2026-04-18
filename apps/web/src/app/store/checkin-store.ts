import { create } from 'zustand';

export interface CheckinState {
  isCheckedIn: boolean;
  elapsedSeconds: number;
}

export interface CheckinStoreState {
  checkinState: CheckinState;
  updateCheckinState: (patch: Partial<CheckinState>) => void;
}

export const useCheckinStore = create<CheckinStoreState>((set) => ({
  checkinState: {
    isCheckedIn: false,
    elapsedSeconds: 0
  },
  updateCheckinState: (patch) =>
    set((state) => ({
      checkinState: {
        ...state.checkinState,
        ...patch
      }
    }))
}));
