import { useState, useEffect } from 'react'
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { colors, fonts, radius, spacing } from '../theme/tokens'
import ScreenHeader from '../components/ScreenHeader'
import Brackets from '../components/Brackets'
import LaneDivider from '../components/LaneDivider'

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
  const [deleteModalVisible, setDeleteModalVisible] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [deleting, setDeleting] = useState(false)

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

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => setDeleteModalVisible(true),
        },
      ],
    )
  }

  const confirmDeleteAccount = async () => {
    if (deleteInput !== 'DELETE') {
      Alert.alert('Error', 'You must type DELETE to confirm')
      return
    }

    setDeleting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        Alert.alert('Error', 'Not authenticated')
        return
      }

      const res = await fetch('https://sipat-web.vercel.app/api/account/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ email }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to delete account')
      }

      setDeleteModalVisible(false)
      setDeleteInput('')
      await supabase.auth.signOut()
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to delete account')
    } finally {
      setDeleting(false)
    }
  }

  const displayName = username || email.split('@')[0]
  const initial = displayName.charAt(0).toUpperCase()

  return (
    <View style={styles.container}>
      <ScreenHeader onBack={onBack} title="Profile" />

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.avatarSection}>
          <View style={styles.avatarFrame}>
            <Brackets size={16} />
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>{initial}</Text>
            </View>
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
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!cooldown.locked}
          />
          {cooldown.locked && (
            <View style={styles.cooldownRow}>
              <Ionicons name="time-outline" size={14} color={colors.moderate} />
              <Text style={styles.cooldownText}>{cooldown.remaining}</Text>
            </View>
          )}

          <Text style={styles.label}>Email</Text>
          <View style={styles.readOnlyField}>
            <Text style={styles.readOnlyText}>{email}</Text>
            <Ionicons name="lock-closed" size={14} color={colors.textMuted} />
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, (!hasChanges || saving || cooldown.locked) && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!hasChanges || saving || cooldown.locked}
          >
            {saving ? (
              <ActivityIndicator color={colors.onSignal} />
            ) : (
              <Text style={styles.saveBtnText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>

        <LaneDivider />

        <View style={styles.changePasswordSection}>
          <Text style={styles.sectionLabel}>CHANGE PASSWORD</Text>

          <Text style={styles.label}>Current Password</Text>
          <TextInput
            style={styles.passwordInput}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Enter current password"
            placeholderTextColor={colors.textMuted}
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
            placeholderTextColor={colors.textMuted}
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
            placeholderTextColor={colors.textMuted}
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
              <ActivityIndicator color={colors.signal} />
            ) : (
              <Text style={styles.changePasswordBtnText}>Update Password</Text>
            )}
          </TouchableOpacity>
        </View>

        <LaneDivider />

        <View style={styles.dangerSection}>
          <TouchableOpacity style={styles.aboutBtn} onPress={onAbout} activeOpacity={0.7}>
            <Ionicons name="information-circle-outline" size={18} color={colors.signal} />
            <Text style={styles.aboutText}>About SIPAT</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount} activeOpacity={0.7}>
            <Ionicons name="trash-outline" size={18} color={colors.severe} />
            <Text style={styles.deleteText}>Delete Account</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={18} color={colors.severe} />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <Modal visible={deleteModalVisible} transparent animationType="fade" onRequestClose={() => { if (!deleting) setDeleteModalVisible(false) }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Delete Account</Text>
            <Text style={styles.modalDesc}>Type <Text style={{ fontFamily: fonts.extrabold, color: colors.severe }}>DELETE</Text> to confirm permanent account deletion.</Text>
            <TextInput
              style={styles.modalInput}
              value={deleteInput}
              onChangeText={setDeleteInput}
              placeholder="Type DELETE"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!deleting}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => { setDeleteModalVisible(false); setDeleteInput('') }}
                disabled={deleting}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalDeleteBtn, (deleteInput !== 'DELETE' || deleting) && styles.modalDeleteBtnDisabled]}
                onPress={confirmDeleteAccount}
                disabled={deleteInput !== 'DELETE' || deleting}
                activeOpacity={0.7}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color={colors.severe} />
                ) : (
                  <Text style={styles.modalDeleteText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },

  // Avatar — YOLO detection brackets frame the initial (single hero bracket)
  avatarSection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  avatarFrame: {
    width: 96,
    height: 96,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.signalDim,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: colors.signal,
    fontFamily: fonts.bold,
    fontSize: 32,
  },
  displayName: {
    color: colors.textPrimary,
    fontFamily: fonts.semibold,
    fontSize: 20,
  },
  email: {
    color: colors.textMuted,
    fontFamily: fonts.mono,
    fontSize: 13,
    marginTop: spacing.xs,
  },

  // Username / email form
  formSection: {
    paddingHorizontal: spacing.lg,
  },
  label: {
    color: colors.textSecondary,
    fontFamily: fonts.semibold,
    fontSize: 13,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  input: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  inputDisabled: {
    borderColor: colors.hairlineStrong,
    color: colors.textMuted,
  },
  cooldownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.moderateDim,
  },
  cooldownText: {
    color: colors.moderate,
    fontFamily: fonts.semibold,
    fontSize: 12,
  },
  readOnlyField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  readOnlyText: {
    color: colors.textMuted,
    fontFamily: fonts.mono,
    fontSize: 14,
  },
  saveBtn: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.signal,
    borderRadius: radius.md,
    marginTop: spacing.xl,
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    color: colors.onSignal,
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  changePasswordSection: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  sectionLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  passwordInput: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  changePasswordBtn: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.signalDim,
    borderRadius: radius.md,
    marginTop: spacing.lg,
  },
  changePasswordBtnDisabled: {
    opacity: 0.4,
  },
  changePasswordBtnText: {
    color: colors.signal,
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  dangerSection: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  aboutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 48,
    backgroundColor: colors.signalDim,
    borderRadius: radius.md,
  },
  aboutText: {
    color: colors.signal,
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 48,
    backgroundColor: colors.severeDim,
    borderRadius: radius.md,
  },
  deleteText: {
    color: colors.severe,
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 48,
    backgroundColor: colors.severeDim,
    borderRadius: radius.md,
  },
  logoutText: {
    color: colors.severe,
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    width: '100%',
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.extrabold,
    fontSize: 17,
    marginBottom: spacing.sm,
  },
  modalDesc: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  modalInput: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    color: colors.severe,
    fontFamily: fonts.monoBold,
    fontSize: 15,
    letterSpacing: 2,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  modalCancelBtn: {
    flex: 1,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  modalCancelText: {
    color: colors.textSecondary,
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  modalDeleteBtn: {
    flex: 1,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.severeDim,
    borderRadius: radius.md,
  },
  modalDeleteBtnDisabled: {
    opacity: 0.4,
  },
  modalDeleteText: {
    color: colors.severe,
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
})
