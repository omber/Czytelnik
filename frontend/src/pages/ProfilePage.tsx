import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../context/UserContext'
import ProfileSelector from '../components/profile/ProfileSelector'

export default function ProfilePage() {
  const { currentUser } = useUser()
  const navigate = useNavigate()

  useEffect(() => {
    if (currentUser) navigate('/library', { replace: true })
  }, [currentUser, navigate])

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-white mb-2">Czytelnik</h1>
          <p className="text-slate-400 text-sm">Читайте по-польски</p>
        </div>
        <ProfileSelector />
      </div>
    </div>
  )
}
