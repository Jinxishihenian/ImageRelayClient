import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

function RequireAdmin() {
  const { session } = useAuth()
  const location = useLocation()

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (session.user.role !== 'admin') {
    return <Navigate to="/tasks" replace />
  }

  return <Outlet />
}

export default RequireAdmin
