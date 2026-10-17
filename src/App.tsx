import { HashRouter, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { AuthProvider } from './auth'
import { Shell, Slip } from './components/Shell'
import { CafesProvider } from './data/cafes'
import { CafeForm } from './pages/CafeForm'
import { CafePage } from './pages/CafePage'
import { ListPage } from './pages/ListPage'
import { MembersPage } from './pages/MembersPage'
import { RollPage } from './pages/RollPage'
import { SignInPage } from './pages/SignInPage'
import { VisitForm } from './pages/VisitForm'

function ScrollTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  return (
    <AuthProvider>
      <CafesProvider>
        <HashRouter>
          <ScrollTop />
          <Shell>
            <Routes>
              <Route path="/" element={<RollPage />} />
              <Route path="/list" element={<ListPage />} />
              <Route path="/add" element={<CafeForm />} />
              <Route path="/cafe/:id" element={<CafePage />} />
              <Route path="/cafe/:id/edit" element={<CafeForm />} />
              <Route path="/cafe/:id/visit" element={<VisitForm />} />
              <Route path="/cafe/:id/visit/:visitId" element={<VisitForm />} />
              <Route path="/members" element={<MembersPage />} />
              <Route path="/signin" element={<SignInPage />} />
              <Route path="*" element={<Slip><p>Nothing printed at this address.</p></Slip>} />
            </Routes>
          </Shell>
        </HashRouter>
      </CafesProvider>
    </AuthProvider>
  )
}
