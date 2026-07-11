import { useRef, useState } from 'react'
import {
  Animated,
  Dimensions,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

const { width } = Dimensions.get('window')
const STORAGE_KEY = '@sipat_onboarding_seen'

const slides = [
  {
    icon: '🎥',
    title: 'Record Your Ride',
    subtitle:
      'AI-powered pothole detection analyzes your ride footage automatically',
  },
  {
    icon: '👥',
    title: 'Community-Powered',
    subtitle:
      'Citizens verify, comment on, and report hazards together',
  },
  {
    icon: '🗺️',
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
            <Text style={styles.icon}>{slide.icon}</Text>
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
    backgroundColor: '#09090b',
  },
  skipBtn: {
    position: 'absolute',
    top: 60,
    right: 24,
    zIndex: 10,
  },
  skipText: {
    color: '#71717a',
    fontSize: 15,
    fontWeight: '500',
  },
  slidesContainer: {
    flex: 1,
  },
  slide: {
    width,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  icon: {
    fontSize: 80,
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: '#a1a1aa',
    textAlign: 'center',
    lineHeight: 22,
  },
  bottom: {
    paddingHorizontal: 24,
    paddingBottom: 60,
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 32,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3f3f46',
  },
  dotActive: {
    backgroundColor: '#06b6d4',
    width: 24,
  },
  nextBtn: {
    backgroundColor: '#06b6d4',
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 48,
    width: '100%',
    alignItems: 'center',
  },
  nextBtnText: {
    color: '#09090b',
    fontSize: 16,
    fontWeight: '700',
  },
})
