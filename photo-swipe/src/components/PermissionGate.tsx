import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  checkAccess,
  openSystemSettings,
  requestAccess,
  type LibraryAccess,
} from '../lib/photoLibrary';
import { colors, radius, spacing } from '../theme';

type Props = {
  children: (access: 'granted' | 'limited', refresh: () => void) => ReactNode;
};

export function PermissionGate({ children }: Props) {
  const insets = useSafeAreaInsets();
  const [access, setAccess] = useState<LibraryAccess>('checking');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    void checkAccess().then(setAccess);
  }, []);

  useEffect(() => {
    refresh();
    // Re-check when coming back from the system Settings app.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const request = useCallback(async () => {
    setBusy(true);
    try {
      setAccess(await requestAccess());
    } finally {
      setBusy(false);
    }
  }, []);

  if (access === 'granted' || access === 'limited') {
    return <>{children(access, refresh)}</>;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}>
      <View style={styles.iconWrap}>
        <Ionicons name="images-outline" size={44} color={colors.accent} />
      </View>
      <Text style={styles.title}>Limpia Fotos</Text>
      <Text style={styles.body}>
        Desliza cada foto a la izquierda para borrarla o a la derecha para guardarla. Para
        empezar necesitamos acceso a tu carrete.
      </Text>

      {access === 'checking' ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.lg }} />
      ) : access === 'blocked' ? (
        <>
          <Text style={styles.hint}>
            El acceso está desactivado. Actívalo en los ajustes del sistema y vuelve a la app.
          </Text>
          <Pressable style={styles.button} onPress={openSystemSettings}>
            <Text style={styles.buttonText}>Abrir ajustes</Text>
          </Pressable>
        </>
      ) : (
        <Pressable style={styles.button} onPress={request} disabled={busy}>
          {busy ? (
            <ActivityIndicator color={colors.bg} />
          ) : (
            <Text style={styles.buttonText}>Dar acceso a mis fotos</Text>
          )}
        </Pressable>
      )}

      <Text style={styles.footnote}>
        Nada sale de tu teléfono. Las fotos solo se borran cuando tú vacías la papelera y el
        sistema te pide confirmación.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  body: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  hint: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  button: {
    marginTop: spacing.lg,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderRadius: radius.pill,
    minWidth: 220,
    alignItems: 'center',
  },
  buttonText: {
    color: colors.bg,
    fontSize: 16,
    fontWeight: '700',
  },
  footnote: {
    position: 'absolute',
    bottom: spacing.xl,
    left: spacing.xl,
    right: spacing.xl,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});
