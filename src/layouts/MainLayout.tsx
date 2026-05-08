import {
  Avatar,
  Button,
  Layout,
  Menu,
  Tag,
  Typography,
  type MenuProps,
} from 'antd'
import { Boxes, FolderKanban, LayoutDashboard, Users, type LucideIcon } from 'lucide-react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import type { UserRole } from '../types/models'

const roleLabels: Record<UserRole, string> = {
  admin: '管理员',
  cleaner: '数据清洗员',
  annotator: '数据标注员',
  trainer: '模型训练员',
}

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

function renderMenuIcon(Icon: LucideIcon) {
  return <Icon size={17} strokeWidth={1.9} className="app-menu-icon" aria-hidden="true" />
}

function getMenuItems(isAdmin: boolean): MenuProps['items'] {
  return [
    {
      key: '/tasks',
      label: '任务工作台',
      icon: renderMenuIcon(LayoutDashboard),
    },
    ...(isAdmin
      ? [
          {
            key: '/projects',
            label: '项目管理',
            icon: renderMenuIcon(FolderKanban),
          },
          {
            key: '/models',
            label: '模型列表',
            icon: renderMenuIcon(Boxes),
          },
          {
            key: '/users',
            label: '用户管理',
            icon: renderMenuIcon(Users),
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
            <h2>
              任务流转台
            </h2>
            {/*<Typography.Title level={4} className="brand-title">*/}
            {/*  任务流转台*/}
            {/*</Typography.Title>*/}
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
