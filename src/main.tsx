import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConfigProvider } from 'antd'
import { RouterProvider } from 'react-router-dom'
import 'antd/dist/reset.css'
import 'animate.css'
import './index.css'
import { AuthProvider } from './context/AuthContext.tsx'
import { router } from './router.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1677FF',
          colorInfo: '#1677FF',
          // 成功态不再复用主蓝，避免“完成/通过”和“主操作/高亮”语义混淆。
          colorSuccess: '#52C41A',
          colorWarning: '#FAAD14',
          colorError: '#F53F3F',
          colorText: '#1F2329',
          colorTextHeading: '#1F2329',
          colorTextSecondary: '#4E5969',
          colorTextTertiary: '#86909C',
          colorTextQuaternary: '#C9CDD4',
          colorBorder: '#E5E6EB',
          colorBorderSecondary: '#F0F0F0',
          colorBgBase: '#F5F7FA',
          colorBgContainer: '#FFFFFF',
          colorBgElevated: '#FFFFFF',
          colorFillSecondary: '#FAFAFA',
          borderRadius: 6,
          borderRadiusLG: 8,
          fontFamily: '"PingFang SC", Helvetica, Arial, sans-serif',
          fontSize: 14,
          controlHeight: 32,
          boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
          boxShadowSecondary: '0 4px 12px rgba(0,0,0,0.1)',
        },
        components: {
          Layout: {
            headerBg: 'transparent',
            siderBg: '#FFFFFF',
            bodyBg: '#F5F7FA',
          },
          Button: {
            borderRadius: 6,
            controlHeight: 32,
            controlHeightLG: 40,
            primaryShadow: 'none',
            defaultShadow: 'none',
          },
          Input: {
            controlHeight: 32,
            activeBorderColor: '#1677FF',
            hoverBorderColor: '#4096FF',
          },
          Card: {
            borderRadiusLG: 8,
          },
          Table: {
            headerBg: '#FAFAFA',
            headerColor: '#4E5969',
            borderColor: '#F0F0F0',
            rowHoverBg: '#E6F4FF',
          },
          Drawer: {
            footerPaddingBlock: 16,
            footerPaddingInline: 24,
          },
          Modal: {
            borderRadiusLG: 8,
          },
        },
      }}
    >
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ConfigProvider>
  </StrictMode>,
)
