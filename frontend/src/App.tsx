import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { UserProvider } from './context/UserContext'
import ProfilePage from './pages/ProfilePage'
import LibraryPage from './pages/LibraryPage'
import ReaderPageRoute from './pages/ReaderPageRoute'

export default function App() {
  return (
    <UserProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<ProfilePage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/read/:bookId/:chapter" element={<ReaderPageRoute />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </UserProvider>
  )
}
