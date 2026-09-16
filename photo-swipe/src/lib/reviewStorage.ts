import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Photo, SortOrder } from '../types';

const STORAGE_KEY = '@limpiafotos/state.v1';

export type PersistedState = {
  /** IDs of photos the user swiped right on. They are skipped next time. */
  keptIds: string[];
  /** Photos swiped left that have not been deleted from the device yet. */
  pending: Photo[];
  /** Photos actually deleted from the device by this app. */
  deletedTotal: number;
  order: SortOrder;
};

export const EMPTY_STATE: PersistedState = {
  keptIds: [],
  pending: [],
  deletedTotal: 0,
  order: 'newest',
};

export async function loadState(): Promise<PersistedState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      keptIds: Array.isArray(parsed.keptIds) ? parsed.keptIds : [],
      pending: Array.isArray(parsed.pending) ? parsed.pending : [],
      deletedTotal: typeof parsed.deletedTotal === 'number' ? parsed.deletedTotal : 0,
      order: parsed.order === 'oldest' ? 'oldest' : 'newest',
    };
  } catch {
    return EMPTY_STATE;
  }
}

export async function saveState(state: PersistedState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Losing progress is annoying but not fatal; the photos themselves are untouched.
  }
}

export async function clearState(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
}
