// components/splash/AnimatedSplash.tsx
import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Stop,
  type CircleProps,
} from 'react-native-svg';

const { width } = Dimensions.get('window');
const LOGO_SIZE = Math.min(width * 0.35, 160);

// ---- Brand colors ----
const BG = '#0B0B0F';
const RING = '#8B7BF0';
const RING_2 = '#5EEAD4';
const RING_3 = '#F472B6';
const TEXT = '#FFFFFF';
const SUBTEXT = '#9A9AAE';

// ---- Timing ----
const HOLD_MS = 1500;
const FADE_OUT_MS = 500;

// Radius & circumference for the drawn circle
const RADIUS = LOGO_SIZE * 0.75;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const STAGE = LOGO_SIZE * 2;

// Properly typed animated SVG circle
const AnimatedCircle = Animated.createAnimatedComponent(
  Circle
) as React.ComponentType<CircleProps & { animatedProps?: Partial<CircleProps> }>;

export default function AnimatedSplash({
  isReady,
  onFinish,
}: {
  isReady: boolean;
  onFinish: () => void;
}) {
  const [nativeHidden, setNativeHidden] = useState(false);

  // Root
  const rootOpacity = useSharedValue(1);

  // Stage 1: SVG stroke drawing
  const strokeProgress = useSharedValue(0);
  const svgRotate = useSharedValue(0);
  const svgScale = useSharedValue(0.6);

  // Stage 2: orbiting dots
  const orbitAngle = useSharedValue(0);
  const orbitOpacity = useSharedValue(0);

  // Stage 3: burst flash
  const burstScale = useSharedValue(0);
  const burstOpacity = useSharedValue(0);

  // Logo
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.2);
  const logoRotate = useSharedValue(-180);

  // Shockwave rings
  const wave1 = useSharedValue(0);
  const wave2 = useSharedValue(0);
  const wave3 = useSharedValue(0);

  // Text
  const titleOpacity = useSharedValue(0);
  const titleY = useSharedValue(24);
  const titleLetterSpacing = useSharedValue(12);
  const subtitleOpacity = useSharedValue(0);
  const subtitleY = useSharedValue(16);
  const underlineWidth = useSharedValue(0);

  // Ambient
  const glowScale = useSharedValue(0.8);

  // Progress bar
  const progressBar = useSharedValue(0);

  // ---- Cinematic timeline ----
  useEffect(() => {
    let mounted = true;
    SplashScreen.hideAsync()
      .then(() => mounted && setNativeHidden(true))
      .catch(() => mounted && setNativeHidden(true));

    // === STAGE 1 (0–700ms): SVG circle draws itself ===
    strokeProgress.value = withTiming(1, {
      duration: 700,
      easing: Easing.inOut(Easing.cubic),
    });
    svgScale.value = withSpring(1, { damping: 14, stiffness: 120 });

    // Circle keeps slowly spinning
    svgRotate.value = withRepeat(
      withTiming(360, { duration: 6000, easing: Easing.linear }),
      -1,
      false
    );

    // === STAGE 2 (500–1100ms): orbiting dots appear ===
    orbitOpacity.value = withDelay(500, withTiming(1, { duration: 300 }));
    orbitAngle.value = withRepeat(
      withTiming(360, { duration: 2400, easing: Easing.linear }),
      -1,
      false
    );

    // === STAGE 3 (900–1300ms): burst flash ===
    burstScale.value = withDelay(
      900,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) })
    );
    burstOpacity.value = withDelay(
      900,
      withSequence(
        withTiming(1, { duration: 200 }),
        withDelay(200, withTiming(0, { duration: 300 }))
      )
    );

    // === STAGE 4 (1050ms): logo pops in ===
    logoOpacity.value = withDelay(1050, withTiming(1, { duration: 250 }));
    logoRotate.value = withDelay(
      1050,
      withSpring(0, { damping: 11, stiffness: 90, mass: 0.9 })
    );
    logoScale.value = withDelay(
      1050,
      withSpring(1, { damping: 10, stiffness: 140 })
    );

    // === STAGE 5: shockwave rings ===
    wave1.value = withDelay(
      1100,
      withTiming(1, { duration: 1000, easing: Easing.out(Easing.cubic) })
    );
    wave2.value = withDelay(
      1250,
      withTiming(1, { duration: 1000, easing: Easing.out(Easing.cubic) })
    );
    wave3.value = withDelay(
      1400,
      withTiming(1, { duration: 1000, easing: Easing.out(Easing.cubic) })
    );

    // === STAGE 6 (1300ms): title slams in ===
    titleOpacity.value = withDelay(1300, withTiming(1, { duration: 400 }));
    titleY.value = withDelay(
      1300,
      withSpring(0, { damping: 13, stiffness: 130 })
    );
    titleLetterSpacing.value = withDelay(
      1300,
      withTiming(0.5, { duration: 800, easing: Easing.out(Easing.cubic) })
    );

    underlineWidth.value = withDelay(
      1600,
      withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) })
    );

    // === STAGE 7 (1650ms): subtitle ===
    subtitleOpacity.value = withDelay(1650, withTiming(1, { duration: 400 }));
    subtitleY.value = withDelay(
      1650,
      withSpring(0, { damping: 13, stiffness: 130 })
    );

    // === Ambient glow breathing ===
    glowScale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.85, { duration: 1800, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    // Progress bar fill
    progressBar.value = withDelay(
      300,
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.cubic) })
    );

    return () => {
      mounted = false;
    };
  }, []);

  // Fade out when app is ready
  useEffect(() => {
    if (!isReady) return;
    const t = setTimeout(() => {
      rootOpacity.value = withTiming(
        0,
        { duration: FADE_OUT_MS, easing: Easing.in(Easing.quad) },
        (finished) => finished && runOnJS(onFinish)()
      );
    }, HOLD_MS);
    return () => clearTimeout(t);
  }, [isReady, onFinish, rootOpacity]);

  // ---- Animated styles ----
  const rootStyle = useAnimatedStyle(() => ({ opacity: rootOpacity.value }));

  const svgWrapStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: svgScale.value },
      { rotate: `${svgRotate.value}deg` },
    ],
  }));

  // Animated props for SVG circle drawing
  const circleProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - strokeProgress.value),
  }));

  const orbitStyle = useAnimatedStyle(() => ({
    opacity: orbitOpacity.value,
    transform: [{ rotate: `${orbitAngle.value}deg` }],
  }));

  const burstStyle = useAnimatedStyle(() => ({
    opacity: burstOpacity.value,
    transform: [
      { scale: interpolate(burstScale.value, [0, 1], [0.3, 2.2]) },
    ],
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [
      { scale: logoScale.value },
      { rotate: `${logoRotate.value}deg` },
    ],
  }));

  const wave1Style = useAnimatedStyle(() => ({
    opacity: interpolate(
      wave1.value,
      [0, 0.15, 1],
      [0, 0.8, 0],
      Extrapolation.CLAMP
    ),
    transform: [
      {
        scale: interpolate(
          wave1.value,
          [0, 1],
          [0.6, 2.4],
          Extrapolation.CLAMP
        ),
      },
    ],
  }));

  const wave2Style = useAnimatedStyle(() => ({
    opacity: interpolate(
      wave2.value,
      [0, 0.15, 1],
      [0, 0.8, 0],
      Extrapolation.CLAMP
    ),
    transform: [
      {
        scale: interpolate(
          wave2.value,
          [0, 1],
          [0.6, 2.4],
          Extrapolation.CLAMP
        ),
      },
    ],
  }));

  const wave3Style = useAnimatedStyle(() => ({
    opacity: interpolate(
      wave3.value,
      [0, 0.15, 1],
      [0, 0.8, 0],
      Extrapolation.CLAMP
    ),
    transform: [
      {
        scale: interpolate(
          wave3.value,
          [0, 1],
          [0.6, 2.4],
          Extrapolation.CLAMP
        ),
      },
    ],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleY.value }],
    letterSpacing: titleLetterSpacing.value,
  }));

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
    transform: [{ translateY: subtitleY.value }],
  }));

  const underlineStyle = useAnimatedStyle(() => ({
    width: interpolate(underlineWidth.value, [0, 1], [0, 120]),
    opacity: underlineWidth.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glowScale.value }],
  }));

  const progressStyle = useAnimatedStyle(() => ({
    width: interpolate(progressBar.value, [0, 1], [0, width * 0.45]),
  }));

  if (!nativeHidden) return null;

  return (
    <Animated.View style={[styles.root, rootStyle]} pointerEvents="auto">
      {/* Ambient glow behind everything */}
      <Animated.View style={[styles.ambientGlow, glowStyle]} />

      <View style={styles.center}>
        {/* === SVG LAYER: animated circle + orbit + burst === */}
        <View style={styles.stage}>
          <Animated.View style={[styles.stageLayer, svgWrapStyle]}>
            <Svg width={STAGE} height={STAGE}>
              <Defs>
                <LinearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor={RING_2} stopOpacity="1" />
                  <Stop offset="0.5" stopColor={RING} stopOpacity="1" />
                  <Stop offset="1" stopColor={RING_3} stopOpacity="1" />
                </LinearGradient>
              </Defs>

              {/* Faint background track */}
              <Circle
                cx={LOGO_SIZE}
                cy={LOGO_SIZE}
                r={RADIUS}
                stroke="rgba(139,123,240,0.15)"
                strokeWidth={3}
                fill="none"
              />

              {/* Gradient circle that draws itself */}
              <AnimatedCircle
                cx={LOGO_SIZE}
                cy={LOGO_SIZE}
                r={RADIUS}
                stroke="url(#grad)"
                strokeWidth={3.5}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                animatedProps={circleProps}
              />
            </Svg>
          </Animated.View>

          {/* Orbiting dots */}
          <Animated.View
            style={[styles.orbitLayer, orbitStyle]}
            pointerEvents="none"
          >
            <View
              style={[
                styles.orbitDot,
                { backgroundColor: RING_2, top: 0, left: '50%', marginLeft: -4 },
              ]}
            />
            <View
              style={[
                styles.orbitDot,
                {
                  backgroundColor: RING,
                  bottom: 0,
                  left: '50%',
                  marginLeft: -4,
                },
              ]}
            />
            <View
              style={[
                styles.orbitDot,
                {
                  backgroundColor: RING_3,
                  left: 0,
                  top: '50%',
                  marginTop: -4,
                },
              ]}
            />
            <View
              style={[
                styles.orbitDot,
                {
                  backgroundColor: RING,
                  right: 0,
                  top: '50%',
                  marginTop: -4,
                },
              ]}
            />
          </Animated.View>

          {/* Burst flash */}
          <Animated.View
            style={[styles.burst, burstStyle]}
            pointerEvents="none"
          />

          {/* Shockwave rings */}
          <Animated.View
            style={[styles.wave, wave1Style]}
            pointerEvents="none"
          />
          <Animated.View
            style={[styles.wave, wave2Style]}
            pointerEvents="none"
          />
          <Animated.View
            style={[styles.wave, wave3Style]}
            pointerEvents="none"
          />

          {/* Logo */}
          <Animated.View style={[styles.logoWrap, logoStyle]}>
            <Image
              source={require('@/assets/app-icons/appstore.png')}
              style={styles.logo}
              contentFit="contain"
            />
          </Animated.View>
        </View>

        {/* Title */}
        <Animated.Text style={[styles.title, titleStyle]}>
          Expense Tracker
        </Animated.Text>

        {/* Underline accent */}
        <Animated.View style={[styles.underline, underlineStyle]} />

        {/* Subtitle */}
        <Animated.Text style={[styles.subtitle, subtitleStyle]}>
          Secure · Simple · Yours
        </Animated.Text>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, progressStyle]} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: BG,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    overflow: 'hidden',
  },
  ambientGlow: {
    position: 'absolute',
    width: width * 1.2,
    height: width * 1.2,
    borderRadius: (width * 1.2) / 2,
    backgroundColor: RING,
    opacity: 0.08,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  stage: {
    width: STAGE,
    height: STAGE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stageLayer: {
    position: 'absolute',
    width: STAGE,
    height: STAGE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orbitLayer: {
    position: 'absolute',
    width: LOGO_SIZE * 1.5,
    height: LOGO_SIZE * 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orbitDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    shadowColor: RING,
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  burst: {
    position: 'absolute',
    width: LOGO_SIZE * 1.5,
    height: LOGO_SIZE * 1.5,
    borderRadius: (LOGO_SIZE * 1.5) / 2,
    backgroundColor: RING,
    shadowColor: RING,
    shadowOpacity: 1,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 0 },
    elevation: 20,
  },
  wave: {
    position: 'absolute',
    width: LOGO_SIZE * 1.5,
    height: LOGO_SIZE * 1.5,
    borderRadius: (LOGO_SIZE * 1.5) / 2,
    borderWidth: 2,
    borderColor: RING,
    shadowColor: RING,
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  logoWrap: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: RING,
    shadowOpacity: 0.9,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 0 },
    elevation: 14,
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
  title: {
    color: TEXT,
    fontSize: 28,
    fontWeight: '800',
    marginTop: 28,
    textShadowColor: 'rgba(139,123,240,0.7)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  underline: {
    height: 2,
    marginTop: 10,
    borderRadius: 2,
    backgroundColor: RING,
    shadowColor: RING,
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  subtitle: {
    color: SUBTEXT,
    fontSize: 12,
    marginTop: 14,
    letterSpacing: 3,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  progressTrack: {
    width: width * 0.45,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(139,123,240,0.15)',
    marginTop: 40,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: RING,
    shadowColor: RING,
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
});