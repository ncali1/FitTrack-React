# User Guide

What each screen does and how the main flows work. File paths point to the component that implements each part.

## First launch

The app decides what to show in this order (`src/App.tsx`):

1. **Set a new password**, only if you arrived from a password-reset email.
2. **Onboarding**, a three-step intro shown once per device: welcome, a goal picker, and a "Daily reminders" switch. "Skip" is always available. (`src/components/onboarding/Onboarding.tsx`)
3. **Sign in**, only when the build has cloud sync configured and you are not signed in. "Skip for now — use this device only" dismisses it for this device. (`src/components/auth/AuthGate.tsx`)
4. **The app**, once local data has loaded.

The goal chosen in onboarding is not saved anywhere. The component's own comment says there is no field for it in the data model yet.

## Navigation

Five tabs, defined in `src/components/layout/tabs.ts`: Home, Train, Library, Progress, Profile. On a phone they sit in a bottom bar. On wider screens they move to the top bar.

The top bar also has a KG/LB toggle and a gear icon that opens a small Settings sheet (weight unit, default rest timer, workout reminders, backup). When signed in it adds an account menu with change password and sign out. (`src/components/layout/TopBar.tsx`, `src/components/settings/SettingsPage.tsx`)

## Home

`src/components/home/HomeDashboard.tsx`

- A date and ISO week number stamp.
- **Today's training**: the planned exercises with target sets × reps and a "Start workout" button that opens Train. On a day with nothing planned it shows "Rest day", with a "Repeat last workout" button if you have trained before. That button adds your last workout's completed exercises to today's weekday in the active program.
- Three stats: training streak in days, this week's completion percentage, and latest body weight with the change since the previous entry.
- A **backup reminder** when one is due (see below).

How the streak is counted (`calculateStreak` in `src/utils/calculations.ts`): rest days are skipped without breaking it. A planned day counts only if every planned exercise was completed. Today is exempt, so the streak does not drop to zero at midnight before you have trained.

## Train

`src/components/checklist/DailyChecklist.tsx`

### The daily checklist

- A day selector covering the last seven days, a "Go to Today" shortcut and a date picker for older dates.
- The exercises planned for that date. Tap one to open the log form. Tap a completed one to mark it incomplete.
- "Do a routine" or "Do a different routine" opens a sheet to **replace** the day's plan with a routine or **add** a routine on top of it. "Back to the scheduled plan" undoes the override. This is how any routine can be done on any day.
- A cardio section for the selected date.

### Logging an exercise

`src/components/checklist/PerformanceForm.tsx`

You log sets, reps, an optional weight, a difficulty (easy, moderate, hard), an optional RPE from 6 to 10 in half steps, and whether it was a warm-up.

- **Suggestion.** A fresh log is pre-filled from your last completed performance. If that one was rated easy, the suggested weight goes up by 2.5 kg. Otherwise it repeats. A hard or unrated set never earns an increase. (`src/utils/progressiveOverload.ts`)
- **Warm-up ramp.** Once a working weight is entered you can open a list of warm-up sets (empty bar, then roughly 40, 60 and 80 percent) with the plates to load per side. It is guidance only and logs nothing. (`src/utils/warmupSets.ts`, `src/utils/plateCalculator.ts`)
- **Personal records.** Beating your best weight or reps for an exercise shows a PR toast. Warm-ups never count. (`src/utils/personalRecords.ts`)

### Rest timer

There are two rest countdowns, and they are kept separate on purpose.

| Flow | What you see | Controls |
| --- | --- | --- |
| Tap-to-log checklist | A floating timer widget with a progress ring (`src/components/widgets/RestTimer.tsx`) | −15s, +15s, Skip |
| Guided session | A full-screen countdown that names what is up next | Skip rest |

The rest length is the exercise's own override if it has one, otherwise the default from Preferences (90 seconds out of the box).

When rest ends (`src/services/restAlert.ts`):

