import {
  Avatar,
  Button,
  Layout,
  Menu,
  Tag,
  Typography,
  type MenuProps,
} from 'antd'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import type { UserRole } from '../types/models'

const roleLabels = {
  admin: '管理员',
  cleaner: '数据清洗者',
  annotator: '数据标注者',
  trainer: '模型训练者',
} as const

const roleTagColors: Record<UserRole, string> = {
  admin: '#FFF7E8',
  cleaner: '#E6F4FF',
  annotator: '#F3E8FF',
  trainer: '#FFF1F0',
}

const roleTagTextColors: Record<UserRole, string> = {
  admin: '#FAAD14',
  cleaner: '#1677FF',
  annotator: '#722ED1',
  trainer: '#F53F3F',
}

function getMenuItems(isAdmin: boolean): MenuProps['items'] {
  return [
    {
      key: '/tasks',
      label: '任务工作台',
    },
    ...(isAdmin
      ? [
          {
            key: '/users',
            label: '用户管理',
          },
        ]
      : []),
  ]
}

function getSelectedMenuKeys(pathname: string, items: MenuProps['items']) {
  const selectedItem = items?.find((item) => {
    if (!item || typeof item !== 'object' || !('key' in item)) {
      return false
    }

    const key = String(item.key)

    return pathname === key || pathname.startsWith(`${key}/`)
  })

  return selectedItem && 'key' in selectedItem ? [String(selectedItem.key)] : []
}

function MainLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { logout, session } = useAuth()

  if (!session) {
    return null
  }

  const menuItems = getMenuItems(session.user.role === 'admin')
  const userInitial = session.user.username.slice(0, 1).toUpperCase()

  return (
    <Layout className="app-shell">
      <Layout.Sider
        breakpoint="lg"
        collapsedWidth="0"
        width={248}
        theme="light"
        className="app-sider"
      >
        <div className="brand-block">
          <span className="brand-mark">IR</span>
          <div className="brand-copy">
            <Typography.Text className="section-eyebrow">
              Image Relay
            </Typography.Text>
            <Typography.Title level={4} className="brand-title">
              任务流转台
            </Typography.Title>
          </div>
        </div>

        <Menu
          mode="inline"
          selectedKeys={getSelectedMenuKeys(location.pathname, menuItems)}
          items={menuItems}
          className="app-menu"
          onClick={({ key }) => {
            navigate(String(key))
          }}
        />
      </Layout.Sider>

      <Layout className="app-main">
        <Layout.Header className="app-header">
          <div className="header-copy">
            <Typography.Title level={4} className="header-title">
              资源中转管理平台
            </Typography.Title>
          </div>

          <div className="header-actions">
            <div className="user-panel">
              <Avatar size={44} className="user-avatar">
                {userInitial}
              </Avatar>

              <div className="user-meta">
                <div className="user-meta-top">
                  <Typography.Text strong className="user-name">
                    {session.user.username}
                  </Typography.Text>
                  <Tag
                    bordered={false}
                    color={roleTagColors[session.user.role]}
                    className="user-role-tag"
                    style={{ color: roleTagTextColors[session.user.role] }}
                  >
                    {roleLabels[session.user.role]}
                  </Tag>
                </div>

              </div>

              <Button onClick={logout} className="logout-button">
                退出登录
              </Button>
            </div>
          </div>
        </Layout.Header>

        <Layout.Content className="app-content">
          <div className="content-wrap">
            <Outlet />
          </div>
        </Layout.Content>
      </Layout>
    </Layout>
  )
}

export default MainLayout
