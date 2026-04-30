import { Link } from 'react-router-dom'

function NotFoundPage() {
  return (
    <main className="login-screen">
      <section className="page-not-found">
        <p className="section-eyebrow">404</p>
        <h1 className="page-not-found-title">页面不存在</h1>
        <p className="muted-text">你访问的页面不存在，或已经被移除。</p>
        <div className="page-not-found-actions">
          <Link to="/tasks" className="page-not-found-link">
            返回任务工作台
          </Link>
        </div>
      </section>
    </main>
  )
}

export default NotFoundPage
