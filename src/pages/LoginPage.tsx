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
    ['SYSTEM_ADMIN', 'PROJECT_ADMIN', 'DELIVERY_MEMBER'].includes(user.role),
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

  async function quickLogin(nextIdentifier: string, nextPassword: string) {
    setIdentifier(nextIdentifier)
    setPassword(nextPassword)
    setIsSubmitting(true)
    setError('')

    const result = await login(nextIdentifier, nextPassword)

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
        <span className="eyebrow">Internal Portfolio Workspace</span>
        <h1>Hệ thống quản lý các dự án nội bộ của công ty</h1>
        <p>
          Bộ khung frontend React + TypeScript dùng JSON làm nguồn fake API, mô
          phỏng đủ các vai trò PM, thành viên triển khai và admin hệ thống.
        </p>

        <div className="feature-grid">
          <article className="feature-card">
            <ShieldCheck size={20} />
            <div>
              <strong>Role-based flow</strong>
              <p>Luồng riêng cho PM, thành viên triển khai và admin hệ thống.</p>
            </div>
          </article>
          <article className="feature-card">
            <BriefcaseBusiness size={20} />
            <div>
              <strong>Project workspace</strong>
              <p>Tạo dự án, cập nhật hồ sơ, phân bổ giờ công và theo dõi rủi ro.</p>
            </div>
          </article>
          <article className="feature-card">
            <Users size={20} />
            <div>
              <strong>Team execution</strong>
              <p>Khai báo công việc con, worklog thực tế và raise chậm tiến độ.</p>
            </div>
          </article>
        </div>
      </section>

      <section className="login-card">
        <div>
          <span className="eyebrow">Đăng nhập demo</span>
          <h2>Truy cập hệ thống</h2>
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
              onClick={() => void quickLogin(user.username, user.password)}
            >
              <strong>{user.name}</strong>
              <span>{getRoleLabel(user.role)}</span>
              <small>
                {user.username} / {user.password}
              </small>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
