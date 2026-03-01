import { Fragment, useEffect, useRef, useState } from 'react'
import { Sentence as SentenceType, Token } from '../../types/book'
import Word from './Word'
import { CLOSING_PUNCT, OPENING_PUNCT } from '../../lib/constants'

interface Props {
  sentence: SentenceType
  highlightedTokenIndex?: number
  isPlaying?: boolean
  onWordTap?: (token: Token) => void
}

export default function Sentence({
  sentence,
  highlightedTokenIndex,
  isPlaying,
  onWordTap,
}: Props) {
  const [showTranslation, setShowTranslation] = useState(false)
  const spanRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (isPlaying && spanRef.current) {
      spanRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [isPlaying])

  // Filter out space tokens for rendering
  const tokens = sentence.tokens.filter(t => !t.is_space)

  function toggleTranslation(e: React.MouseEvent) {
    e.stopPropagation()
    setShowTranslation(s => !s)
  }

  return (
    <span ref={spanRef} className={`inline ${isPlaying ? 'rounded px-0.5 -mx-0.5 bg-blue-500/15' : ''}`}>
      {tokens.map((token, i) => {
        const nextToken = tokens[i + 1]

        const addTrailingSpace =
          nextToken &&
          !nextToken.is_space &&
          !CLOSING_PUNCT.has(nextToken.surface) &&
          !OPENING_PUNCT.has(token.surface)

        const origIndex = sentence.tokens.indexOf(token)

        return (
          <Fragment key={i}>
            <Word
              token={token}
              isHighlighted={highlightedTokenIndex === origIndex}
              onTap={onWordTap}
            />
            {addTrailingSpace && ' '}
          </Fragment>
        )
      })}

      {/* Sentence translation toggle */}
      {sentence.translation && (
        <button
          onClick={toggleTranslation}
          className={`inline-flex items-center align-middle ml-1 px-1.5 py-0.5 rounded text-xs font-medium transition-colors ${
            showTranslation
              ? 'bg-blue-500/30 text-blue-300'
              : 'bg-slate-700/60 text-slate-500 hover:text-slate-300 hover:bg-slate-700'
          }`}
          aria-label="Показать перевод"
        >
          RU
        </button>
      )}

      {showTranslation && (
        <span className="block mt-1 mb-2 text-sm text-blue-300/90 italic pl-2 border-l-2 border-blue-500/40 leading-relaxed">
          {sentence.translation}
        </span>
      )}
    </span>
  )
}
