import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native'
import * as Linking from 'expo-linking'
import { supabase } from '../lib/supabase'
import { colors, fonts, radius, spacing } from '../theme/tokens'
import Brackets from '../components/Brackets'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [showPassword, setShowPassword] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const lastAuthRef = useRef(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const handleResend = async () => {
    if (cooldown > 0) {
      Alert.alert('Please wait', `Wait ${cooldown}s before resending. Check inbox/spam.`)
      return
    }
    try {
      const redirectTo = Linking.createURL('auth/confirm')
      const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: redirectTo } })
      if (error) {
        if (error.message.toLowerCase().includes('rate limit')) {
          setCooldown(60)
          Alert.alert('Still rate limited', 'Project limit 30/hour shared by all testers. Wait 60s, check inbox/spam, or try a different email. Admin: add custom SMTP in Supabase Dashboard → Auth → Email.')
        } else {
          Alert.alert('Resend failed', error.message)
        }
      } else {
        Alert.alert('Email resent', `We resent the verification link to ${email.trim()}. Tap the link on this phone to auto-login. Check inbox and spam.`)
      }
    } catch (err: any) {
      Alert.alert('Resend failed', err?.message ?? 'Something went wrong')
    }
  }

  const handleAuth = async () => {
    const now = Date.now()
    if (now - lastAuthRef.current < 2000) return
    lastAuthRef.current = now
    if (cooldown > 0) {
      Alert.alert('Please wait', `Wait ${cooldown}s before trying again. Check inbox/spam or use Resend.`)
      return
    }

    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter email and password')
      return
    }

    if (mode === 'signup' && !username.trim()) {
      Alert.alert('Error', 'Please enter a username')
      return
    }

    setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) Alert.alert('Error', error.message)
      } else {
        const redirectTo = Linking.createURL('auth/confirm')
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: redirectTo, data: { username: username.trim() } } })
        if (error) {
          if (error.message.toLowerCase().includes('rate limit')) {
            setCooldown(60)
            Alert.alert('Too many attempts', 'Email rate limit exceeded. This can happen if this email or your network was used recently (project limit 30/hour, per-email 2-4/hour). Please check your email for a previous verification link, or tap Resend in a minute.', [
              { text: 'OK', style: 'cancel' },
              { text: 'Resend email', onPress: handleResend },
            ])
          } else {
            Alert.alert('Error', error.message)
          }
          return
        }
        if (data.user?.identities?.length === 0) {
          Alert.alert('Account exists', 'An account with this email already exists. Please sign in.')
          setMode('login')
          return
        }
        if (data.user) {
          const { error: profileError } = await supabase.from('profiles').insert({
            id: data.user.id,
            username: username.trim(),
          })
          if (profileError) console.warn('[LoginScreen] profile insert deferred (will be created after email confirmation):', profileError.message)
        }
        if (!data.session) {
          Alert.alert('Check your email', `We sent a verification link to ${email.trim()}. Tap the link on this phone and you'll be logged in automatically.`, [
            { text: 'OK', onPress: () => setMode('login') },
            { text: 'Resend', onPress: handleResend },
          ])
          return
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior="padding"
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.brandMark}>
              <Brackets size={16} />
              <Image
                source={require('../assets/sipat-logo-main.png')}
                style={styles.brandLogo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.wordmark}>SIPAT</Text>

            <Text style={styles.subtitle}>
              {mode === 'login' ? 'Road safety starts here' : 'Join the community'}
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              textContentType="emailAddress"
            />

            {mode === 'signup' && (
              <TextInput
                style={styles.input}
                placeholder="Username"
                placeholderTextColor={colors.textMuted}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                textContentType="username"
              />
            )}

            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Password"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                textContentType={mode === 'login' ? 'password' : 'newPassword'}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
                activeOpacity={0.7}
              >
                {showPassword ? (
                  <EyeClosedIcon />
                ) : (
                  <EyeIcon />
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, (loading || cooldown > 0) && styles.primaryBtnDisabled]}
              onPress={handleAuth}
              disabled={loading || cooldown > 0}
            >
              {loading ? (
                <ActivityIndicator color={colors.onSignal} />
              ) : cooldown > 0 ? (
                <Text style={styles.primaryBtnText}>Wait {cooldown}s</Text>
              ) : (
                <Text style={styles.primaryBtnText}>
                  {mode === 'login' ? 'Sign In' : 'Sign Up'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchBtn}
              onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}
            >
              <Text style={styles.switchText}>
                {mode === 'login'
                  ? "Don't have an account? Sign Up"
                  : 'Already have an account? Sign In'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function EyeIcon() {
  return (
    <View style={styles.eyeIcon}>
      <View style={styles.eyeOuter} />
      <View style={styles.eyeIris} />
      <View style={styles.eyePupil} />
    </View>
  )
}

function EyeClosedIcon() {
  return (
    <View style={styles.eyeIcon}>
      <View style={[styles.eyeOuter, styles.eyeClosed]} />
      <View style={styles.eyeSlash} />
    </View>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xl,
  },
  brandMark: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  brandLogo: {
    width: 64,
    height: 64,
  },
  wordmark: {
    fontFamily: fonts.extrabold,
    fontSize: 26,
    letterSpacing: 2,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
  input: {
    width: '100%',
    height: 48,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    fontSize: 15,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  passwordContainer: {
    width: '100%',
    marginBottom: spacing.md,
    position: 'relative',
  },
  passwordInput: {
    width: '100%',
    height: 48,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingRight: 50,
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  eyeButton: {
    position: 'absolute',
    right: spacing.md,
    top: '50%',
    transform: [{ translateY: -12 }],
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
  eyeIcon: {
    width: 20,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyeOuter: {
    width: 20,
    height: 14,
    borderWidth: 2,
    borderColor: colors.textMuted,
    borderRadius: 10,
  },
  eyeIris: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.textMuted,
  },
  eyePupil: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textPrimary,
  },
  eyeClosed: {
    borderColor: colors.severe,
  },
  eyeSlash: {
    position: 'absolute',
    width: 24,
    height: 2,
    backgroundColor: colors.severe,
    transform: [{ rotate: '45deg' }],
  },
  primaryBtn: {
    width: '100%',
    height: 48,
    backgroundColor: colors.signal,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    color: colors.onSignal,
    fontFamily: fonts.semibold,
    fontSize: 16,
  },
  switchBtn: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  switchText: {
    color: colors.signal,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
})
