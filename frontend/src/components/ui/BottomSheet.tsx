import { useEffect, useRef, ReactNode } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  children: ReactNode
}

export default function BottomSheet({ open, onClose, children }: Props) {
  const startY = useRef<number | null>(null)

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  function handleTouchStart(e: React.TouchEvent) {
    startY.current = e.touches[0].clientY
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (startY.current === null) return
    const delta = e.changedTouches[0].clientY - startY.current
    if (delta > 60) onClose()
    startY.current = null
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 bg-slate-900 rounded-t-2xl max-h-[75vh] overflow-y-auto transition-transform duration-300 ease-out ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2 sticky top-0 bg-slate-900">
          <div className="w-10 h-1 bg-slate-600 rounded-full" />
        </div>

        <div className="px-5 pb-8">{children}</div>
      </div>
    </>
  )
}
