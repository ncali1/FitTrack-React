import { useState } from 'react'
import { HeartPulse, Target, Bell } from 'lucide-react'
import { useSettingsStore } from '@/stores/settings'

const GOAL_OPTIONS = ['Build strength', 'Lose weight', 'Stay consistent', 'General fitness']

const STEPS = [
  {
    icon: HeartPulse,
    headline: 'Welcome to FitTrack',
    body: 'Plan your training, log every set, and watch your progress add up.',
  },
  {
    icon: Target,
    headline: 'What’s your main goal?',
    body: 'This tunes the suggestions you’ll see — you can change it anytime.',
  },
  {
    icon: Bell,
    headline: 'Stay on track',
    body: 'A quiet nudge on the days you’ve got something planned.',
  },
]

/**
 * First-launch, three-step introduction: welcome, goal selection, and a notifications
 * opt-in. Shown once (gated by a localStorage flag in App.tsx) before the auth gate.
 * The goal choice is cosmetic/local only — there's no backing field for it in the data
 * model yet — but notifications wires directly into the same settings store the
 * Profile screen's toggle uses, so it's a real, persisted preference either way.
 */
export function Onboarding({ onFinish }: { onFinish: () => void }) {
  const [step, setStep] = useState(0)
  const [goal, setGoal] = useState<string | null>(null)
  const remindersEnabled = useSettingsStore((s) => s.remindersEnabled)
  const setRemindersEnabled = useSettingsStore((s) => s.setRemindersEnabled)

  const current = STEPS[step]!
  const Icon = current.icon
  const isLast = step === STEPS.length - 1

  const handleNext = () => {
    if (isLast) {
      onFinish()
    } else {
      setStep((s) => s + 1)
    }
  }

  return (
    <div className="min-h-screen flex flex-col pwa-safe-top pwa-safe-bottom px-6 py-8">
      <div className="flex justify-end">
        <button onClick={onFinish} className="text-ink-muted text-sm py-2 px-1">
          Skip
        </button>
      </div>

      <div className="flex-1 flex flex-col justify-center gap-5">
        <div className="w-[72px] h-[72px] rounded-[20px] border border-accent flex items-center justify-center">
          <Icon size={34} strokeWidth={1.75} className="text-accent" />
        </div>

        <div>
          <h1 className="text-[30px] leading-tight mb-2.5">{current.headline}</h1>
          <p className="text-[15px] leading-relaxed text-ink-muted">{current.body}</p>
        </div>

        {step === 1 && (
          <div className="flex flex-col gap-2.5 mt-1.5">
            {GOAL_OPTIONS.map((option) => (
              <button
                key={option}
                onClick={() => setGoal(option)}
                aria-pressed={goal === option}
                className={
                  goal === option
                    ? 'text-left px-4 py-3.5 rounded-xl text-sm min-h-11 bg-accent-500/15 border border-accent text-ink'
                    : 'text-left px-4 py-3.5 rounded-xl text-sm min-h-11 bg-surface border border-surface-border text-ink'
                }
              >
                {option}
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="card flex flex-row items-center justify-between p-3.5 mt-1.5">
            <div>
              <div className="text-sm font-medium text-ink">Daily reminders</div>
              <div className="text-xs text-ink-muted mt-0.5">A nudge on your training days</div>
            </div>
            <button
              role="switch"
              aria-checked={remindersEnabled === true}
              aria-label="Daily reminders"
              onClick={() => setRemindersEnabled(!remindersEnabled)}
              className={`w-11 h-6 rounded-full p-0.5 transition-colors flex-none ${remindersEnabled ? 'bg-accent' : 'bg-canvas-800'}`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${remindersEnabled ? 'translate-x-5' : 'translate-x-0'}`}
              />
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-[width] ${i === step ? 'w-[18px] bg-accent' : 'w-1.5 bg-canvas-800'}`}
            />
          ))}
        </div>
        <button className="btn-primary w-full h-12 text-[15px]" onClick={handleNext}>
          {isLast ? 'Get started' : 'Next'}
        </button>
      </div>
    </div>
  )
}
