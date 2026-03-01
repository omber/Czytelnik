import { Token, Sentence } from '../../types/book'
import BottomSheet from '../ui/BottomSheet'
import { useDictionary } from '../../hooks/useDictionary'
import { useVocab } from '../../hooks/useVocab'
import { useUser } from '../../context/UserContext'
import { POS_LABELS, buildSentenceText, parseMorphTags } from '../../lib/constants'

interface Props {
  token: Token | null
  sentence: Sentence | null
  bookId: string
  chapter: number
  open: boolean
  onClose: () => void
}

export default function WordBottomSheet({
  token,
  sentence,
  bookId,
  chapter,
  open,
  onClose,
}: Props) {
  const { lookup } = useDictionary()
  const { currentUser } = useUser()
  const vocab = useVocab(currentUser ?? '')

  if (!token) return null

  const posLabel = POS_LABELS[token.pos] ?? token.pos
  const morphTags = parseMorphTags(token.morph)
  const isDifferentForm = token.surface.toLowerCase() !== token.lemma.toLowerCase()
  const ruTranslation = lookup(token.lemma)
  const inVocab = vocab.isInVocab(token.lemma)

  function handleAddToVocab() {
    if (!sentence) return
    const sentenceText = buildSentenceText(sentence.tokens)
    vocab.add(
      { lemma: token!.lemma, surface: token!.surface, pos: token!.pos },
      ruTranslation,
      {
        bookId,
        chapter,
        sentenceText,
        sentenceTranslation: sentence.translation ?? '',
      },
    )
  }

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="flex flex-col gap-4">
        {/* Lemma + surface form + POS */}
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-3xl font-bold text-white">{token.lemma}</span>
          {isDifferentForm && (
            <span className="text-slate-400 text-base">{token.surface}</span>
          )}
          {posLabel && (
            <span className="ml-auto text-sm text-slate-500 font-medium shrink-0">
              {posLabel}
            </span>
          )}
        </div>

        {/* Russian translation */}
        {ruTranslation && (
          <div className="bg-slate-800/60 rounded-xl px-4 py-3">
            <p className="text-blue-200 text-xl font-medium">{ruTranslation}</p>
          </div>
        )}

        {/* Morphological tags */}
        {morphTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {morphTags.map((tag, i) => (
              <span
                key={i}
                className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded-full border border-slate-700"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Add to vocab button */}
        <div className="pt-2 border-t border-slate-800">
          {inVocab ? (
            <div className="w-full py-3 rounded-xl bg-green-600/15 text-green-400 text-sm font-medium text-center border border-green-900/40">
              ✓ В словаре
            </div>
          ) : (
            <button
              onClick={handleAddToVocab}
              disabled={!sentence}
              className="w-full py-3 rounded-xl bg-blue-600/20 text-blue-400 text-sm font-medium hover:bg-blue-600/30 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              + Добавить в словарь
            </button>
          )}
        </div>
      </div>
    </BottomSheet>
  )
}
