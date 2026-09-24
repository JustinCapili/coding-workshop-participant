import { useCallback, useState } from 'react'

/**
 * Wrap a mutating action with `submitting` / `error` state.
 * Returns [submit, { submitting, error, reset }]. `submit` resolves to the action's result, or
 * `undefined` when it threw (the error is captured in state, not rethrown).
 */
export function useSubmit(action) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const submit = useCallback(
    async (...args) => {
      setSubmitting(true)
      setError(null)
      try {
        return await action(...args)
      } catch (err) {
        setError(err)
        return undefined
      } finally {
        setSubmitting(false)
      }
    },
    [action],
  )

  const reset = useCallback(() => setError(null), [])
  return [submit, { submitting, error, reset }]
}
