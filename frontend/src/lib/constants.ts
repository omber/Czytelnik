import type { Token } from '../types/book'

export const CLOSING_PUNCT = new Set([',', '.', '!', '?', ':', ';', ')', ']', '}', '»', '…', '—'])
export const OPENING_PUNCT = new Set(['(', '[', '{', '«'])

export const POS_LABELS: Record<string, string> = {
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

export const MORPH_LABELS: Record<string, Record<string, string>> = {
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

export function parseMorphTags(morph: string): string[] {
  if (!morph) return []
  const tags: string[] = []
  for (const part of morph.split('|')) {
    const [key, val] = part.split('=')
    const label = MORPH_LABELS[key]?.[val]
    if (label) tags.push(label)
  }
  return tags
}

export function buildSentenceText(tokens: Pick<Token, 'surface' | 'is_space'>[]): string {
  const visible = tokens.filter(t => !t.is_space)
  let result = ''
  visible.forEach((token, i) => {
    result += token.surface
    const next = visible[i + 1]
    if (next && !CLOSING_PUNCT.has(next.surface) && !OPENING_PUNCT.has(token.surface)) {
      result += ' '
    }
  })
  return result.trim()
}
