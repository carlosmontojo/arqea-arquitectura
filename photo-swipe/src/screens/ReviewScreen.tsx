import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionBar } from '../components/ActionBar';
import { SettingsSheet } from '../components/SettingsSheet';
import { SwipeCard, type SwipeCardHandle } from '../components/SwipeCard';
import { TrashSheet } from '../components/TrashSheet';
import { useReviewSession } from '../hooks/useReviewSession';
import { colors, radius, spacing } from '../theme';

type Props = {
  access: 'granted' | 'limited';
  refreshAccess: () => void;
};

/** How many upcoming photos to decode ahead of time. */
const PREFETCH_AHEAD = 4;

export function ReviewScreen({ access, refreshAccess }: Props) {
  const insets = useSafeAreaInsets();
  const session = useReviewSession();
  const topCardRef = useRef<SwipeCardHandle>(null);
  const [trashOpen, setTrashOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { queue, pending, history, entrance, decide, undo, emptyTrash } = session;

  useEffect(() => {
    const upcoming = queue.slice(1, 1 + PREFETCH_AHEAD).map((photo) => photo.id);
    if (upcoming.length > 0) {
      void Image.prefetch(upcoming, 'memory').catch(() => undefined);
    }
  }, [queue]);

  const swipeTop = useCallback((action: 'keep' | 'delete') => {
    topCardRef.current?.swipe(action);
  }, []);

  const handleEmptyTrash = useCallback(async () => {
    const result = await emptyTrash();
    if (result.error) {
      Alert.alert('No se ha borrado nada', result.error);
    } else if (result.deleted > 0) {
      Alert.alert('Listo', `Se han borrado ${result.deleted} ${result.deleted === 1 ? 'foto' : 'fotos'}.`);
    }
  }, [emptyTrash]);

  const visibleCards = queue.slice(0, 2);
  const hasCards = visibleCards.length > 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Limpia Fotos</Text>
          <Text style={styles.counters}>
            <Text style={{ color: colors.keep }}>{session.keptCount}</Text> guardadas ·{' '}
            <Text style={{ color: colors.del }}>{pending.length}</Text> en papelera ·{' '}
            {session.deletedTotal} borradas
          </Text>
        </View>
        <Pressable
          onPress={() => setTrashOpen(true)}
          accessibilityLabel="Abrir la papelera"
          hitSlop={8}
          style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="trash-outline" size={22} color={pending.length > 0 ? colors.del : colors.text} />
          {pending.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pending.length > 99 ? '99+' : pending.length}</Text>
            </View>
          )}
        </Pressable>
        <Pressable
          onPress={() => setSettingsOpen(true)}
          accessibilityLabel="Abrir ajustes"
          hitSlop={8}
          style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="options-outline" size={22} color={colors.text} />
        </Pressable>
      </View>

      {access === 'limited' && (
        <Pressable onPress={() => setSettingsOpen(true)} style={styles.limitedBanner}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.accent} />
          <Text style={styles.limitedText}>Solo ves algunas fotos. Toca para elegir más.</Text>
        </Pressable>
      )}

      <View style={styles.stage}>
        {hasCards ? (
          visibleCards
            .map((photo, index) => (
              <SwipeCard
                key={photo.id}
                ref={index === 0 ? topCardRef : undefined}
                photo={photo}
                isTop={index === 0}
                enterFrom={entrance?.id === photo.id ? entrance.from : null}
                onSwiped={decide}
              />
            ))
            .reverse()
        ) : (
          <EmptyStage
            booted={session.booted}
            loading={session.loading}
            exhausted={session.exhausted}
            error={session.error}
            pendingCount={pending.length}
            deleting={session.deleting}
            reviewedAnything={session.keptCount + pending.length + session.deletedTotal > 0}
            onRetry={session.retry}
            onEmptyTrash={handleEmptyTrash}
            onReset={session.resetProgress}
          />
        )}
      </View>

      <Text style={styles.hint}>
        <Text style={{ color: colors.del }}>← borrar</Text>
        {'     '}
        <Text style={{ color: colors.keep }}>guardar →</Text>
      </Text>

      <View style={{ paddingBottom: insets.bottom + spacing.md }}>
        <ActionBar
          onDelete={() => swipeTop('delete')}
          onKeep={() => swipeTop('keep')}
          onUndo={undo}
          canSwipe={hasCards && !session.deleting}
          canUndo={history.length > 0 && !session.deleting}
        />
      </View>

      <TrashSheet
        visible={trashOpen}
        photos={pending}
        deleting={session.deleting}
        onClose={() => setTrashOpen(false)}
        onRestore={session.restoreFromTrash}
        onEmpty={emptyTrash}
      />
      <SettingsSheet
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        order={session.order}
        onChangeOrder={session.setOrder}
        keptCount={session.keptCount}
        pendingCount={pending.length}
        deletedTotal={session.deletedTotal}
        limitedAccess={access === 'limited'}
        onAccessChanged={refreshAccess}
        onReset={session.resetProgress}
      />
    </View>
  );
}

