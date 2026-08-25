import { useRef } from 'react'
import { X, Download, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { useSettingsStore } from '@/stores/settings'
import { useExercisesStore } from '@/stores/exercises'
import { useRoutineStore } from '@/stores/routine'
import { useWorkoutSessionsStore } from '@/stores/workoutSessions'
import { useBodyWeightStore } from '@/stores/bodyWeight'
import { downloadBackup, readBackupFile, restoreBackup, InvalidBackupError, type RestoreCounts } from '@/utils/exportData'

const REST_PRESETS = [30, 60, 90, 120, 180]

function summarizeCounts(counts: RestoreCounts): string {
  return `${counts.exercises} exercises, ${counts.routines} routines, ${counts.workoutSessions} sessions, ${counts.bodyWeightLogs} body weight logs`
}

/**
 * Consolidated local-device preferences: weight unit, default rest timer duration,
 * workout reminders, and data export/import. Portaled to document.body (same as
 * ChangePasswordModal) to avoid TopBar's backdrop-blur creating a containing block that
 * would clip the overlay. Opened from a gear icon that's always visible in TopBar, since
 * these preferences are per-device and don't require signing in.
 */
export function SettingsPage({ onClose }: { onClose: () => void }) {
  const weightUnit = useSettingsStore((s) => s.weightUnit)
  const toggleWeightUnit = useSettingsStore((s) => s.toggleWeightUnit)
  const restDuration = useSettingsStore((s) => s.restDuration)
  const setRestDuration = useSettingsStore((s) => s.setRestDuration)
  const remindersEnabled = useSettingsStore((s) => s.remindersEnabled)
  const setRemindersEnabled = useSettingsStore((s) => s.setRemindersEnabled)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const reloadAllStores = async () => {
    await Promise.all([
      useExercisesStore.getState().loadExercises(),
      useRoutineStore.getState().loadRoutines(),
      useWorkoutSessionsStore.getState().loadSessions(),
      useBodyWeightStore.getState().loadLogs(),
    ])
  }

  const handleExport = async () => {
    try {
      await downloadBackup()
      toast.success('Backup downloaded')
    } catch (err) {
      console.error('Failed to export backup:', err)
      toast.error('Failed to export backup')
    }
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    try {
      const backup = await readBackupFile(file)
      const counts = await restoreBackup(backup)
      await reloadAllStores()
      toast.success(`Backup restored: ${summarizeCounts(counts)}`)
    } catch (err) {
      console.error('Failed to import backup:', err)
      toast.error(err instanceof InvalidBackupError ? err.message : 'Failed to import backup')
    }
  }

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
              <div className="flex gap-2">
                <button onClick={handleExport} className="btn-secondary flex-1">
                  <Download size={16} strokeWidth={2} />
                  Export
                </button>
                <button onClick={handleImportClick} className="btn-secondary flex-1">
                  <Upload size={16} strokeWidth={2} />
                  Import
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json"
                  aria-label="Import backup file"
                  className="hidden"
                  onChange={handleFileSelected}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
