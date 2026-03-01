export interface Token {
  surface: string
  lemma: string
  pos: string
  morph: string
  is_punct: boolean
  is_space: boolean
}

export interface Sentence {
  index: number
  tokens: Token[]
  translation: string
  has_audio: boolean
}

export interface Paragraph {
  index: number
  sentences: Sentence[]
}

export interface ChapterData {
  number: number
  title: string
  paragraphs: Paragraph[]
}

export interface ChapterMeta {
  number: number
  title: string
}

export interface BookMeta {
  id: string
  title: string
  author: string
  chapterCount: number
  wordCount: number
  cover?: string
}
