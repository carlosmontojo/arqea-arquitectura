import { Ionicons } from '@expo/vector-icons';
import { useCallback } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { pickMorePhotos, platformNotes } from '../lib/photoLibrary';
import { colors, radius, spacing } from '../theme';
import type { SortOrder } from '../types';

type Props = {
  visible: boolean;
  onClose: () => void;
  order: SortOrder;
  onChangeOrder: (order: SortOrder) => void;
  keptCount: number;
  pendingCount: number;
  deletedTotal: number;
  limitedAccess: boolean;
  onAccessChanged: () => void;
  onReset: () => void;
};

const ORDER_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: 'newest', label: 'Más recientes primero' },
  { value: 'oldest', label: 'Más antiguas primero' },
];

export function SettingsSheet({
  visible,
  onClose,
  order,
  onChangeOrder,
  keptCount,
  pendingCount,
  deletedTotal,
  limitedAccess,
  onAccessChanged,
  onReset,
}: Props) {
  const insets = useSafeAreaInsets();

  const confirmReset = useCallback(() => {
    Alert.alert(
      'Empezar de nuevo',
      'Las fotos que ya has guardado volverán a aparecer para revisarlas. La papelera se mantiene tal cual.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Reiniciar',
          style: 'destructive',
          onPress: () => {
            onReset();
            onClose();
          },
        },
      ],
    );
  }, [onClose, onReset]);

  const handlePickMore = useCallback(async () => {
    await pickMorePhotos();
    onAccessChanged();
  }, [onAccessChanged]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Ajustes</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Cerrar" style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
          <Text style={styles.sectionTitle}>Orden de revisión</Text>
          <View style={styles.segment}>
            {ORDER_OPTIONS.map((option) => {
              const selected = option.value === order;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => onChangeOrder(option.value)}
                  style={[styles.segmentItem, selected && styles.segmentItemSelected]}
                >
                  <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.sectionTitle}>Progreso</Text>
          <View style={styles.statsCard}>
            <Stat label="Guardadas" value={keptCount} color={colors.keep} />
            <Stat label="En papelera" value={pendingCount} color={colors.del} />
            <Stat label="Borradas" value={deletedTotal} color={colors.textMuted} />
          </View>
          <Text style={styles.help}>
            Las fotos guardadas no vuelven a salir aunque cierres la app. Si quieres revisarlas otra vez,
            reinicia el progreso.
          </Text>
          <Pressable onPress={confirmReset} style={({ pressed }) => [styles.outlineButton, pressed && { opacity: 0.7 }]}>
            <Ionicons name="refresh" size={18} color={colors.text} />
            <Text style={styles.outlineButtonText}>Reiniciar progreso</Text>
          </Pressable>

          {limitedAccess && (
            <>
              <Text style={styles.sectionTitle}>Acceso limitado</Text>
              <Text style={styles.help}>
                Solo has dado acceso a algunas fotos. Puedes añadir más sin salir de la app.
              </Text>
              <Pressable onPress={handlePickMore} style={({ pressed }) => [styles.outlineButton, pressed && { opacity: 0.7 }]}>
                <Ionicons name="images-outline" size={18} color={colors.text} />
                <Text style={styles.outlineButtonText}>Elegir más fotos</Text>
              </Pressable>
            </>
          )}

          <Text style={styles.sectionTitle}>Cómo funciona el borrado</Text>
          <Text style={styles.help}>
            Deslizar a la izquierda manda la foto a la papelera de la app, y ahí puedes recuperarla si te
            has equivocado. Al vaciar la papelera, el sistema pide una única confirmación para todo el
            lote y las fotos se borran del teléfono.
            {platformNotes.hasRecycleBin
              ? ' En iPhone además quedan 30 días en "Eliminadas recientemente" de la app Fotos.'
              : ''}
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: spacing.md,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    padding: 4,
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  segmentItemSelected: {
    backgroundColor: colors.accent,
  },
  segmentText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  segmentTextSelected: {
    color: colors.bg,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.sheet,
    paddingVertical: spacing.md,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 26,
    fontWeight: '700',
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  help: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.sm,
  },
  outlineButton: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    paddingVertical: 13,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  outlineButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
});
