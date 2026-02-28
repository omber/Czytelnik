/**
 * TTS playback hook — plays a queue of sentences sequentially.
 *
 * Transport: play / pause / resume / stop / prevSentence / nextSentence
 *
 * Priority per sentence:
 *   1. Pre-generated MP3 + timing.json (sentence.has_audio === true)
 *   2. Web Speech API fallback (pl-PL voice)
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import { Sentence } from '../types/book'

const BASE = import.meta.env.BASE_URL

interface TimingEntry {
  token_index: number
  start_ms: number
  end_ms: number
}

export interface TTSState {
  paraIdx: number
  sentIdx: number
  highlightedTokenIndex: number | null
}

export interface QueueItem {
  paraIdx: number
  sentIdx: number
  sentence: Sentence
}

export function useTTS(bookId: string, chapter: number, speed = 1) {
  const [current, setCurrent] = useState<TTSState | null>(null)
  const [isPaused, setIsPaused] = useState(false)

  const speedRef = useRef(speed)
  useEffect(() => { speedRef.current = speed }, [speed])

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const timingRef = useRef<TimingEntry[]>([])
  const queueRef = useRef<QueueItem[]>([])
  const queuePosRef = useRef(0)
  // Incremented on stop()/play()/skipTo() to invalidate stale callbacks
  const sessionRef = useRef(0)
  // Mirrors isPaused for use inside async callbacks without stale closure
  const isPausedRef = useRef(false)
  // Whether the current sentence is using MP3 (vs Web Speech API)
  const usingMp3Ref = useRef(false)

  // ── Internal helpers ────────────────────────────────────────────────────

  function cancelRaf() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }

  function cancelAudio() {
    cancelRaf()
    if (audioRef.current) {
      audioRef.current.onplay = null
      audioRef.current.onended = null
      audioRef.current.onerror = null
      audioRef.current.pause()
      audioRef.current = null
    }
    if (typeof window !== 'undefined') {
      if (window.speechSynthesis?.speaking || window.speechSynthesis?.paused) {
        window.speechSynthesis.cancel()
      }
    }
  }

  // ── Public controls ─────────────────────────────────────────────────────

  const stop = useCallback(() => {
    sessionRef.current++
    isPausedRef.current = false
    setIsPaused(false)
    queueRef.current = []
    queuePosRef.current = 0
    cancelAudio()
    setCurrent(null)
  }, [])

  const pause = useCallback(() => {
    isPausedRef.current = true
    setIsPaused(true)
    cancelRaf()
    if (usingMp3Ref.current && audioRef.current) {
      audioRef.current.pause()
      // onended won't fire on pause — safe to leave handlers in place
    } else if (typeof window !== 'undefined' && window.speechSynthesis) {
      // speechSynthesis.pause() is unreliable; cancel instead.
      // isPausedRef=true prevents the onerror/onend from advancing the queue.
      window.speechSynthesis.cancel()
    }
  }, [])

  // Stored in a ref so resume() and skipTo() can call it without stale closures
  const playNextRef = useRef<(pos: number, session: number) => void>(() => {})

  const resume = useCallback(() => {
    isPausedRef.current = false
    setIsPaused(false)
    if (usingMp3Ref.current && audioRef.current) {
      // MP3 is still loaded at paused position — just unpause
      audioRef.current.play().catch(() => {})
      rafRef.current = requestAnimationFrame(function tick() {
        if (!audioRef.current) return
        const ms = audioRef.current.currentTime * 1000
        const cur = current // captured; setCurrent reads latest via functional update
        let highlighted: number | null = null
        for (const e of timingRef.current) {
          if (ms >= e.start_ms && ms < e.end_ms) { highlighted = e.token_index; break }
        }
        setCurrent(s => s ? { ...s, highlightedTokenIndex: highlighted } : s)
        rafRef.current = requestAnimationFrame(tick)
      })
    } else {
      // Web Speech was cancelled — replay current sentence from scratch
      playNextRef.current(queuePosRef.current, sessionRef.current)
    }
  }, [current]) // eslint-disable-line react-hooks/exhaustive-deps

  const skipTo = useCallback((pos: number) => {
    if (pos < 0 || pos >= queueRef.current.length) return
    sessionRef.current++
    const session = sessionRef.current
    isPausedRef.current = false
    setIsPaused(false)
    cancelAudio()
    queuePosRef.current = pos
    playNextRef.current(pos, session)
  }, [])

  const prevSentence = useCallback(() => {
    skipTo(queuePosRef.current - 1)
  }, [skipTo])

  const nextSentence = useCallback(() => {
    skipTo(queuePosRef.current + 1)
  }, [skipTo])

  // ── Core playback ───────────────────────────────────────────────────────

  playNextRef.current = async (pos: number, session: number) => {
    if (session !== sessionRef.current) return
    if (pos >= queueRef.current.length) {
      setCurrent(null)
      setIsPaused(false)
      isPausedRef.current = false
      return
    }

    queuePosRef.current = pos
    const { paraIdx, sentIdx, sentence } = queueRef.current[pos]
    setCurrent({ paraIdx, sentIdx, highlightedTokenIndex: null })

    function onDone() {
      // If paused (Speech API was cancelled for pause), don't advance
      if (isPausedRef.current) return
      playNextRef.current(pos + 1, session)
    }

    // ── Web Speech API fallback ────────────────────────────────────────
    function tryWebSpeech() {
      usingMp3Ref.current = false
      if (!window.speechSynthesis) { onDone(); return }
      const text = sentence.tokens
        .filter(t => !t.is_space)
        .map(t => t.surface)
        .join(' ')
        .trim()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'pl-PL'
      utterance.rate = speedRef.current
      const plVoice = window.speechSynthesis.getVoices().find(v => v.lang.startsWith('pl'))
      if (plVoice) utterance.voice = plVoice
      utterance.onend = () => { if (session === sessionRef.current) onDone() }
      utterance.onerror = () => { if (session === sessionRef.current) onDone() }
      window.speechSynthesis.speak(utterance)
    }

    if (!sentence.has_audio) {
      tryWebSpeech()
      return
    }

    // ── MP3 + timing playback ──────────────────────────────────────────
    usingMp3Ref.current = true
    const mp3Url = `${BASE}books/${bookId}/ch-${chapter}/audio/s-${paraIdx}-${sentIdx}.mp3`
    const timingUrl = `${BASE}books/${bookId}/ch-${chapter}/audio/s-${paraIdx}-${sentIdx}.timing.json`

    try {
      const timingRes = await fetch(timingUrl)
      timingRef.current = timingRes.ok ? await timingRes.json() : []

      if (session !== sessionRef.current) return

      const audio = new Audio(mp3Url)
      audio.playbackRate = speedRef.current
      audioRef.current = audio

      function tick() {
        if (!audioRef.current) return
        const ms = audioRef.current.currentTime * 1000
        let highlighted: number | null = null
        for (const e of timingRef.current) {
          if (ms >= e.start_ms && ms < e.end_ms) { highlighted = e.token_index; break }
        }
        setCurrent(s =>
          s?.paraIdx === paraIdx && s.sentIdx === sentIdx
            ? { ...s, highlightedTokenIndex: highlighted }
            : s,
        )
        rafRef.current = requestAnimationFrame(tick)
      }

      audio.onplay = () => { rafRef.current = requestAnimationFrame(tick) }
      audio.onended = () => {
        cancelRaf()
        audioRef.current = null
        if (session === sessionRef.current) onDone()
      }
      audio.onerror = () => {
        audioRef.current = null
        if (session === sessionRef.current) tryWebSpeech()
      }

      await audio.play()
    } catch {
      if (session === sessionRef.current) tryWebSpeech()
    }
  }

  // ── play() — starts fresh from a new queue ──────────────────────────────

  const play = useCallback(
    (items: QueueItem[]) => {
      stop()
      const session = sessionRef.current
      queueRef.current = [...items]
      queuePosRef.current = 0
      playNextRef.current(0, session)
    },
    [stop],
  )

  // Stop on unmount or chapter change
  useEffect(() => () => stop(), [stop])

  return {
    current,
    isPaused,
    isActive: current !== null,       // playing or paused
    isPlaying: current !== null && !isPaused,
    play,
    pause,
    resume,
    stop,
    prevSentence,
    nextSentence,
  }
}
