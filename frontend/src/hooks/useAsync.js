import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Run an async loader and expose { data, loading, error, reload }.
 *
 * The loader re-runs whenever `deps` change (deps must be JSON-serialisable — ids, strings,
 * plain objects). Results from a superseded run are dropped so a fast filter change never paints
 * stale data over fresh data. Previous `data` is kept while a new run is in flight so grids can
 * dim rather than flash empty.
 */
export function useAsync(loader, deps = []) {
  const depsKey = JSON.stringify(deps)
  const [tick, setTick] = useState(0)
  const runKey = `${depsKey}|${tick}`

  const [result, setResult] = useState({ key: null, data: null, error: null })

  // Always call the latest loader without making it an effect dependency.
  const loaderRef = useRef(loader)
  useEffect(() => {
    loaderRef.current = loader
  })

  useEffect(() => {
    let cancelled = false
    Promise.resolve()
      .then(() => loaderRef.current())
      .then(
        (data) => {
          if (!cancelled) setResult({ key: runKey, data, error: null })
        },
        (error) => {
          if (!cancelled) setResult((prev) => ({ key: runKey, data: prev.data, error }))
        },
      )
    return () => {
      cancelled = true
    }
  }, [runKey])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  const settled = result.key === runKey

  return {
    data: result.data,
    error: settled ? result.error : null,
    loading: !settled,
    reload,
  }
}