- App in the foreground: a two-tone beep if sound is on, and a vibration if vibration is on.
- App in the background or phone locked: a system notification. On the native apps the OS schedules it. In a browser it is best effort and only fires if notification permission was already granted.

The timer stays correct when the phone locks because it is calculated from an end time, not counted down tick by tick.

### Guided session

`src/components/checklist/GuidedSession.tsx`, `src/components/checklist/SessionGroupPicker.tsx`

1. Tap "Start guided workout". It covers the exercises not yet completed for that date.
2. Optionally group exercises into **supersets**: select two or more and tap "Group selected". Skipping this step gives the plain one-at-a-time flow.
3. For each exercise: log it, then rest, then the next one. Inside a superset you move straight to the next member with no rest, and rest once after the whole group.
4. **Swap exercise** offers up to eight stand-ins that work the same muscles, drawn from your exercises and the built-in catalog. The replacement takes that slot in the session and in the day's plan. (`src/components/checklist/SwapExerciseSheet.tsx`, `src/utils/exerciseSwap.ts`)
5. "Finish workout" shows a summary with exercises completed and total volume, and saves the session's duration.
6. "End session" leaves early. Everything logged so far is already saved.

A guided session survives switching tabs and the app being closed. It is dropped if left unfinished for more than 12 hours. The screen is kept awake during a session and during a rest timer unless you turn that off in Preferences. (`src/stores/guidedSession.ts`, `src/hooks/useKeepAwake.ts`)

### Cardio

`src/components/cardio/CardioDayCard.tsx`, `src/components/cardio/CardioForm.tsx`

Log a cardio session for the selected date: type, duration, and optionally distance, average heart rate, calories and notes. Several sessions can share a day. Tap one to edit or delete it.

Types: Run, Walk, Hike, Cycle, Row, Swim, Elliptical, Stair climber, HIIT, Other. Run, walk and hike show pace. Cycling shows speed. Rowing shows pace per 500 m and swimming per 100 m. (`src/utils/cardio.ts`)

Distance is entered in your chosen unit (km or mi) and always stored in kilometres.

## Library

`src/components/library/WorkoutLibrary.tsx`

- One searchable, filterable list of every exercise: a built-in catalog of 55 exercises (`src/data/workoutLibrary.ts`) plus your own.
- Filter chips group muscles into broader regions.
- Switch between a ruled list and a grid of tiles. The choice is remembered per device.
- "Add exercise" creates a custom exercise with a name, target sets and reps, muscle groups, optional notes and an optional rest override.
- Tap an exercise to add it to today or to a routine. Adding a catalog entry copies it into your own exercises the first time. Custom exercises can also be edited or deleted.
- **Exercise preview**: a 3D figure loops one rep with the target muscles highlighted. Where WebGL is not available it falls back to a 2D muscle diagram. (`src/components/library/ExercisePreview.tsx`)

## Progress

`src/components/progress/ProgressGraphs.tsx`

- This week's completion.
- Cardio overview: this week's session count, time and distance next to last week's, and recent sessions.
- Muscle balance: completed sets per muscle group.
- A picker of exercises that have history, driving a weight-over-time chart, plus reps, completion and full history. Personal records and an estimated one-rep max (Epley formula, `src/utils/oneRepMax.ts`) are shown.
- Body weight trend with its own log form. Logging twice on one date overwrites that date's entry.

## Profile

`src/components/profile/ProfileScreen.tsx`

| Section | What it does | File |
| --- | --- | --- |
| Lifetime stats | Workouts logged, current streak, records set | `ProfileStats.tsx` |
| Routines | Create, edit, duplicate and delete reusable exercise lists | `RoutinesCard.tsx`, `src/components/routine/RoutineEditor.tsx` |
| Weekly plan | Choose the active program; create, rename, duplicate and delete programs; open the plan builder | `ProgramsCard.tsx`, `src/components/routine/RoutineBuilder.tsx` |
| Preferences | Units, distance unit, rest timer length, sound, vibration, keep screen awake, notifications | `PreferencesCard.tsx` |
| Data & account | Backup, device storage status, cloud sync status, change password, privacy policy, version, delete all data | `DataAccountCard.tsx` |

