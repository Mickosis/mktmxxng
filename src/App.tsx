import { HashRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { AuthProvider, useAuth } from './auth'
import { Shell, Slip } from './components/Shell'
import { CafesProvider } from './data/cafes'
import { PENDING_INVITE_KEY } from './data/invites'
import { ProfilesProvider } from './data/profiles'
import { storage } from './storage'
import { CafeForm } from './pages/CafeForm'
import { CafePage } from './pages/CafePage'
import { JoinPage } from './pages/JoinPage'
import { ListPage } from './pages/ListPage'
import { MembersPage } from './pages/MembersPage'
import { PeoplePage, PersonPage } from './pages/PeoplePage'
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

// After an email-link sign-in lands on the home page, send the person back to their invite.
function ResumeInvite() {
  const { user, isMember } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    const token = storage.get(PENDING_INVITE_KEY)
    if (!token || !user) return
    if (isMember) storage.remove(PENDING_INVITE_KEY)
    else if (!pathname.startsWith('/join/')) navigate(`/join/${token}`, { replace: true })
  }, [user, isMember, pathname, navigate])
  return null
}

export default function App() {
  return (
    <AuthProvider>
      <CafesProvider>
        <ProfilesProvider>
          <HashRouter>
            <ScrollTop />
            <ResumeInvite />
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
                <Route path="/people" element={<PeoplePage />} />
                <Route path="/people/:uid" element={<PersonPage />} />
                <Route path="/signin" element={<SignInPage />} />
                <Route path="/join/:token" element={<JoinPage />} />
                <Route path="*" element={<Slip><p>Nothing printed at this address.</p></Slip>} />
              </Routes>
            </Shell>
          </HashRouter>
        </ProfilesProvider>
      </CafesProvider>
    </AuthProvider>
  )
}
