import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signIn } from '../lib/auth'
import { LogIn, Lock, Mail, AlertCircle } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await signIn(email, password)
    if (error) {
      setError('Credenciales incorrectas. Verifica tu email y contraseña.')
      setLoading(false)
    } else {
      navigate('/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{
      background: 'radial-gradient(ellipse at 60% 40%, #1e3a5f 0%, #0f172a 60%)',
      padding: 20
    }}>
      {/* Background decoration */}
      <div style={{
        position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0
      }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{
            position: 'absolute',
            width: 300 + i * 100, height: 300 + i * 100,
            borderRadius: '50%',
            border: '1px solid rgba(59,130,246,0.06)',
            top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)',
          }} />
        ))}
      </div>

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 420 }}>
        {/* Logo */}
        <div className="text-center mb-8 animate-fade-in-up">
          <div style={{
            width: 72, height: 72, margin: '0 auto 16px',
            background: 'linear-gradient(135deg, var(--brand-600), var(--brand-400))',
            borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32, boxShadow: '0 8px 32px rgba(59,130,246,0.4)'
          }}>🏛️</div>
          <h1 className="text-2xl font-extrabold" style={{ marginBottom: 4 }}>PriorizaZihua</h1>
          <p className="text-muted text-sm">Panel de Administración del Ayuntamiento</p>
        </div>

        {/* Card */}
        <div className="glass animate-fade-in-up" style={{ animationDelay: '0.1s', padding: 32 }}>
          <h2 className="text-lg font-bold mb-6" style={{ textAlign: 'center' }}>Acceso Administrador</h2>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="form-group">
              <label className="form-label" htmlFor="email">
                <Mail size={12} style={{ display: 'inline', marginRight: 6 }} />
                Correo Electrónico
              </label>
              <input
                id="email"
                className="form-input"
                type="email"
                placeholder="admin@zihuatanejo.gob.mx"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">
                <Lock size={12} style={{ display: 'inline', marginRight: 6 }} />
                Contraseña
              </label>
              <input
                id="password"
                className="form-input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="alert alert-error">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <button className="btn btn-primary btn-full btn-lg" type="submit" disabled={loading} style={{ marginTop: 4 }}>
              {loading
                ? <><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Ingresando...</>
                : <><LogIn size={18} /> Ingresar al Dashboard</>
              }
            </button>
          </form>

          <div className="divider" />
          <p className="text-center text-sm text-muted">
            ¿Necesitas reportar una calle?{' '}
            <a href="/report" style={{ color: 'var(--brand-400)' }}>Formulario ciudadano →</a>
          </p>
        </div>
      </div>
    </div>
  )
}
