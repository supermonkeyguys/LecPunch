import type { User } from '@lecpunch/shared';
import { useAuthStore, type AuthStoreState } from './auth-store';
import { useCheckinStore, type CheckinStoreState } from './checkin-store';
import {
  useUIStore,
  type SelectedMember,
  type UIStoreState,
  type WeekKey
} from './ui-store';

export type { WeekKey, SelectedMember };

export type RootState = UIStoreState & CheckinStoreState & AuthStoreState;

type RootSelector<T> = (state: RootState) => T;

type RootStateUpdater = Partial<RootState> | ((state: RootState) => Partial<RootState>);

const getRootState = (): RootState => ({
  ...useUIStore.getState(),
  ...useCheckinStore.getState(),
  ...useAuthStore.getState()
});

const applyRootPatch = (patch: Partial<RootState>) => {
  const uiPatch: Partial<UIStoreState> = {};
  if ('currentView' in patch) {
    uiPatch.currentView = patch.currentView as UIStoreState['currentView'];
  }
  if ('selectedWeek' in patch) {
    uiPatch.selectedWeek = patch.selectedWeek as WeekKey;
  }
  if ('selectedMember' in patch) {
    uiPatch.selectedMember = patch.selectedMember as SelectedMember | null;
  }
  if (Object.keys(uiPatch).length > 0) {
    useUIStore.setState(uiPatch);
  }

  const checkinPatch: Partial<CheckinStoreState> = {};
  if ('checkinState' in patch) {
    checkinPatch.checkinState = patch.checkinState as CheckinStoreState['checkinState'];
  }
  if (Object.keys(checkinPatch).length > 0) {
    useCheckinStore.setState(checkinPatch);
  }

  const authPatch: Partial<AuthStoreState> = {};
  if ('auth' in patch) {
    authPatch.auth = patch.auth as { token: string | null; user: User | null };
  }
  if ('authInitializing' in patch) {
    authPatch.authInitializing = patch.authInitializing as boolean;
  }
  if (Object.keys(authPatch).length > 0) {
    useAuthStore.setState(authPatch);
  }
};

const setRootState = (updater: RootStateUpdater) => {
  const current = getRootState();
  const patch = typeof updater === 'function' ? updater(current) : updater;
  applyRootPatch(patch);
};

const useRootStoreBase = <T>(selector: RootSelector<T>) => {
  const uiState = useUIStore((state) => state);
  const checkinState = useCheckinStore((state) => state);
  const authState = useAuthStore((state) => state);

  return selector({
    ...uiState,
    ...checkinState,
    ...authState
  });
};

interface UseRootStore {
  <T>(selector: RootSelector<T>): T;
  getState: () => RootState;
  setState: (updater: RootStateUpdater) => void;
}

export const useRootStore = useRootStoreBase as UseRootStore;
useRootStore.getState = getRootState;
useRootStore.setState = setRootState;
