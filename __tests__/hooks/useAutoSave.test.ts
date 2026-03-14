import { renderHook, act } from '@testing-library/react'
import { useAutoSave } from '@/hooks/useAutoSave'

jest.useFakeTimers()

beforeEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('useAutoSave', () => {
  it('calls saveFn after 2s debounce', async () => {
    const saveFn = jest.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutoSave(saveFn, 2000))

    await act(async () => { result.current.trigger('content') })
    expect(saveFn).not.toHaveBeenCalled()

    await act(async () => { jest.advanceTimersByTime(2000) })
    expect(saveFn).toHaveBeenCalledWith('content')
  })

  it('resets debounce on repeated calls', async () => {
    const saveFn = jest.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutoSave(saveFn, 2000))

    await act(async () => {
      result.current.trigger('first')
      jest.advanceTimersByTime(1000)
      result.current.trigger('second')
      jest.advanceTimersByTime(2000)
    })

    expect(saveFn).toHaveBeenCalledTimes(1)
    expect(saveFn).toHaveBeenCalledWith('second')
  })

  it('flush() immediately calls saveFn with the latest content', async () => {
    const saveFn = jest.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutoSave(saveFn, 2000))

    let callsBeforeFlush = -1
    await act(async () => {
      result.current.trigger('pending content')
      callsBeforeFlush = saveFn.mock.calls.length
      result.current.flush()
    })

    expect(callsBeforeFlush).toBe(0)
    expect(saveFn).toHaveBeenCalledWith('pending content')
  })

  it('flush() is a no-op when no timer is pending', async () => {
    const saveFn = jest.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutoSave(saveFn, 2000))

    await act(async () => { result.current.flush() })
    expect(saveFn).not.toHaveBeenCalled()
  })

  it('flush() cancels the pending timer', async () => {
    const saveFn = jest.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutoSave(saveFn, 2000))

    await act(async () => {
      result.current.trigger('content')
      result.current.flush()
      jest.advanceTimersByTime(2000)
    })

    expect(saveFn).toHaveBeenCalledTimes(1)
  })
})
