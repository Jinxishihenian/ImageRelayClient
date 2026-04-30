import {
  Button,
  Card,
  Col,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
  type TableColumnsType,
} from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { createUser, deleteUser, getUsers, updateUser } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useTableScrollY } from '../hooks/useTableScrollY'
import type { UserRole, UserSummary } from '../types/models'

type CreateUserFormValues = {
  username: string
  password: string
  role: UserRole
}

type EditUserFormValues = {
  username: string
  password?: string
}

const ROLE_OPTIONS: Array<{ value: UserRole; label: string; color: string }> = [
  { value: 'admin', label: '管理员', color: 'geekblue' },
  { value: 'cleaner', label: '数据清洗者', color: 'gold' },
  { value: 'annotator', label: '数据标注者', color: 'cyan' },
  { value: 'trainer', label: '模型训练者', color: 'purple' },
]

const ROLE_LABELS = ROLE_OPTIONS.reduce(
  (result, item) => {
    result[item.value] = item.label
    return result
  },
  {} as Record<UserRole, string>,
)

const ROLE_COLORS = ROLE_OPTIONS.reduce(
  (result, item) => {
    result[item.value] = item.color
    return result
  },
  {} as Record<UserRole, string>,
)

function formatDate(value: string) {
  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
  })
}

function UserListPage() {
  const { session } = useAuth()
  const { containerRef: tableContainerRef, scrollY } = useTableScrollY()
  const [createForm] = Form.useForm<CreateUserFormValues>()
  const [editForm] = Form.useForm<EditUserFormValues>()
  const [users, setUsers] = useState<UserSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserSummary | null>(null)
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null)

  const loadUsers = async () => {
    if (!session || session.user.role !== 'admin') {
      return
    }

    setLoading(true)

    try {
      const items = await getUsers(session.token)
      setUsers(items)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '用户列表加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadUsers()
  }, [session])

  useEffect(() => {
    if (!createOpen) {
      createForm.resetFields()
    }
  }, [createForm, createOpen])

  useEffect(() => {
    if (!editingUser) {
      editForm.resetFields()
      return
    }

    // 编辑用户时明确不回填密码，避免把旧密码误暴露到界面上。
    editForm.setFieldsValue({
      username: editingUser.username,
      password: '',
    })
  }, [editForm, editingUser])

  const columns = useMemo<TableColumnsType<UserSummary>>(
    () => [
      {
        title: '用户名',
        dataIndex: 'username',
        key: 'username',
        render: (value: string, record) => (
          <div className="compact-stack">
            <Typography.Text strong>{value}</Typography.Text>
            <Typography.Text className="muted-text">
              用户 ID：{record.id}
            </Typography.Text>
          </div>
        ),
      },
      {
        title: '角色',
        dataIndex: 'role',
        key: 'role',
        render: (role: UserRole) => (
          <Tag color={ROLE_COLORS[role]}>{ROLE_LABELS[role]}</Tag>
        ),
      },
      {
        title: '创建时间',
        dataIndex: 'createdAt',
        key: 'createdAt',
        render: (value: string) => formatDate(value),
      },
      {
        title: '操作',
        key: 'actions',
        render: (_value, record) => (
          <Space wrap>
            <Button
              onClick={() => {
                setEditingUser(record)
              }}
            >
              编辑
            </Button>
            <Popconfirm
              title="确认删除该用户吗？"
              description="已被任务引用的用户不能删除。"
              okText="删除"
              cancelText="取消"
              okButtonProps={{
                danger: true,
                loading: deletingUserId === record.id,
              }}
              onConfirm={() => {
                void (async () => {
                  if (!session) {
                    return
                  }

                  setDeletingUserId(record.id)

                  try {
                    await deleteUser(record.id, session.token)
                    message.success('用户已删除')
                    await loadUsers()
                  } catch (error) {
                    message.error(error instanceof Error ? error.message : '删除用户失败')
                  } finally {
                    setDeletingUserId(null)
                  }
                })()
              }}
            >
              <Button
                danger
                disabled={session?.user.id === record.id}
                title={session?.user.id === record.id ? '不能删除当前登录账号' : undefined}
              >
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [deletingUserId, session],
  )

  const metrics = useMemo(
    () => [
      {
        label: '用户总数',
        value: users.length,
      },
      {
        label: '管理员',
        value: users.filter((user) => user.role === 'admin').length,
      },
      {
        label: '执行角色用户',
        value: users.filter((user) => user.role !== 'admin').length,
      },
    ],
    [users],
  )

  if (!session) {
    return null
  }

  return (
    <div className="page-stack page-fill page-table-layout">
      <section className="page-header">
        <div>
          <Typography.Text className="section-eyebrow">
            User Management
          </Typography.Text>
          <Typography.Title level={2} className="page-title">
            用户管理
          </Typography.Title>
          <Typography.Paragraph className="muted-paragraph">
            仅管理员可见。支持用户增删改查，创建时分配固定角色，编辑时不允许修改角色。
          </Typography.Paragraph>
        </div>

        <Button
          type="primary"
          size="large"
          onClick={() => {
            setCreateOpen(true)
          }}
        >
          新增用户
        </Button>
      </section>

      <Row gutter={[16, 12]} className="task-metrics-row">
        {metrics.map((metric) => (
          <Col xs={24} md={8} key={metric.label}>
            {/* 与任务工作台统计卡片复用同一套紧凑样式，避免用户页卡片显得过高。 */}
            <Card className="panel-card metric-card task-metric-card">
              <Typography.Text className="muted-text">{metric.label}</Typography.Text>
              <Typography.Title level={3}>{metric.value}</Typography.Title>
            </Card>
          </Col>
        ))}
      </Row>

      <Card className="panel-card page-table-card">
        <div ref={tableContainerRef} className="table-scroll-host">
          <Table<UserSummary>
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={users}
            scroll={scrollY ? { y: scrollY } : undefined}
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            locale={{
              emptyText: '当前暂无用户',
            }}
          />
        </div>
      </Card>

      <Modal
        open={createOpen}
        title="新增用户"
        okText="创建"
        cancelText="取消"
        confirmLoading={submitting}
        onCancel={() => {
          setCreateOpen(false)
        }}
        onOk={() => {
          void createForm.submit()
        }}
        destroyOnHidden
      >
        <Form<CreateUserFormValues>
          form={createForm}
          layout="vertical"
          onFinish={async (values) => {
            if (!session) {
              return
            }

            setSubmitting(true)

            try {
              await createUser(values, session.token)
              message.success('用户创建成功')
              setCreateOpen(false)
              await loadUsers()
            } catch (error) {
              message.error(error instanceof Error ? error.message : '创建用户失败')
            } finally {
              setSubmitting(false)
            }
          }}
        >
          <Form.Item
            label="用户名"
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="例如：admin03" />
          </Form.Item>

          <Form.Item
            label="密码"
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password placeholder="请输入登录密码" />
          </Form.Item>

          <Form.Item
            label="角色"
            name="role"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select
              placeholder="请选择角色"
              options={ROLE_OPTIONS.map((item) => ({
                value: item.value,
                label: item.label,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={Boolean(editingUser)}
        title="编辑用户"
        okText="保存"
        cancelText="取消"
        confirmLoading={submitting}
        onCancel={() => {
          setEditingUser(null)
        }}
        onOk={() => {
          void editForm.submit()
        }}
        destroyOnHidden
      >
        <Form<EditUserFormValues>
          form={editForm}
          layout="vertical"
          onFinish={async (values) => {
            if (!session || !editingUser) {
              return
            }

            setSubmitting(true)

            try {
              await updateUser(
                editingUser.id,
                {
                  username: values.username,
                  // 留空表示不改密码，和后端接口约定保持一致。
                  ...(values.password ? { password: values.password } : {}),
                },
                session.token,
              )
              message.success('用户更新成功')
              setEditingUser(null)
              await loadUsers()
            } catch (error) {
              message.error(error instanceof Error ? error.message : '更新用户失败')
            } finally {
              setSubmitting(false)
            }
          }}
        >
          <Form.Item
            label="用户名"
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="请输入用户名" />
          </Form.Item>

          <Form.Item label="角色">
            <Tag color={editingUser ? ROLE_COLORS[editingUser.role] : 'default'}>
              {editingUser ? ROLE_LABELS[editingUser.role] : '-'}
            </Tag>
            <Typography.Paragraph className="muted-paragraph compact">
              角色在创建后固定，编辑用户时不允许修改。
            </Typography.Paragraph>
          </Form.Item>

          <Form.Item label="新密码" name="password">
            <Input.Password placeholder="留空则保持原密码不变" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default UserListPage
