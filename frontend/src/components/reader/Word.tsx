import { Token } from '../../types/book'

interface Props {
  token: Token
  isHighlighted?: boolean
  onTap?: (token: Token) => void
}

export default function Word({ token, isHighlighted, onTap }: Props) {
  if (token.is_space) return null

  if (token.is_punct) {
    return <span className="text-slate-300 select-none">{token.surface}</span>
  }

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    onTap?.(token)
  }

  return (
    <span
      onClick={handleClick}
      className={`cursor-pointer rounded px-0.5 -mx-0.5 transition-colors duration-100 ${
        isHighlighted
          ? 'bg-yellow-400/30 text-yellow-200'
          : 'text-white hover:bg-slate-700 active:bg-slate-600'
      }`}
    >
      {token.surface}
    </span>
  )
}
