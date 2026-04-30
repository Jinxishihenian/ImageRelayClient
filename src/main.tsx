import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConfigProvider } from 'antd'
import { RouterProvider } from 'react-router-dom'
import 'antd/dist/reset.css'
import './index.css'
import { AuthProvider } from './context/AuthContext.tsx'
import { router } from './router.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#27445d',
          colorInfo: '#27445d',
          colorSuccess: '#2e7d61',
          colorWarning: '#b87423',
          colorError: '#bb4d3e',
          colorText: '#24313d',
          colorTextHeading: '#102030',
          colorTextSecondary: '#607283',
          colorBorder: '#d6dee6',
          colorBorderSecondary: '#e8edf2',
          colorBgBase: '#f4f0e8',
          colorBgContainer: '#fffdfa',
          colorBgElevated: '#fffdfa',
          borderRadius: 14,
          boxShadow: '0 12px 32px rgba(16, 32, 48, 0.06)',
          boxShadowSecondary: '0 6px 20px rgba(16, 32, 48, 0.08)',
        },
      }}
    >
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ConfigProvider>
  </StrictMode>,
)
