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

    act(() => result.current.trigger('content'))
    expect(saveFn).not.toHaveBeenCalled()

    act(() => jest.advanceTimersByTime(2000))
    expect(saveFn).toHaveBeenCalledWith('content')
  })

  it('flush() cancels the pending timer', async () => {
    const saveFn = jest.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutoSave(saveFn, 2000))

    act(() => {
      result.current.trigger('content')
      result.current.flush()
      jest.advanceTimersByTime(2000)
    })

    // saveFn called exactly once (by flush), not again by the timer
    expect(saveFn).toHaveBeenCalledTimes(1)
  })

  it('flush() is a no-op when no timer is pending', () => {
    const saveFn = jest.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutoSave(saveFn, 2000))

    act(() => result.current.flush())
    expect(saveFn).not.toHaveBeenCalled()
  })

  it('resets debounce on repeated calls', async () => {
    const saveFn = jest.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutoSave(saveFn, 2000))

    act(() => result.current.trigger('first'))
    act(() => jest.advanceTimersByTime(1000))
    act(() => result.current.trigger('second'))
    act(() => jest.advanceTimersByTime(2000))

    expect(saveFn).toHaveBeenCalledTimes(1)
    expect(saveFn).toHaveBeenCalledWith('second')
  })

  it('flush() immediately calls saveFn with the latest content', async () => {
    const saveFn = jest.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutoSave(saveFn, 2000))

    act(() => result.current.trigger('pending content'))
    expect(saveFn).not.toHaveBeenCalled()

    act(() => result.current.flush())
    expect(saveFn).toHaveBeenCalledWith('pending content')
  })
})
