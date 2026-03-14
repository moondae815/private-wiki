import { useCallback, useEffect, useRef } from 'react'

export function useAutoSave(
  saveFn: (content: string) => Promise<void>,
  delay: number = 2000
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingContentRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const trigger = useCallback(
    (content: string) => {
      pendingContentRef.current = content
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        pendingContentRef.current = null
        saveFn(content)
      }, delay)
    },
    [saveFn, delay]
  )

  const flush = useCallback((): Promise<void> => {
    if (timerRef.current === null) return Promise.resolve()
    clearTimeout(timerRef.current)
    timerRef.current = null
    const content = pendingContentRef.current
    pendingContentRef.current = null
    if (content !== null) return saveFn(content)
    return Promise.resolve()
  }, [saveFn])

  return { trigger, flush }
}
