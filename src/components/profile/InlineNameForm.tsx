import { useState } from 'react'
import type { FormEvent } from 'react'

/** A one-line "name it, then Save / Cancel" form, used for creating and renaming list items. */
export function InlineNameForm({
  label,
  initialValue = '',
  onSave,
  onCancel,
}: {
  /** Used as both the placeholder and the accessible label, e.g. "Routine name". */
  label: string
  initialValue?: string
  onSave: (name: string) => void | Promise<void>
  onCancel: () => void
}) {
  const [value, setValue] = useState(initialValue)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const name = value.trim()
    if (name) onSave(name)
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        type="text"
        placeholder={label}
        className="field-input flex-1"
        aria-label={label}
        autoFocus
      />
      <button type="submit" className="btn-primary !px-3 !py-1.5 text-xs">
        Save
      </button>
      <button type="button" onClick={onCancel} className="btn-ghost !px-3 !py-1.5 text-xs">
        Cancel
      </button>
    </form>
  )
}
