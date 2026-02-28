import { Token } from '../../types/book'
import BottomSheet from '../ui/BottomSheet'
import { useDictionary } from '../../hooks/useDictionary'

const POS_LABELS: Record<string, string> = {
  NOUN: 'сущ.',
  VERB: 'гл.',
  ADJ: 'прил.',
  ADV: 'нареч.',
  PROPN: 'имя собств.',
  ADP: 'предл.',
  CCONJ: 'союз',
  SCONJ: 'союз',
  NUM: 'числ.',
  PRON: 'мест.',
  DET: 'мест.',
  AUX: 'вспом. гл.',
  PART: 'частица',
  INTJ: 'межд.',
  PUNCT: 'пунктуация',
  X: '',
}

const MORPH_LABELS: Record<string, Record<string, string>> = {
  Case: {
    Nom: 'им.', Gen: 'род.', Dat: 'дат.',
    Acc: 'вин.', Ins: 'тв.', Loc: 'пр.', Voc: 'зват.',
  },
  Number: { Sing: 'ед. ч.', Plur: 'мн. ч.' },
  Gender: { Masc: 'муж.', Fem: 'жен.', Neut: 'ср.' },
  Tense: { Past: 'прош.', Pres: 'наст.', Fut: 'буд.' },
  Aspect: { Perf: 'сов.', Imp: 'несов.' },
  Degree: { Pos: 'полож.', Comp: 'сравн.', Sup: 'превосх.' },
  Mood: { Ind: 'изъяв.', Imp: 'повел.', Cnd: 'условн.' },
  Person: { '1': '1 л.', '2': '2 л.', '3': '3 л.' },
  VerbForm: { Inf: 'инф.', Fin: 'личн.', Part: 'прич.', Conv: 'дееприч.' },
}

function parseMorphTags(morph: string): string[] {
  if (!morph) return []
  const tags: string[] = []
  for (const part of morph.split('|')) {
    const [key, val] = part.split('=')
    const label = MORPH_LABELS[key]?.[val]
    if (label) tags.push(label)
  }
  return tags
}

interface Props {
  token: Token | null
  open: boolean
  onClose: () => void
}

export default function WordBottomSheet({ token, open, onClose }: Props) {
  const { lookup } = useDictionary()

  if (!token) return null

  const posLabel = POS_LABELS[token.pos] ?? token.pos
  const morphTags = parseMorphTags(token.morph)
  const isDifferentForm = token.surface.toLowerCase() !== token.lemma.toLowerCase()
  const ruTranslation = lookup(token.lemma)

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

        {/* Actions — stubs for Phase 4 */}
        <div className="pt-2 border-t border-slate-800">
          <button className="w-full py-3 rounded-xl bg-blue-600/20 text-blue-400 text-sm font-medium hover:bg-blue-600/30 active:scale-[0.98] transition-all">
            + Добавить в словарь
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
