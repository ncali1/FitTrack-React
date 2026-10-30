import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useWorkoutTemplatesStore } from './workoutTemplates'
import { useRoutineStore } from './routine'

vi.mock('@/services/storage', () => ({
  storageService: {
    saveRoutine: vi.fn(async () => {}),
    getAllRoutines: vi.fn(async () => []),
    deleteRoutine: vi.fn(async () => {}),
    saveWorkoutTemplate: vi.fn(async () => {}),
    getAllWorkoutTemplates: vi.fn(async () => []),
    saveCardioSession: vi.fn(async () => {}),
    getAllCardioSessions: vi.fn(async () => []),
    deleteCardioSession: vi.fn(async () => {}),
    deleteWorkoutTemplate: vi.fn(async () => {}),
  },
}))

import { storageService } from '@/services/storage'

const mockedStorage = vi.mocked(storageService)
const INITIAL_TEMPLATES_STATE = useWorkoutTemplatesStore.getState()
const INITIAL_ROUTINE_STATE = useRoutineStore.getState()

describe('useWorkoutTemplatesStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useWorkoutTemplatesStore.setState(INITIAL_TEMPLATES_STATE, true)
    useRoutineStore.setState(INITIAL_ROUTINE_STATE, true)
  })

  it('creates a template with a trimmed name and persists it', async () => {
    const created = await useWorkoutTemplatesStore.getState().createTemplate('  Push Day  ', ['ex1'])

    expect(created).toMatchObject({ name: 'Push Day', exerciseIds: ['ex1'] })
    expect(useWorkoutTemplatesStore.getState().templates).toEqual([created])
    expect(mockedStorage.saveWorkoutTemplate).toHaveBeenCalledWith(created)
  })

  it('renames a template', async () => {
    const { createTemplate, renameTemplate } = useWorkoutTemplatesStore.getState()
    const created = await createTemplate('Push')
    await renameTemplate(created.id, 'Push Day')

    expect(useWorkoutTemplatesStore.getState().templates[0]?.name).toBe('Push Day')
  })

  it('replaces the exercise list in the given order, dropping duplicates', async () => {
    const { createTemplate, setTemplateExercises } = useWorkoutTemplatesStore.getState()
    const created = await createTemplate('Push', ['a', 'b'])
    await setTemplateExercises(created.id, ['b', 'a', 'b', 'c'])

    expect(useWorkoutTemplatesStore.getState().templates[0]?.exerciseIds).toEqual(['b', 'a', 'c'])
  })

  it('duplicates a template into an independent copy', async () => {
    const { createTemplate, duplicateTemplate, setTemplateExercises } = useWorkoutTemplatesStore.getState()
    const original = await createTemplate('Push', ['a'])
    const copy = await duplicateTemplate(original.id)
    await setTemplateExercises(original.id, ['a', 'b'])

    expect(copy).toMatchObject({ name: 'Push copy', exerciseIds: ['a'] })
    expect(copy?.id).not.toBe(original.id)
    expect(useWorkoutTemplatesStore.getState().templates.find((t) => t.id === copy!.id)?.exerciseIds).toEqual(['a'])
  })

  it('deleting a template removes it from every day it was assigned to', async () => {
    await useRoutineStore.getState().loadRoutines()
    const created = await useWorkoutTemplatesStore.getState().createTemplate('Push', ['a'])
    await useRoutineStore.getState().assignTemplate('monday', created.id)
    await useRoutineStore.getState().assignTemplate('friday', created.id)

    await useWorkoutTemplatesStore.getState().deleteTemplate(created.id)

    expect(useWorkoutTemplatesStore.getState().templates).toEqual([])
    expect(mockedStorage.deleteWorkoutTemplate).toHaveBeenCalledWith(created.id)
    const weeklyTemplates = useRoutineStore.getState().activeRoutine()?.weeklyTemplates ?? {}
    expect(Object.values(weeklyTemplates).flat()).toEqual([])
  })

  it('records the failure and re-throws when saving fails', async () => {
    mockedStorage.saveWorkoutTemplate.mockRejectedValueOnce(new Error('disk full'))

    await expect(useWorkoutTemplatesStore.getState().createTemplate('Push')).rejects.toThrow('disk full')
    expect(useWorkoutTemplatesStore.getState().error).toBe('disk full')
  })
})
