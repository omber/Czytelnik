import { BookWithProgress } from '../../hooks/useBooks'
import BookCard from './BookCard'

interface Props {
  books: BookWithProgress[]
}

export default function LibraryGrid({ books }: Props) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
      {books.map(b => (
        <BookCard key={b.id} book={b} />
      ))}
    </div>
  )
}
