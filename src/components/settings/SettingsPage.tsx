import { X } from 'lucide-react'
import { useSettingsStore } from '@/stores/settings'
import { BackupControls } from './BackupControls'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'

const REST_PRESETS = [30, 60, 90, 120, 180]

/**
 * Consolidated local-device preferences: weight unit, default rest timer duration,
 * workout reminders, and data export/import. Portaled to document.body (same as
 * ChangePasswordModal) to avoid TopBar's backdrop-blur creating a containing block that
 * would clip the overlay. Opened from a gear icon that's always visible in TopBar, since
 * these preferences are per-device and don't require signing in.
 */
export function SettingsPage({ onClose }: { onClose: () => void }) {
  useBodyScrollLock()
  const weightUnit = useSettingsStore((s) => s.weightUnit)
  const toggleWeightUnit = useSettingsStore((s) => s.toggleWeightUnit)
  const restDuration = useSettingsStore((s) => s.restDuration)
  const setRestDuration = useSettingsStore((s) => s.setRestDuration)
  const remindersEnabled = useSettingsStore((s) => s.remindersEnabled)
  const setRemindersEnabled = useSettingsStore((s) => s.setRemindersEnabled)

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal-panel">
        <div className="p-6">
          <div className="section-header mb-5">
            <h2 className="text-ink">Settings</h2>
            <button onClick={onClose} className="btn-icon" aria-label="Close">
              <X size={18} strokeWidth={2} />
            </button>
          </div>

          <div className="space-y-6">
            {/* Weight unit */}
            <div>
              <span className="field-label">Weight Unit</span>
              <div className="flex gap-2">
                <button
                  onClick={() => weightUnit !== 'kg' && toggleWeightUnit()}
                  aria-pressed={weightUnit === 'kg'}
                  className={weightUnit === 'kg' ? 'btn-primary flex-1' : 'btn-secondary flex-1'}
                >
                  Kilograms (kg)
                </button>
                <button
                  onClick={() => weightUnit !== 'lb' && toggleWeightUnit()}
                  aria-pressed={weightUnit === 'lb'}
                  className={weightUnit === 'lb' ? 'btn-primary flex-1' : 'btn-secondary flex-1'}
                >
                  Pounds (lb)
                </button>
              </div>
            </div>

            {/* Rest timer duration */}
            <div>
              <span className="field-label">Default Rest Timer</span>
              <div className="flex flex-wrap gap-2">
                {REST_PRESETS.map((seconds) => (
                  <button
                    key={seconds}
                    onClick={() => setRestDuration(seconds)}
                    aria-pressed={restDuration === seconds}
                    className={restDuration === seconds ? 'btn-primary !px-3 !py-1.5 text-xs' : 'btn-secondary !px-3 !py-1.5 text-xs'}
                  >
                    {seconds}s
                  </button>
                ))}
              </div>
            </div>

            {/* Workout reminders */}
            <div>
              <span className="field-label">Workout Reminders</span>
              <button
                onClick={() => setRemindersEnabled(!remindersEnabled)}
                aria-pressed={remindersEnabled === true}
                className={remindersEnabled === true ? 'btn-primary w-full' : 'btn-secondary w-full'}
              >
                {remindersEnabled === true ? 'Enabled' : 'Disabled'}
              </button>
            </div>

            {/* Data export / import */}
            <div>
              <span className="field-label">Backup</span>
              <BackupControls />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
