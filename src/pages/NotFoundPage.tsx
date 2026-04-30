import { Link } from 'react-router-dom'

function NotFoundPage() {
  return (
    <main className="login-screen">
      <section style={{ textAlign: 'center' }}>
        <p className="section-eyebrow">404</p>
        <h1>页面不存在</h1>
        <p className="muted-text">你访问的页面不存在，或已经被移除。</p>
        <div style={{ marginTop: 20 }}>
          <Link to="/tasks">返回任务工作台</Link>
        </div>
      </section>
    </main>
  )
}

export default NotFoundPage
