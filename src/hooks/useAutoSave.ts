import { useCallback, useEffect, useRef } from 'react'

export function useAutoSave(
  saveFn: (content: string) => Promise<void>,
  delay: number = 2000
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const trigger = useCallback(
    (content: string) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        saveFn(content)
      }, delay)
    },
    [saveFn, delay]
  )

  return trigger
}
