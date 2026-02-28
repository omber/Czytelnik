import { useState } from 'react'
import { useUser } from '../../context/UserContext'

export default function ProfileSelector() {
  const { users, createUser, setCurrentUser } = useUser()
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = newName.trim()
    if (!trimmed) {
      setError('Введите имя')
      return
    }
    if (!createUser(trimmed)) {
      setError('Это имя уже занято')
      return
    }
    setCurrentUser(trimmed)
    setNewName('')
    setError('')
  }

  return (
    <div className="flex flex-col gap-4">
      {users.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-slate-400 mb-1">Выберите читателя:</p>
          {users.map(u => (
            <button
              key={u}
              onClick={() => setCurrentUser(u)}
              className="w-full py-3 px-4 rounded-xl bg-slate-800 text-white text-left font-medium hover:bg-slate-700 active:scale-[0.98] transition-all"
            >
              {u}
            </button>
          ))}
          <div className="border-t border-slate-700 my-2" />
        </div>
      )}

      <form onSubmit={handleCreate} className="flex flex-col gap-2">
        <p className="text-sm text-slate-400 mb-1">
          {users.length === 0 ? 'Создайте профиль:' : 'Новый читатель:'}
        </p>
        <input
          type="text"
          value={newName}
          onChange={e => {
            setNewName(e.target.value)
            setError('')
          }}
          placeholder="Ваше имя"
          className="w-full py-3 px-4 rounded-xl bg-slate-800 text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          maxLength={30}
          autoFocus={users.length === 0}
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-500 active:scale-[0.98] transition-all"
        >
          Создать профиль
        </button>
      </form>
    </div>
  )
}
