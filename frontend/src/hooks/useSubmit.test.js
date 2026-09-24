import { act, renderHook } from '@testing-library/react'
import { useSubmit } from './useSubmit'

describe('useSubmit', () => {
  it('starts idle with no error', () => {
    const { result } = renderHook(() => useSubmit(jest.fn()))
    const [, state] = result.current
    expect(state).toMatchObject({ submitting: false, error: null })
  })

  it("passes the arguments through and resolves to the action's result", async () => {
    const action = jest.fn(async (a, b) => a + b)
    const { result } = renderHook(() => useSubmit(action))

    let returned
    await act(async () => {
      returned = await result.current[0](2, 3)
    })

    expect(returned).toBe(5)
    expect(action).toHaveBeenCalledWith(2, 3)
    expect(result.current[1]).toMatchObject({ submitting: false, error: null })
  })

  it('is submitting while the action is in flight', async () => {
    let finish
    const action = () => new Promise((resolve) => (finish = resolve))
    const { result } = renderHook(() => useSubmit(action))

    let pending
    act(() => {
      pending = result.current[0]()
    })
    expect(result.current[1].submitting).toBe(true)

    await act(async () => {
      finish('done')
      await pending
    })
    expect(result.current[1].submitting).toBe(false)
  })

  it('captures a failure instead of rethrowing it, and resolves to undefined', async () => {
    const failure = new Error('409 conflict')
    const { result } = renderHook(() => useSubmit(async () => {
      throw failure
    }))

    let returned = 'unset'
    await act(async () => {
      returned = await result.current[0]()
    })

    expect(returned).toBeUndefined()
    expect(result.current[1]).toMatchObject({ submitting: false, error: failure })
  })

  it('reset clears the error', async () => {
    const { result } = renderHook(() => useSubmit(async () => {
      throw new Error('nope')
    }))
    await act(async () => {
      await result.current[0]()
    })
    expect(result.current[1].error).not.toBeNull()

    act(() => result.current[1].reset())
    expect(result.current[1].error).toBeNull()
  })

  it('clears a previous error when the next submit starts', async () => {
    let fail = true
    const { result } = renderHook(() => useSubmit(async () => {
      if (fail) throw new Error('first try')
      return 'ok'
    }))
    await act(async () => {
      await result.current[0]()
    })
    expect(result.current[1].error).toBeTruthy()

    fail = false
    await act(async () => {
      await result.current[0]()
    })
    expect(result.current[1].error).toBeNull()
  })
})
