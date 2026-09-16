import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { colors, radius } from '../theme';
import type { Photo, SwipeAction } from '../types';

export type SwipeCardHandle = {
  /** Plays the same fly-out animation a finger swipe would, then reports the action. */
  swipe: (action: SwipeAction) => void;
};

type Props = {
  photo: Photo;
  /** Only the top card reacts to gestures. */
  isTop: boolean;
  /** When set, the card animates in from that side (used after an undo). */
  enterFrom?: 'left' | 'right' | null;
  onSwiped: (photo: Photo, action: SwipeAction) => void;
};

const FLY_OUT_MS = 240;
const SPRING = { damping: 18, stiffness: 180, mass: 0.8 };
const VELOCITY_THRESHOLD = 900;

function formatDate(timestamp: number | null): string | null {
  if (!timestamp) return null;
  try {
    return new Date(timestamp).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return null;
  }
}

export const SwipeCard = forwardRef<SwipeCardHandle, Props>(function SwipeCard(
  { photo, isTop, enterFrom = null, onSwiped },
  ref,
) {
  const { width: screenWidth } = useWindowDimensions();
  const flyDistance = screenWidth * 1.4;
  const swipeThreshold = screenWidth * 0.28;

  const translateX = useSharedValue(
    enterFrom === 'left' ? -flyDistance : enterFrom === 'right' ? flyDistance : 0,
  );
  const translateY = useSharedValue(0);
  const scale = useSharedValue(isTop ? 1 : 0.94);
  const reportedRef = useRef(false);

  const finish = useCallback(
    (action: SwipeAction) => {
      if (reportedRef.current) return;
      reportedRef.current = true;
      void Haptics.impactAsync(
        action === 'delete' ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light,
      ).catch(() => undefined);
      onSwiped(photo, action);
    },
    [onSwiped, photo],
  );

  useEffect(() => {
    scale.value = withTiming(isTop ? 1 : 0.94, { duration: 200 });
  }, [isTop, scale]);

  useEffect(() => {
    if (enterFrom) translateX.value = withSpring(0, SPRING);
    // Only on mount: the entrance side never changes for a mounted card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      swipe(action) {
        const direction = action === 'keep' ? 1 : -1;
        translateX.value = withTiming(
          direction * flyDistance,
          { duration: FLY_OUT_MS + 60, easing: Easing.out(Easing.quad) },
          (done) => {
            'worklet';
            if (done) runOnJS(finish)(action);
          },
        );
      },
    }),
    [finish, flyDistance, translateX],
  );

  const pan = Gesture.Pan()
    .enabled(isTop)
    .activeOffsetX([-10, 10])
    .onUpdate((event) => {
      'worklet';
      translateX.value = event.translationX;
      translateY.value = event.translationY * 0.35;
    })
    .onEnd((event) => {
      'worklet';
      let direction: -1 | 0 | 1 = 0;
      if (Math.abs(event.velocityX) > VELOCITY_THRESHOLD) {
        direction = event.velocityX > 0 ? 1 : -1;
      } else if (Math.abs(translateX.value) > swipeThreshold) {
        direction = translateX.value > 0 ? 1 : -1;
      }

      if (direction === 0) {
        translateX.value = withSpring(0, SPRING);
        translateY.value = withSpring(0, SPRING);
        return;
      }

      const action: SwipeAction = direction === 1 ? 'keep' : 'delete';
      translateY.value = withTiming(translateY.value + event.velocityY * 0.08, {
        duration: FLY_OUT_MS,
      });
      translateX.value = withTiming(
        direction * flyDistance,
        { duration: FLY_OUT_MS, easing: Easing.out(Easing.quad) },
        (done) => {
          'worklet';
          if (done) runOnJS(finish)(action);
        },
      );
    });

  const cardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-screenWidth, 0, screenWidth],
      [-12, 0, 12],
      Extrapolation.CLAMP,
    );
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` },
        { scale: scale.value },
      ],
    };
  });

  const keepBadgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, swipeThreshold], [0, 1], Extrapolation.CLAMP),
  }));

  const deleteBadgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-swipeThreshold, 0], [1, 0], Extrapolation.CLAMP),
  }));

  const date = formatDate(photo.creationTime);

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.card, cardStyle]}>
        <Image
          source={{ uri: photo.id }}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          cachePolicy="memory"
          recyclingKey={photo.id}
          transition={isTop ? 0 : 120}
          accessibilityLabel={photo.filename ?? 'Foto'}
        />

        {(date || photo.filename) && (
          <View style={styles.caption} pointerEvents="none">
            {date ? <Text style={styles.captionDate}>{date}</Text> : null}
            {photo.filename ? (
              <Text style={styles.captionFile} numberOfLines={1}>
                {photo.filename}
              </Text>
            ) : null}
          </View>
        )}

        {isTop && (
          <>
            <Animated.View style={[styles.badge, styles.badgeKeep, keepBadgeStyle]} pointerEvents="none">
              <Text style={[styles.badgeText, { color: colors.keep }]}>GUARDAR</Text>
            </Animated.View>
            <Animated.View style={[styles.badge, styles.badgeDelete, deleteBadgeStyle]} pointerEvents="none">
              <Text style={[styles.badgeText, { color: colors.del }]}>BORRAR</Text>
            </Animated.View>
          </>
        )}
      </Animated.View>
    </GestureDetector>
  );
});

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  caption: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 28,
    paddingBottom: 14,
    backgroundColor: colors.overlay,
  },
  captionDate: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  captionFile: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  badge: {
    position: 'absolute',
    top: 28,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  badgeKeep: {
    left: 22,
    borderColor: colors.keep,
    transform: [{ rotate: '-14deg' }],
  },
  badgeDelete: {
    right: 22,
    borderColor: colors.del,
    transform: [{ rotate: '14deg' }],
  },
  badgeText: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 2,
  },
});
