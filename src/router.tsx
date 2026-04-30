import { Navigate, createBrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import RequireAdmin from './components/RequireAdmin.tsx'
import RequireAuth from './components/RequireAuth.tsx'
import MainLayout from './layouts/MainLayout.tsx'
import LoginPage from './pages/LoginPage.tsx'
import NotFoundPage from './pages/NotFoundPage.tsx'
import TaskBoardPage from './pages/TaskBoardPage.tsx'
import UserListPage from './pages/UserListPage.tsx'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        index: true,
        element: <Navigate to="/login" replace />,
      },
      {
        path: 'login',
        element: <LoginPage />,
      },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <MainLayout />,
            children: [
              {
                index: true,
                element: <Navigate to="/tasks" replace />,
              },
              {
                path: 'tasks',
                element: <TaskBoardPage />,
              },
              {
                element: <RequireAdmin />,
                children: [
                  {
                    path: 'users',
                    element: <UserListPage />,
                  },
                ],
              },
              {
                path: '*',
                element: <NotFoundPage />,
              },
            ],
          },
        ],
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
])
