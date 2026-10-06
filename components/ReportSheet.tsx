import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, fonts, radius, spacing } from '../theme/tokens'
import { REPORT_REASONS } from '../lib/reportReasons'

type Props = {
  visible: boolean
  /** 'reasons': pick a report reason. 'confirm': yes/no confirmation (e.g. unreport). */
  mode: 'reasons' | 'confirm'
  title: string
  subtitle?: string
  confirmLabel?: string
  /** Error message shown inline (e.g. "Report failed"). */
  error?: string | null
  submitting?: boolean
  onSelectReason?: (reason: string) => void
  onConfirm?: () => void
  onCancel: () => void
}

/**
 * Styled bottom-sheet dialog replacing the native Alert for report flows.
 * Cancel: backdrop tap, header ✕, or the Cancel button (and Android back).
 */
export default function ReportSheet({
  visible,
  mode,
  title,
  subtitle,
  confirmLabel = 'Confirm',
  error,
  submitting = false,
  onSelectReason,
  onConfirm,
  onCancel,
}: Props) {
  if (!visible) return null

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <TouchableWithoutFeedback onPress={onCancel}>
          <View style={styles.backdropTouch} />
        </TouchableWithoutFeedback>

        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onCancel}
              disabled={submitting}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {mode === 'reasons' ? (
            <View style={styles.reasons}>
              {REPORT_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason.value}
                  style={styles.reasonBtn}
                  onPress={() => onSelectReason?.(reason.value)}
                  disabled={submitting}
                  activeOpacity={0.7}
                >
                  <Text style={styles.reasonText}>{reason.label}</Text>
                  {submitting && <ActivityIndicator size="small" color={colors.textMuted} />}
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.confirmRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={onCancel}
                disabled={submitting}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, submitting && styles.confirmBtnDisabled]}
                onPress={onConfirm}
                disabled={submitting}
                activeOpacity={0.7}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={colors.severe} />
                ) : (
                  <Text style={styles.confirmText}>{confirmLabel}</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {mode === 'reasons' && (
            <TouchableOpacity
              style={styles.cancelWide}
              onPress={onCancel}
              disabled={submitting}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  backdropTouch: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    backgroundColor: colors.surfaceRaised,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl + spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 16,
    letterSpacing: -0.2,
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 13,
    marginTop: 2,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: colors.hairline,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reasons: {
    gap: spacing.xs,
  },
  reasonBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.hairline,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  reasonText: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  confirmRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  cancelText: {
    color: colors.textMuted,
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.severeDim,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  confirmBtnDisabled: {
    opacity: 0.6,
  },
  confirmText: {
    color: colors.severe,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  cancelWide: {
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
  },
  error: {
    marginTop: spacing.sm,
    color: colors.severe,
    fontFamily: fonts.medium,
    fontSize: 12,
  },
})
