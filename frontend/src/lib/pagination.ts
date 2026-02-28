import { Paragraph } from '../types/book'

export const PAGE_SIZE = 5

export function paginate(paragraphs: Paragraph[]): Paragraph[][] {
  const pages: Paragraph[][] = []
  for (let i = 0; i < paragraphs.length; i += PAGE_SIZE) {
    pages.push(paragraphs.slice(i, i + PAGE_SIZE))
  }
  // Always return at least one page
  return pages.length > 0 ? pages : [[]]
}