type EmptyStageProps = {
  booted: boolean;
  loading: boolean;
  exhausted: boolean;
  error: string | null;
  pendingCount: number;
  deleting: boolean;
  reviewedAnything: boolean;
  onRetry: () => void;
  onEmptyTrash: () => void;
  onReset: () => void;
};

function EmptyStage({
  booted,
  loading,
  exhausted,
  error,
  pendingCount,
  deleting,
  reviewedAnything,
  onRetry,
  onEmptyTrash,
  onReset,
}: EmptyStageProps) {
  if (error) {
    return (
      <View style={styles.empty}>
        <Ionicons name="warning-outline" size={44} color={colors.del} />
        <Text style={styles.emptyTitle}>No se han podido cargar las fotos</Text>
        <Text style={styles.emptyBody}>{error}</Text>
        <Pressable onPress={onRetry} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  if (!booted || loading || !exhausted) {
    return (
      <View style={styles.empty}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={styles.emptyBody}>Cargando fotos…</Text>
      </View>
    );
  }

  if (!reviewedAnything) {
    return (
      <View style={styles.empty}>
        <Ionicons name="images-outline" size={44} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>No hay fotos que revisar</Text>
        <Text style={styles.emptyBody}>No hemos encontrado imágenes en el carrete.</Text>
      </View>
    );
  }

  return (
    <View style={styles.empty}>
      <Ionicons name="checkmark-circle-outline" size={52} color={colors.keep} />
      <Text style={styles.emptyTitle}>¡Has revisado todas las fotos!</Text>
      {pendingCount > 0 ? (
        <>
          <Text style={styles.emptyBody}>
            Tienes {pendingCount} {pendingCount === 1 ? 'foto' : 'fotos'} en la papelera esperando a que
            confirmes el borrado.
          </Text>
          <Pressable onPress={onEmptyTrash} disabled={deleting} style={[styles.primaryButton, { backgroundColor: colors.del }]}>
            {deleting ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={[styles.primaryButtonText, { color: colors.text }]}>Borrar {pendingCount} del teléfono</Text>
            )}
          </Pressable>
        </>
      ) : (
        <Text style={styles.emptyBody}>Las fotos nuevas que hagas aparecerán aquí la próxima vez.</Text>
      )}
      <Pressable onPress={onReset} style={styles.linkButton}>
        <Text style={styles.linkButtonText}>Volver a revisar las guardadas</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  counters: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: colors.del,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
  },
  limitedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  limitedText: {
    color: colors.text,
    fontSize: 12,
    flex: 1,
  },
  stage: {
    flex: 1,
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  hint: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginVertical: spacing.md,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  emptyBody: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  primaryButton: {
    marginTop: spacing.md,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    paddingVertical: 13,
    borderRadius: radius.pill,
    minWidth: 200,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.bg,
    fontSize: 15,
    fontWeight: '700',
  },
  linkButton: {
    marginTop: spacing.sm,
    paddingVertical: 8,
  },
  linkButtonText: {
    color: colors.textMuted,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});
