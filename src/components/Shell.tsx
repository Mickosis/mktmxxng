import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../auth'

export function Shell({ children }: { children: ReactNode }) {
  const { user, isMember, isAdmin } = useAuth()
  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="wordmark" aria-label="MKTMXXNG home">MKTMXXNG</Link>
        <nav className="topbar-links" aria-label="Account">
          {isAdmin && <NavLink to="/members">Members</NavLink>}
          <NavLink to="/signin">{user ? 'Account' : 'Sign in'}</NavLink>
        </nav>
      </header>
      <main className="main">{children}</main>
      <nav className="bottom-nav" aria-label="Main">
        <NavLink to="/" end>Roll</NavLink>
        <NavLink to="/list">List</NavLink>
        {isMember && <NavLink to="/add">Add cafe</NavLink>}
      </nav>
    </div>
  )
}

export function Slip({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`slip ${className}`}>{children}</section>
}
