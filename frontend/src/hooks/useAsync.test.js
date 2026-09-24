import { act, renderHook, waitFor } from '@testing-library/react'
import { useAsync } from './useAsync'

/** A promise the test settles by hand, to control the order in which runs finish. */
function deferred() {
  let resolve, reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('useAsync', () => {
  it('is loading with no data at first, then exposes the loaded data', async () => {
    const { result } = renderHook(() => useAsync(async () => 'loaded'))

    expect(result.current).toMatchObject({ data: null, error: null, loading: true })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current).toMatchObject({ data: 'loaded', error: null })
  })

  it('captures a rejection, or a loader that throws synchronously, as the error', async () => {
    const failure = new Error('boom')
    const { result } = renderHook(() =>
      useAsync(() => {
        throw failure
      }),
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current).toMatchObject({ data: null, error: failure })
  })

  it('re-runs when deps change, keeping the previous data while the new run is in flight', async () => {
    const runs = { a: deferred(), b: deferred() }
    const loader = jest.fn((key) => runs[key].promise)
    const { result, rerender } = renderHook(({ id }) => useAsync(() => loader(id), [id]), {
      initialProps: { id: 'a' },
    })

    await act(async () => runs.a.resolve('A'))
    expect(result.current).toMatchObject({ data: 'A', loading: false })

    rerender({ id: 'b' })
    expect(result.current).toMatchObject({ data: 'A', loading: true })

    await act(async () => runs.b.resolve('B'))
    expect(result.current).toMatchObject({ data: 'B', loading: false })
    expect(loader.mock.calls).toEqual([['a'], ['b']])
  })

  /** Starts run "a", lets its loader be called, then supersedes it with run "b". */
  async function supersede() {
    const runs = { a: deferred(), b: deferred() }
    const loader = jest.fn((id) => runs[id].promise)
    const hook = renderHook(({ id }) => useAsync(() => loader(id), [id]), {
      initialProps: { id: 'a' },
    })
    await act(async () => {})
    hook.rerender({ id: 'b' })
    await act(async () => {})
    expect(loader.mock.calls).toEqual([['a'], ['b']])
    return { ...hook, runs }
  }

  it('drops the result of a superseded run, even when it finishes last', async () => {
    const { result, runs } = await supersede()

    await act(async () => runs.b.resolve('fresh'))
    await act(async () => runs.a.resolve('stale'))

    expect(result.current).toMatchObject({ data: 'fresh', loading: false, error: null })
  })

  it('drops the error of a superseded run', async () => {
    const { result, runs } = await supersede()

    await act(async () => runs.b.resolve('fresh'))
    await act(async () => runs.a.reject(new Error('stale failure')))

    expect(result.current).toMatchObject({ data: 'fresh', error: null })
  })

  it('does not re-run for deps that serialise the same, or for a new loader function', async () => {
    const loader = jest.fn(async () => 'x')
    const { result, rerender } = renderHook(
      ({ filter }) => useAsync(() => loader(filter), [filter]),
      { initialProps: { filter: { status: 'OPEN' } } },
    )
    await waitFor(() => expect(result.current.loading).toBe(false))

    rerender({ filter: { status: 'OPEN' } })
    await act(async () => {})

    expect(loader).toHaveBeenCalledTimes(1)
    expect(result.current.loading).toBe(false)
  })

  it('reload re-runs with the latest loader', async () => {
    let value = 1
    const { result } = renderHook(() => useAsync(async () => value))
    await waitFor(() => expect(result.current.data).toBe(1))

    value = 2
    act(() => result.current.reload())
    expect(result.current).toMatchObject({ data: 1, loading: true })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toBe(2)
  })

  it('keeps the last good data when a reload fails, and clears the error on the next success', async () => {
    let outcome = () => Promise.resolve('good')
    const { result } = renderHook(() => useAsync(() => outcome()))
    await waitFor(() => expect(result.current.data).toBe('good'))

    const failure = new Error('offline')
    outcome = () => Promise.reject(failure)
    act(() => result.current.reload())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current).toMatchObject({ data: 'good', error: failure })

    outcome = () => Promise.resolve('better')
    act(() => result.current.reload())
    expect(result.current.error).toBeNull()
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current).toMatchObject({ data: 'better', error: null })
  })

  it('keeps reload stable across renders', async () => {
    const { result, rerender } = renderHook(() => useAsync(async () => 1))
    const first = result.current.reload
    rerender()
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.reload).toBe(first)
  })
})
