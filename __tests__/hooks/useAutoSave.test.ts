import { renderHook, act } from '@testing-library/react'
import { useAutoSave } from '@/hooks/useAutoSave'

jest.useFakeTimers()

describe('useAutoSave', () => {
  it('calls saveFn after 2s debounce', async () => {
    const saveFn = jest.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutoSave(saveFn, 2000))

    act(() => result.current('content'))
    expect(saveFn).not.toHaveBeenCalled()

    act(() => jest.advanceTimersByTime(2000))
    expect(saveFn).toHaveBeenCalledWith('content')
  })

  it('resets debounce on repeated calls', async () => {
    const saveFn = jest.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutoSave(saveFn, 2000))

    act(() => result.current('first'))
    act(() => jest.advanceTimersByTime(1000))
    act(() => result.current('second'))
    act(() => jest.advanceTimersByTime(2000))

    expect(saveFn).toHaveBeenCalledTimes(1)
    expect(saveFn).toHaveBeenCalledWith('second')
  })
})
