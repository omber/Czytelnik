import { Fragment } from 'react'
import { Paragraph as ParagraphType, Token } from '../../types/book'
import Sentence from './Sentence'

interface Props {
  paragraph: ParagraphType
  highlightedSentence?: number
  highlightedToken?: number
  onWordTap?: (token: Token) => void
}

export default function Paragraph({
  paragraph,
  highlightedSentence,
  highlightedToken,
  onWordTap,
}: Props) {
  return (
    <div className="mb-5">
      {paragraph.sentences.map((sent, i) => (
        <Fragment key={sent.index}>
          {i > 0 && ' '}
          <Sentence
            sentence={sent}
            highlightedTokenIndex={
              highlightedSentence === sent.index ? highlightedToken : undefined
            }
            onWordTap={onWordTap}
          />
        </Fragment>
      ))}
    </div>
  )
}
