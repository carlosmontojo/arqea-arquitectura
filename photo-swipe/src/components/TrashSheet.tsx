import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { DeleteResult } from '../hooks/useReviewSession';
import { platformNotes } from '../lib/photoLibrary';
import { colors, radius, spacing } from '../theme';
import type { Photo } from '../types';

type Props = {
  visible: boolean;
  photos: Photo[];
  deleting: boolean;
  onClose: () => void;
  onRestore: (photos: Photo[]) => void;
  onEmpty: () => Promise<DeleteResult>;
};

const COLUMNS = 3;
const GAP = 6;

export function TrashSheet({ visible, photos, deleting, onClose, onRestore, onEmpty }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const tileSize = (width - spacing.md * 2 - GAP * (COLUMNS - 1)) / COLUMNS;

  const handleEmpty = useCallback(async () => {
    const result = await onEmpty();
    if (result.error) {
      Alert.alert('No se ha borrado nada', result.error);
      return;
    }
    if (result.deleted > 0) {
      Alert.alert(
        'Listo',
        `Se han borrado ${result.deleted} ${result.deleted === 1 ? 'foto' : 'fotos'}.` +
          (platformNotes.hasRecycleBin
            ? ' Durante 30 días seguirán en "Eliminadas recientemente" de la app Fotos.'
            : ''),
      );
      onClose();
    }
  }, [onClose, onEmpty]);

  const handleRestoreAll = useCallback(() => {
    if (photos.length === 0) return;
    Alert.alert(
      'Recuperar todas',
      `¿Sacar las ${photos.length} fotos de la papelera y marcarlas como guardadas?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Recuperar', onPress: () => onRestore(photos) },
      ],
    );
  }, [onRestore, photos]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View style={[styles.container, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Papelera</Text>
            <Text style={styles.subtitle}>
              {photos.length === 0
                ? 'Nada pendiente de borrar'
                : `${photos.length} ${photos.length === 1 ? 'foto' : 'fotos'} · toca una para recuperarla`}
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Cerrar" style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>

        {photos.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="trash-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>La papelera está vacía.</Text>
          </View>
        ) : (
          <FlatList
            data={photos}
            keyExtractor={(photo) => photo.id}
            numColumns={COLUMNS}
            columnWrapperStyle={{ gap: GAP }}
            contentContainerStyle={styles.grid}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => onRestore([item])}
                disabled={deleting}
                accessibilityLabel="Recuperar esta foto"
                style={({ pressed }) => [
                  styles.tile,
                  { width: tileSize, height: tileSize },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Image
                  source={{ uri: item.id }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  cachePolicy="memory"
                  recyclingKey={item.id}
                />
                <View style={styles.tileBadge}>
                  <Ionicons name="arrow-undo" size={14} color={colors.text} />
                </View>
              </Pressable>
            )}
          />
        )}

        {photos.length > 0 && (
          <View style={styles.footer}>
            <Pressable
              onPress={handleRestoreAll}
              disabled={deleting}
              style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.secondaryText}>Recuperar todas</Text>
            </Pressable>
            <Pressable
              onPress={handleEmpty}
              disabled={deleting}
              style={({ pressed }) => [styles.danger, pressed && { opacity: 0.85 }]}
            >
              {deleting ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <>
                  <Ionicons name="trash" size={18} color={colors.text} />
                  <Text style={styles.dangerText}>
                    Borrar {photos.length} {photos.length === 1 ? 'foto' : 'fotos'}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    paddingHorizontal: spacing.md,
    gap: GAP,
    paddingBottom: spacing.md,
  },
  tile: {
    borderRadius: radius.tile,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  tileBadge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 16,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  secondary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  danger: {
    flex: 1.4,
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.del,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
});
