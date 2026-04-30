import { Button, Card, Col, Row, Table, Tag, Typography, message } from 'antd'
import type { TableColumnsType } from 'antd'
import { useCallback, useEffect, useState, useTransition } from 'react'
import { getTasks, getUsers } from '../api/client'
import CreateTaskDrawer from '../components/CreateTaskDrawer'
import TaskDetailDrawer from '../components/TaskDetailDrawer'
import { useAuth } from '../context/useAuth'
import { useTableScrollY } from '../hooks/useTableScrollY'
import type { TaskStatus, TaskSummary, UserSummary } from '../types/models'

function formatDate(value: string) {
  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
  })
}

// 按任务阶段固定配色，避免把“当前是否可处理”和“任务所处状态”混在一起。
const taskStatusTagStyleMap: Record<
  TaskStatus,
  { background: string; color: string }
> = {
  pending_clean: {
    background: '#FFF7E8',
    color: '#FAAD14',
  },
  pending_annotate: {
    background: '#E6F4FF',
    color: '#1677FF',
  },
  pending_train: {
    background: '#F3E8FF',
    color: '#722ED1',
  },
  finished: {
    background: '#E6F4FF',
    color: '#1677FF',
  },
}

function TaskBoardPage() {
  const { session } = useAuth()
  const { containerRef: tableContainerRef, scrollY } = useTableScrollY()
  const [tasks, setTasks] = useState<TaskSummary[]>([])
  const [users, setUsers] = useState<UserSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [, startTransition] = useTransition()

  const loadTasks = useCallback(async (options?: { silent?: boolean }) => {
    if (!session) {
      return
    }

    if (!options?.silent) {
      setLoading(true)
    }

    try {
      const items = await getTasks(session.token)
      startTransition(() => {
        setTasks(items)
      })
    } catch (error) {
      message.error(error instanceof Error ? error.message : '任务列表加载失败')
    } finally {
      if (!options?.silent) {
        setLoading(false)
      }
    }
  }, [session, startTransition])

  const loadUsers = useCallback(async () => {
    if (!session || session.user.role !== 'admin') {
      return
    }

    try {
      const items = await getUsers(session.token)
      startTransition(() => {
        setUsers(items)
      })
    } catch (error) {
      message.error(error instanceof Error ? error.message : '用户列表加载失败')
    }
  }, [session, startTransition])

  useEffect(() => {
    queueMicrotask(() => {
      void loadTasks()
      void loadUsers()
    })
  }, [loadTasks, loadUsers])

  const columns: TableColumnsType<TaskSummary> = [
    {
      title: '任务',
      dataIndex: 'title',
      key: 'title',
      render: (_value, record) => (
        <div className="data-cell-title">
          <Typography.Text strong>{record.title}</Typography.Text>
          <Typography.Paragraph className="muted-paragraph compact">
            {record.description || '暂无描述'}
          </Typography.Paragraph>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'statusLabel',
      key: 'statusLabel',
      render: (_value, record) => (
        <Tag
          bordered={false}
          className="status-tag"
          color={taskStatusTagStyleMap[record.status].background}
          style={{ color: taskStatusTagStyleMap[record.status].color }}
        >
          {record.statusLabel}
        </Tag>
      ),
    },
    {
      title: '清洗负责人',
      key: 'cleaner',
      width: 140,
      render: (_value, record) => record.assignees.cleaner.username,
    },
    {
      title: '标注负责人',
      key: 'annotator',
      width: 140,
      render: (_value, record) => record.assignees.annotator.username,
    },
    {
      title: '训练负责人',
      key: 'trainer',
      width: 140,
      render: (_value, record) => record.assignees.trainer.username,
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
        <Button
          type={record.canHandle ? 'primary' : 'default'}
          onClick={() => {
            setSelectedTaskId(record.id)
            setDetailOpen(true)
          }}
        >
          {record.canHandle ? '进入处理' : '查看详情'}
        </Button>
      ),
    },
  ]

  const metrics = [
    {
      label: '总任务数',
      value: tasks.length,
      caption: '当前系统中已创建的全部任务',
    },
    {
      label: '待我处理',
      value: tasks.filter((task) => task.canHandle).length,
      caption: '按你的角色进入当前可提交阶段',
    },
    {
      label: '已完成',
      value: tasks.filter((task) => task.status === 'finished').length,
      caption: '所有阶段均已完成交接的任务',
    },
  ]

  if (!session) {
    return null
  }

  return (
    <div className="page-stack page-fill page-table-layout">
      <section className="page-header page-header-surface">
        <div className="page-header-copy">
          <Typography.Text className="section-eyebrow">
            Task Workspace
          </Typography.Text>
          <Typography.Title level={2} className="page-title">
            任务工作台
          </Typography.Title>
          <Typography.Paragraph className="muted-paragraph">
            {session.user.role === 'admin'
              ? '创建任务、分配执行人，并查看整个任务链路的文件与备注。'
              : '查看分配给你的任务，下载当前所需文件并按固定阶段提交结果。'}
          </Typography.Paragraph>
        </div>

        {session.user.role === 'admin' ? (
          <div className="page-actions">
            <Button
              type="primary"
              size="large"
              onClick={() => {
                setCreateOpen(true)
              }}
            >
              创建任务
            </Button>
          </div>
        ) : null}
      </section>

      <Row gutter={[16, 12]} className="task-metrics-row">
        {metrics.map((metric) => (
          <Col xs={24} md={8} key={metric.label}>
            <Card className="panel-card metric-card task-metric-card">
              <Typography.Text className="muted-text">{metric.label}</Typography.Text>
              <Typography.Title level={3}>{metric.value}</Typography.Title>
              <Typography.Text className="metric-caption">
                {metric.caption}
              </Typography.Text>
            </Card>
          </Col>
        ))}
      </Row>

      <Card className="panel-card page-table-card">
        <div className="table-card-toolbar">
          <div className="toolbar-copy">
            <Typography.Title level={5}>任务列表</Typography.Title>
            <Typography.Text className="muted-text">
              按固定阶段展示任务流转状态、负责人和可执行操作。
            </Typography.Text>
          </div>
        </div>
        <div ref={tableContainerRef} className="table-scroll-host">
          <Table<TaskSummary>
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={tasks}
            scroll={scrollY ? { y: scrollY } : undefined}
            pagination={{ pageSize: 8, hideOnSinglePage: true }}
            locale={{
              emptyText: '当前暂无任务',
            }}
          />
        </div>
      </Card>

      <TaskDetailDrawer
        taskId={selectedTaskId}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false)
          setSelectedTaskId(null)
        }}
        onTaskChanged={() => {
          void loadTasks({ silent: true })
        }}
      />

      <CreateTaskDrawer
        open={createOpen}
        users={users}
        onClose={() => {
          setCreateOpen(false)
        }}
        onCreated={() => {
          void loadTasks({ silent: true })
        }}
      />
    </div>
  )
}

export default TaskBoardPage