### Routines and weekly programs

- A **routine** is a named, ordered list of exercises such as "Push Day". Editing it updates every day it is assigned to, because days refer to it rather than copying it.
- A **program** is a saved week. Each weekday can hold routines and individual exercises. A day's plan is the routines' exercises in order, then the individual ones, without duplicates.
- One program is active at a time and drives Home, Train and Progress. You cannot delete the last remaining program. Deleting the active one activates the most recently updated of the rest.
- Deleting a routine unassigns it from every day of every program.

### Preferences

| Setting | Options | Default |
| --- | --- | --- |
| Units | kg, lb | kg |
| Distance | km, mi | km |
| Rest timer | 30, 60, 90, 120, 180 seconds, or a custom value from 5 to 900 | 90 |
| Rest timer sound | on, off | off |
| Rest timer vibration | on, off | on |
| Keep screen awake | on, off | on |
| Notifications (workout reminders) | on, off | not yet asked |

Defaults are in `src/stores/settings.ts`. Preferences belong to the device. They are not synced and not included in backups.

### Workout reminders

`src/components/widgets/WorkoutReminder.tsx`

When the app opens on a day that has a plan and nothing logged yet, it shows an in-app nudge, at most once per day. The first time, it asks whether you want these nudges at all. It is not a push notification: nothing runs while the app is closed.

## Backups

### Export and import

`src/components/settings/BackupControls.tsx`, `src/utils/exportData.ts`

- **Export** downloads `fittrack-backup-YYYY-MM-DD.json` with every exercise, routine, program, workout session, body weight entry and cardio session.
- **Import** merges a backup file into what is on the device. Records with a matching id are overwritten. Nothing already stored is deleted.
- Older backup files still import.
- If you are signed in, imported records are uploaded on the next sync.

The buttons are in Profile under Data & account and in the gear-icon Settings sheet. Both show when the device was last backed up.

### Backup reminder

`src/components/home/BackupReminder.tsx`, `src/utils/backupReminder.ts`

Home shows "Back up your log" when all of these are true:

- You are not signed in, so the device holds the only copy.
- You have logged something (sessions, cardio or body weight).
- 30 days have passed since the last export or import, or since your oldest record if you have never backed up.
- Something has changed since the last backup.

"Export backup" clears it. "Later" hides it for 7 days.

### Storage protection

`src/services/persistentStorage.ts`

Browsers can clear a site's data when the device runs low on space or the site goes unused. After your first save in a visit, FitTrack asks the browser to keep its data. Profile shows the result under "Device storage":

- **Protected**: the browser has agreed.
- **Not protected**, with a **Protect** button to ask again. Installing the app to the home screen is what usually earns a yes.

Nothing is shown in the native apps, where browser eviction does not apply.

### Delete all my data

`src/components/profile/DataAccountCard.tsx`

Asks for confirmation, then deletes every exercise, routine, program, workout, cardio session and body weight entry on the device, and in your cloud account if you are signed in. The cloud is cleared first, so a failure there leaves the device untouched, though the cloud may already be partly cleared; try again to finish. Per-device preferences are not reset by this button.

If you use the app on more than one device, you only need to do this once, signed in. Your other devices clear their copies the next time they sync, and changes they hadn't synced yet are discarded rather than uploaded again. Anything you add after the delete is kept as normal.

If you are signed out, the button reads **Delete from this device**: it clears only this device, and your cloud copy stays. Sign in and delete again to remove that too. See [Cloud Sync and Auth](Cloud-Sync-and-Auth.md#deleting-everything) for the details and the limits.

## Installing the app

`src/components/widgets/InstallPrompt.tsx`

- **Android and desktop Chrome**: an in-app banner offers "Install".
- **iPhone**: the banner explains Share → Add to Home Screen, since iOS has no install prompt.

The banner is hidden once the app is installed, and for 14 days after "Not now".
