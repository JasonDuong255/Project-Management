import { BriefcaseBusiness, LogIn, ShieldCheck, Users } from 'lucide-react'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { useAppData } from '../context/AppContext'
import { getRoleLabel } from '../lib/formatters'

export function LoginPage() {
  const { login, users } = useAppData()
  const navigate = useNavigate()
  const location = useLocation()
  const [identifier, setIdentifier] = useState('pm.an')
  const [password, setPassword] = useState('123456')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const from =
    typeof location.state === 'object' &&
    location.state &&
    'from' in location.state &&
    typeof location.state.from === 'string'
      ? location.state.from
      : '/dashboard'

  const demoUsers = users.filter((user) =>
    ['SYSTEM_ADMIN', 'PROJECT_ADMIN', 'DELIVERY_MEMBER', 'PMO', 'PM', 'ADMIN_HC'].includes(user.role),
  )

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError('')

    const result = await login(identifier, password)

    if (!result.ok) {
      setError(result.message ?? 'Đăng nhập thất bại')
      setIsSubmitting(false)
      return
    }

    navigate(from, { replace: true })
  }

  // All demo accounts share password '123456' (seed-managed in Supabase Auth).
  const DEMO_PASSWORD = '123456'

  async function quickLogin(nextIdentifier: string) {
    setIdentifier(nextIdentifier)
    setPassword(DEMO_PASSWORD)
    setIsSubmitting(true)
    setError('')

    const result = await login(nextIdentifier, DEMO_PASSWORD)

    if (!result.ok) {
      setError(result.message ?? 'Đăng nhập thất bại')
      setIsSubmitting(false)
      return
    }

    navigate('/dashboard', { replace: true })
  }

  return (
    <div className="login-page">
      <section className="login-hero">
        <h1>Hệ thống quản lý dự án</h1>
        <p>
          Điều phối dự án, nhân sự và tiến độ trên một nền tảng duy nhất.
        </p>

        <div className="feature-grid">
          <article className="feature-card">
            <ShieldCheck size={20} />
            <div>
              <strong>Phân quyền theo vai trò</strong>
              <p>PM, thành viên và admin hệ thống.</p>
            </div>
          </article>
          <article className="feature-card">
            <BriefcaseBusiness size={20} />
            <div>
              <strong>Quản trị dự án</strong>
              <p>Hồ sơ, giờ công và rủi ro.</p>
            </div>
          </article>
          <article className="feature-card">
            <Users size={20} />
            <div>
              <strong>Triển khai</strong>
              <p>Task, worklog và raise tiến độ.</p>
            </div>
          </article>
        </div>
      </section>

      <section className="login-card">
        <div>
          <h2>Đăng nhập</h2>
        </div>

        <form className="form-stack" onSubmit={handleSubmit}>
          <label>
            <span>Tài khoản</span>
            <input
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="pm.an hoặc email"
            />
          </label>

          <label>
            <span>Mật khẩu</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="123456"
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}

          <button type="submit" className="primary-button" disabled={isSubmitting}>
            <LogIn size={16} />
            {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        <div className="demo-account-list">
          {demoUsers.map((user) => (
            <button
              key={user.id}
              type="button"
              className="demo-account"
              onClick={() => void quickLogin(user.username)}
            >
              <strong>{user.name}</strong>
              <span>{getRoleLabel(user.role)}</span>
              <small>
                {user.username} / {DEMO_PASSWORD}
              </small>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
