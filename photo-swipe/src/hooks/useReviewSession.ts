import { addListener as addLibraryListener } from 'expo-media-library';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { AppState } from 'react-native';

import { PAGE_SIZE, deletePhotos, fetchPhotoPage } from '../lib/photoLibrary';
import { loadState, saveState } from '../lib/reviewStorage';
import type { Decision, Photo, SortOrder, SwipeAction } from '../types';

/** Keep at least this many unreviewed photos loaded ahead of the user. */
const MIN_BUFFER = 10;
/** How many decisions can be undone. */
const MAX_HISTORY = 300;
const SAVE_DEBOUNCE_MS = 700;

export type Entrance = { id: string; from: 'left' | 'right' } | null;

export type DeleteResult = { deleted: number; error?: string };

/** useState whose latest value is also readable synchronously through a ref. */
function useSyncedState<T>(initial: T): [T, RefObject<T>, (next: T) => void] {
  const [value, setValue] = useState(initial);
  const ref = useRef(initial);
  const set = useCallback((next: T) => {
    ref.current = next;
    setValue(next);
  }, []);
  return [value, ref, set];
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useReviewSession() {
  const [booted, setBooted] = useState(false);
  const [order, setOrderState] = useState<SortOrder>('newest');
  const [queue, queueRef, setQueue] = useSyncedState<Photo[]>([]);
  const [pending, pendingRef, setPendingState] = useSyncedState<Photo[]>([]);
  const [history, historyRef, setHistory] = useSyncedState<Decision[]>([]);
  const [keptCount, setKeptCount] = useState(0);
  const [deletedTotal, setDeletedTotal] = useState(0);
  const [exhausted, setExhausted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entrance, setEntrance] = useState<Entrance>(null);
  /** Bumped on every mutation that should be persisted. */
  const [version, setVersion] = useState(0);

  const keptRef = useRef<Set<string>>(new Set());
  const pendingIdsRef = useRef<Set<string>>(new Set());
  const orderRef = useRef<SortOrder>('newest');
  const offsetRef = useRef(0);
  const exhaustedRef = useRef(false);
  const loadingRef = useRef(false);
  const deletingRef = useRef(false);
  const deletedTotalRef = useRef(0);
  /** Invalidates in-flight page loads after a reset or an order change. */
  const generationRef = useRef(0);

  const touch = useCallback(() => setVersion((v) => v + 1), []);

  const setPending = useCallback(
    (next: Photo[]) => {
      pendingIdsRef.current = new Set(next.map((photo) => photo.id));
      setPendingState(next);
    },
    [setPendingState],
  );

  const setKept = useCallback((next: Set<string>) => {
    keptRef.current = next;
    setKeptCount(next.size);
  }, []);

  const snapshot = useCallback(
    () => ({
      keptIds: Array.from(keptRef.current),
      pending: pendingRef.current,
      deletedTotal: deletedTotalRef.current,
      order: orderRef.current,
    }),
    [pendingRef],
  );

  // Restore the previous session.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const saved = await loadState();
      if (cancelled) return;
      setKept(new Set(saved.keptIds));
      setPending(saved.pending);
      deletedTotalRef.current = saved.deletedTotal;
      setDeletedTotal(saved.deletedTotal);
      orderRef.current = saved.order;
      setOrderState(saved.order);
      setBooted(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [setKept, setPending]);

  // Persist shortly after every change, and immediately when the app goes to the background.
  useEffect(() => {
    if (!booted) return;
    const timer = setTimeout(() => void saveState(snapshot()), SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [booted, version, snapshot]);

  useEffect(() => {
    if (!booted) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') void saveState(snapshot());
    });
    return () => subscription.remove();
  }, [booted, snapshot]);

  const fillBuffer = useCallback(async () => {
    if (loadingRef.current || exhaustedRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    const generation = generationRef.current;
    try {
      const fresh: Photo[] = [];
      while (!exhaustedRef.current && queueRef.current.length + fresh.length < MIN_BUFFER) {
        const page = await fetchPhotoPage(offsetRef.current, orderRef.current);
        if (generation !== generationRef.current) return;
        offsetRef.current += page.length;
        if (page.length < PAGE_SIZE) exhaustedRef.current = true;
        for (const photo of page) {
          if (keptRef.current.has(photo.id) || pendingIdsRef.current.has(photo.id)) continue;
          fresh.push(photo);
        }
      }
      if (fresh.length > 0) {
        const known = new Set(queueRef.current.map((photo) => photo.id));
        setQueue([...queueRef.current, ...fresh.filter((photo) => !known.has(photo.id))]);
      }
      setExhausted(exhaustedRef.current);
      setError(null);
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      if (generation === generationRef.current) {
        loadingRef.current = false;
        setLoading(false);
      }
    }
  }, [queueRef, setQueue]);

  useEffect(() => {
    if (!booted || exhausted || error) return;
    if (queue.length < MIN_BUFFER) void fillBuffer();
  }, [booted, exhausted, error, queue.length, version, fillBuffer]);

  const decide = useCallback(
    (photo: Photo, action: SwipeAction) => {
      const rest = queueRef.current.filter((candidate) => candidate.id !== photo.id);
      if (rest.length === queueRef.current.length) return; // Already handled.
      setQueue(rest);
      if (action === 'keep') {
        const kept = new Set(keptRef.current);
        kept.add(photo.id);
        setKept(kept);
      } else {
        setPending([...pendingRef.current, photo]);
      }
      setHistory([...historyRef.current, { photo, action }].slice(-MAX_HISTORY));
      setEntrance(null);
      touch();
    },
    [historyRef, pendingRef, queueRef, setHistory, setKept, setPending, setQueue, touch],
  );

  const undo = useCallback(() => {
    const last = historyRef.current[historyRef.current.length - 1];
    if (!last) return;
    setHistory(historyRef.current.slice(0, -1));
    if (last.action === 'keep') {
      const kept = new Set(keptRef.current);
      kept.delete(last.photo.id);
      setKept(kept);
    } else {
      setPending(pendingRef.current.filter((photo) => photo.id !== last.photo.id));
    }
    setQueue([last.photo, ...queueRef.current.filter((photo) => photo.id !== last.photo.id)]);
    setEntrance({ id: last.photo.id, from: last.action === 'delete' ? 'left' : 'right' });
    touch();
  }, [historyRef, pendingRef, queueRef, setHistory, setKept, setPending, setQueue, touch]);

  /** Takes photos out of the trash and marks them as kept. */
  const restoreFromTrash = useCallback(
    (photos: Photo[]) => {
      if (photos.length === 0) return;
      const ids = new Set(photos.map((photo) => photo.id));
      setPending(pendingRef.current.filter((photo) => !ids.has(photo.id)));
      const kept = new Set(keptRef.current);
      ids.forEach((id) => kept.add(id));
      setKept(kept);
      setHistory(historyRef.current.filter((decision) => !ids.has(decision.photo.id)));
      touch();
    },
    [historyRef, pendingRef, setHistory, setKept, setPending, touch],
  );

  /** Deletes everything in the trash from the device with a single system confirmation. */
  const emptyTrash = useCallback(async (): Promise<DeleteResult> => {
    const batch = pendingRef.current;
    if (batch.length === 0 || deletingRef.current) return { deleted: 0 };
    deletingRef.current = true;
    setDeleting(true);
    try {
      await deletePhotos(batch);
      const ids = new Set(batch.map((photo) => photo.id));
      setPending(pendingRef.current.filter((photo) => !ids.has(photo.id)));
      setHistory(historyRef.current.filter((decision) => !ids.has(decision.photo.id)));
      // Every deleted photo sat before the pagination cursor, so shift it back.
      offsetRef.current = Math.max(0, offsetRef.current - batch.length);
      deletedTotalRef.current += batch.length;
      setDeletedTotal(deletedTotalRef.current);
      touch();
      return { deleted: batch.length };
    } catch (caught) {
      return { deleted: 0, error: describeError(caught) };
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  }, [historyRef, pendingRef, setHistory, setPending, touch]);

  const restartQueue = useCallback(() => {
    generationRef.current += 1;
    loadingRef.current = false;
    setLoading(false);
    setQueue([]);
    offsetRef.current = 0;
    exhaustedRef.current = false;
    setExhausted(false);
    setEntrance(null);
    setError(null);
  }, [setQueue]);

  // When the library changes after we reached the end (new photos, a wider "limited"
  // selection, deletions from another app) scan it again. Kept and trashed photos are
  // filtered out, so only genuinely new photos show up.
  useEffect(() => {
    if (!booted) return;
    const subscription = addLibraryListener(() => {
      if (deletingRef.current || loadingRef.current || !exhaustedRef.current) return;
      restartQueue();
    });
    return () => subscription.remove();
  }, [booted, restartQueue]);

  /** Forgets which photos were kept so they show up again. The trash is untouched. */
  const resetProgress = useCallback(() => {
    setKept(new Set());
    setHistory([]);
    restartQueue();
    touch();
  }, [restartQueue, setHistory, setKept, touch]);

  const setOrder = useCallback(
    (next: SortOrder) => {
      if (next === orderRef.current) return;
      orderRef.current = next;
      setOrderState(next);
      setHistory([]);
      restartQueue();
      touch();
    },
    [restartQueue, setHistory, touch],
  );

  const retry = useCallback(() => {
    setError(null);
    touch();
  }, [touch]);

  return {
    booted,
    order,
    setOrder,
    queue,
    pending,
    history,
    keptCount,
    deletedTotal,
    exhausted,
    loading,
    deleting,
    error,
    entrance,
    decide,
    undo,
    restoreFromTrash,
    emptyTrash,
    resetProgress,
    retry,
  };
}

export type ReviewSession = ReturnType<typeof useReviewSession>;
