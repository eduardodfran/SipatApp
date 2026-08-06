import { useState, useEffect } from 'react'
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'

const COOLDOWN_DAYS = 7
const COOLDOWN_MS = COOLDOWN_DAYS * 24 * 60 * 60 * 1000

type Props = {
  user: any
  onBack: () => void
  onAbout: () => void
}

function getCooldownRemaining(editedAt: string | null): { locked: boolean; remaining: string } {
  if (!editedAt) return { locked: false, remaining: '' }
  const elapsed = Date.now() - new Date(editedAt).getTime()
  if (elapsed >= COOLDOWN_MS) return { locked: false, remaining: '' }
  const left = COOLDOWN_MS - elapsed
  const days = Math.floor(left / (24 * 60 * 60 * 1000))
  const hours = Math.floor((left % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
  return { locked: true, remaining: `${days}d ${hours}h remaining` }
}

export default function ProfileScreen({ user, onBack, onAbout }: Props) {
  const [username, setUsername] = useState(user?.user_metadata?.username ?? '')
  const [email] = useState(user?.email ?? '')
  const [saving, setSaving] = useState(false)
  const [initialUsername, setInitialUsername] = useState(user?.user_metadata?.username ?? '')
  const [cooldown, setCooldown] = useState(() =>
    getCooldownRemaining(user?.user_metadata?.username_edited_at ?? null),
  )
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  useEffect(() => {
    setUsername(user?.user_metadata?.username ?? '')
    setInitialUsername(user?.user_metadata?.username ?? '')
    setCooldown(getCooldownRemaining(user?.user_metadata?.username_edited_at ?? null))
  }, [user])

  useEffect(() => {
    const interval = setInterval(() => {
      setCooldown(getCooldownRemaining(user?.user_metadata?.username_edited_at ?? null))
    }, 60000)
    return () => clearInterval(interval)
  }, [user])

  const hasChanges = username.trim() !== initialUsername.trim()

  const handleSave = async () => {
    if (!username.trim()) {
      Alert.alert('Error', 'Username cannot be empty')
      return
    }

    if (cooldown.locked) {
      Alert.alert('Cooldown', `You can edit your username again in ${cooldown.remaining}`)
      return
    }

    setSaving(true)
    try {
      const now = new Date().toISOString()
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          username: username.trim(),
          username_edited_at: now,
        },
      })
      if (authError) {
        Alert.alert('Error', authError.message)
        return
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({ id: user.id, username: username.trim() }, { onConflict: 'id' })

      if (profileError) {
        console.warn('Profile update failed (non-fatal):', profileError.message)
      }

      setInitialUsername(username.trim())
      setCooldown(getCooldownRemaining(now))
      Alert.alert('Saved', 'Username updated successfully')
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to update username')
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const handleChangePassword = async () => {
    if (!currentPassword) {
      Alert.alert('Error', 'Please enter your current password')
      return
    }
    if (!newPassword) {
      Alert.alert('Error', 'Please enter a new password')
      return
    }
    if (newPassword.length < 6) {
      Alert.alert('Error', 'New password must be at least 6 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match')
      return
    }

    setChangingPassword(true)
    try {
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      })
      if (verifyError) {
        Alert.alert('Error', 'Current password is incorrect')
        return
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) {
        Alert.alert('Error', error.message)
        return
      }

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      Alert.alert('Success', 'Password updated successfully')
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to update password')
    } finally {
      setChangingPassword(false)
    }
  }

  const displayName = username || email.split('@')[0]
  const initial = displayName.charAt(0).toUpperCase()

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color="#fafafa" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.avatarSection}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>
          <Text style={styles.displayName}>{displayName}</Text>
          <Text style={styles.email}>{email}</Text>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            style={[styles.input, cooldown.locked && styles.inputDisabled]}
            value={username}
            onChangeText={setUsername}
            placeholder="Enter username"
            placeholderTextColor="#71717a"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!cooldown.locked}
          />
          {cooldown.locked && (
            <View style={styles.cooldownRow}>
              <Ionicons name="time-outline" size={14} color="#f59e0b" />
              <Text style={styles.cooldownText}>{cooldown.remaining}</Text>
            </View>
          )}

          <Text style={styles.label}>Email</Text>
          <View style={styles.readOnlyField}>
            <Text style={styles.readOnlyText}>{email}</Text>
            <Ionicons name="lock-closed" size={14} color="#71717a" />
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, (!hasChanges || saving || cooldown.locked) && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!hasChanges || saving || cooldown.locked}
          >
            {saving ? (
              <ActivityIndicator color="#0c0c14" />
            ) : (
              <Text style={styles.saveBtnText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.changePasswordSection}>
          <Text style={styles.sectionLabel}>CHANGE PASSWORD</Text>

          <Text style={styles.label}>Current Password</Text>
          <TextInput
            style={styles.passwordInput}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Enter current password"
            placeholderTextColor="#71717a"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>New Password</Text>
          <TextInput
            style={styles.passwordInput}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Enter new password"
            placeholderTextColor="#71717a"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Confirm New Password</Text>
          <TextInput
            style={styles.passwordInput}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm new password"
            placeholderTextColor="#71717a"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TouchableOpacity
            style={[styles.changePasswordBtn, changingPassword && styles.changePasswordBtnDisabled]}
            onPress={handleChangePassword}
            disabled={changingPassword}
          >
            {changingPassword ? (
              <ActivityIndicator color="#0c0c14" />
            ) : (
              <Text style={styles.changePasswordBtnText}>Update Password</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.dangerSection}>
          <TouchableOpacity style={styles.aboutBtn} onPress={onAbout} activeOpacity={0.7}>
            <Ionicons name="information-circle-outline" size={18} color="#06b6d4" />
            <Text style={styles.aboutText}>About SIPAT</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={18} color="#ef4444" />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c14' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  headerTitle: { color: '#fafafa', fontSize: 16, fontWeight: '700' },
  scroll: { flex: 1 },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(6, 182, 212, 0.25)',
    marginBottom: 12,
  },
  avatarInitial: {
    color: '#06b6d4',
    fontSize: 32,
    fontWeight: '800',
  },
  displayName: {
    color: '#fafafa',
    fontSize: 20,
    fontWeight: '700',
  },
  email: {
    color: '#71717a',
    fontSize: 13,
    marginTop: 4,
  },
  formSection: {
    paddingHorizontal: 20,
  },
  label: {
    color: '#a1a1aa',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    color: '#fafafa',
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  inputDisabled: {
    opacity: 0.4,
  },
  cooldownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  cooldownText: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '600',
  },
  readOnlyField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  readOnlyText: {
    color: '#71717a',
    fontSize: 15,
  },
  saveBtn: {
    backgroundColor: '#06b6d4',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    color: '#0c0c14',
    fontSize: 16,
    fontWeight: '700',
  },
  changePasswordSection: {
    paddingHorizontal: 20,
    marginTop: 32,
  },
  sectionLabel: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  passwordInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    color: '#fafafa',
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  changePasswordBtn: {
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  changePasswordBtnDisabled: {
    opacity: 0.4,
  },
  changePasswordBtnText: {
    color: '#0c0c14',
    fontSize: 16,
    fontWeight: '700',
  },
  dangerSection: {
    paddingHorizontal: 20,
    marginTop: 32,
    gap: 10,
  },
  aboutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.15)',
  },
  aboutText: {
    color: '#06b6d4',
    fontSize: 15,
    fontWeight: '600',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.15)',
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '600',
  },
})
