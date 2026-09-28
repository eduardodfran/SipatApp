import { useRef, useState } from 'react'
import {
  Dimensions,
  Image,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { colors, fonts, radius, spacing } from '../theme/tokens'
import Brackets from '../components/Brackets'
import RecordRideSvg from '../assets/onboarding/record-ride.svg'
import CommunitySvg from '../assets/onboarding/community.svg'
import RealtimeMapSvg from '../assets/onboarding/realtime-map.svg'

const { width } = Dimensions.get('window')
const STORAGE_KEY = '@sipat_onboarding_seen'

const slides = [
  {
    Illustration: RecordRideSvg,
    title: 'Record Your Ride',
    subtitle:
      'AI-powered pothole detection analyzes your ride footage automatically',
  },
  {
    Illustration: CommunitySvg,
    title: 'Community-Powered',
    subtitle:
      'Citizens verify, comment on, and report hazards together',
  },
  {
    Illustration: RealtimeMapSvg,
    title: 'See Real-Time Hazards',
    subtitle:
      'View live road hazard maps and help make roads safer',
  },
]

type Props = { onDone: () => void }

export default function OnboardingScreen({ onDone }: Props) {
  const [index, setIndex] = useState(0)
  const scrollRef = useRef<ScrollView>(null)

  const finish = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, 'true')
    } catch {}
    onDone()
  }

  const next = () => {
    if (index < slides.length - 1) {
      scrollRef.current?.scrollTo({ x: (index + 1) * width, animated: true })
    }
  }

  const onScroll = (e: NativeSyntheticEvent<{ contentOffset: { x: number } }>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width)
    setIndex(i)
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.skipBtn} onPress={finish}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onMomentumScrollEnd={onScroll}
        style={styles.slidesContainer}
      >
        {slides.map((slide, i) => (
          <View key={i} style={styles.slide}>
            {i === 0 && (
              <View style={styles.slideLogoFrame}>
                <Brackets size={14} />
                <Image
                  source={require('../assets/sipat-logo-main.png')}
                  style={styles.slideLogo}
                  resizeMode="contain"
                />
              </View>
            )}
            <View style={styles.illustrationWrap}>
              <slide.Illustration width={240} height={240} />
            </View>
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.subtitle}>{slide.subtitle}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.bottom}>
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === index && styles.dotActive]}
            />
          ))}
        </View>

        <TouchableOpacity
          style={styles.nextBtn}
          onPress={index === slides.length - 1 ? finish : next}
        >
          <Text style={styles.nextBtnText}>
            {index === slides.length - 1 ? 'Get Started' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  skipBtn: {
    position: 'absolute',
    top: 60,
    right: spacing.xl,
    zIndex: 10,
  },
  skipText: {
    color: colors.textMuted,
    fontFamily: fonts.semibold,
    fontSize: 13,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  slidesContainer: {
    flex: 1,
  },
  slide: {
    width,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  illustrationWrap: {
    marginBottom: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slideLogoFrame: {
    width: 120,
    height: 120,
    marginBottom: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slideLogo: {
    width: 120,
    height: 120,
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 26,
    letterSpacing: -0.3,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  bottom: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 60,
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xxl,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.hairlineStrong,
  },
  dotActive: {
    backgroundColor: colors.signal,
    width: 24,
  },
  nextBtn: {
    backgroundColor: colors.signal,
    borderRadius: radius.md,
    height: 48,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtnText: {
    color: colors.onSignal,
    fontFamily: fonts.semibold,
    fontSize: 16,
  },
})
