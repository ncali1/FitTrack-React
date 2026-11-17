import { toast } from 'sonner'

/**
 * Tells the user a sign-out didn't go through. Shared by the two sign-out buttons, which
 * otherwise would leave the user looking at an app that silently stayed signed in.
 */
export function reportSignOutFailure(err: unknown) {
  console.error('Failed to sign out:', err)
  toast.error('Couldn’t sign out. Check your connection and try again.')
}
