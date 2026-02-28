import { Fragment } from 'react'
import { Paragraph as ParagraphType, Sentence as SentenceType, Token } from '../../types/book'
import Sentence from './Sentence'

interface Props {
  paragraph: ParagraphType
  onWordTap?: (token: Token, sentence: SentenceType) => void
  playingSentIdx?: number | null
  playingTokenIdx?: number | null
}

export default function Paragraph({
  paragraph,
  onWordTap,
  playingSentIdx,
  playingTokenIdx,
}: Props) {
  return (
    <div className="mb-5">
      {paragraph.sentences.map((sent, i) => (
        <Fragment key={sent.index}>
          {i > 0 && ' '}
          <Sentence
            sentence={sent}
            highlightedTokenIndex={
              playingSentIdx === sent.index ? (playingTokenIdx ?? undefined) : undefined
            }
            isPlaying={playingSentIdx === sent.index}
            onWordTap={token => onWordTap?.(token, sent)}
          />
        </Fragment>
      ))}
    </div>
  )
}
