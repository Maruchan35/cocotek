import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { fetchMyProfile } from './lib/userProfiles'
import PublicForm from './pages/PublicForm'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import PresidenteDashboard from './pages/PresidenteDashboard'
import type { Session } from '@supabase/supabase-js'
import type { UserProfile } from './types'
import './index.css'

function App() {
  const [session, setSession]       = useState<Session | null>(null)
  const [profile, setProfile]       = useState<UserProfile | null>(null)
  const [loading, setLoading]       = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        setProfileLoading(true)
        fetchMyProfile(session.user.id).then(p => {
          setProfile(p)
          setProfileLoading(false)
          setLoading(false)
        })
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        setProfileLoading(true)
        fetchMyProfile(session.user.id).then(p => {
          setProfile(p)
          setProfileLoading(false)
        })
      } else {
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading || profileLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div style={{ textAlign: 'center' }}>
        <div className="spinner" style={{ width: 40, height: 40, margin: '0 auto 12px' }} />
        <p style={{ fontSize: 13, color: '#64748b' }}>Cargando sesión...</p>
      </div>
    </div>
  )

  /** Decide qué panel mostrar según el rol */
  const DashboardRouter = () => {
    if (!session) return <Navigate to="/login" replace />
    // Sin perfil asignado → tratamos como admin (cuenta original)
    if (!profile || profile.role === 'admin') return <Dashboard session={session} />
    // Presidente de colonia → su panel exclusivo
    return <PresidenteDashboard session={session} profile={profile} />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"          element={<Navigate to="/report" replace />} />
        <Route path="/report"    element={<PublicForm />} />
        <Route path="/login"     element={session ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="/dashboard" element={<DashboardRouter />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
