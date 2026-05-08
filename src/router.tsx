import { Navigate, createBrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import RequireAdmin from './components/RequireAdmin.tsx'
import RequireAuth from './components/RequireAuth.tsx'
import MainLayout from './layouts/MainLayout.tsx'
import FileListPage from './pages/FileListPage.tsx'
import LoginPage from './pages/LoginPage.tsx'
import ModelListPage from './pages/ModelListPage.tsx'
import NotFoundPage from './pages/NotFoundPage.tsx'
import ProjectDetailPage from './pages/ProjectDetailPage.tsx'
import ProjectManagementPage from './pages/ProjectManagementPage.tsx'
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
                    path: 'datasets',
                    element: <FileListPage />,
                  },
                  {
                    path: 'projects',
                    element: <ProjectManagementPage />,
                  },
                  {
                    path: 'projects/:projectId',
                    element: <ProjectDetailPage />,
                  },
                  {
                    path: 'models',
                    element: <ModelListPage />,
                  },
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
