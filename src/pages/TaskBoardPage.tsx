import { Button, Card, Col, Row, Table, Tag, Typography, message } from 'antd'
import type { TableColumnsType } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { getTasks, getUsers } from '../api/client'
import CreateTaskDrawer from '../components/CreateTaskDrawer'
import TaskDetailDrawer from '../components/TaskDetailDrawer'
import { useAuth } from '../context/AuthContext'
import { useTableScrollY } from '../hooks/useTableScrollY'
import type { TaskStatus, TaskSummary, UserSummary } from '../types/models'

function formatDate(value: string) {
  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
  })
}

// 按任务阶段固定配色，避免把“当前是否可处理”和“任务所处状态”混在一起。
const taskStatusColorMap: Record<TaskStatus, string> = {
  pending_clean: 'gold',
  pending_annotate: 'blue',
  pending_train: 'purple',
  finished: 'green',
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

  const loadTasks = async () => {
    if (!session) {
      return
    }

    setLoading(true)

    try {
      const items = await getTasks(session.token)
      setTasks(items)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '任务列表加载失败')
    } finally {
      setLoading(false)
    }
  }

  const loadUsers = async () => {
    if (!session || session.user.role !== 'admin') {
      return
    }

    try {
      const items = await getUsers(session.token)
      setUsers(items)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '用户列表加载失败')
    }
  }

  useEffect(() => {
    void loadTasks()
    void loadUsers()
  }, [session])

  const columns = useMemo<TableColumnsType<TaskSummary>>(
    () => [
      {
        title: '任务',
        dataIndex: 'title',
        key: 'title',
        render: (_value, record) => (
          <div>
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
          <Tag color={taskStatusColorMap[record.status]}>
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
    ],
    [],
  )

  const metrics = useMemo(
    () => [
      {
        label: '总任务数',
        value: tasks.length,
      },
      {
        label: '待我处理',
        value: tasks.filter((task) => task.canHandle).length,
      },
      {
        label: '已完成',
        value: tasks.filter((task) => task.status === 'finished').length,
      },
    ],
    [tasks],
  )

  if (!session) {
    return null
  }

  return (
    <div className="page-stack page-fill page-table-layout">
      <section className="page-header">
        <div>
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
          <Button
            type="primary"
            size="large"
            onClick={() => {
              setCreateOpen(true)
            }}
          >
            创建任务
          </Button>
        ) : null}
      </section>

      <Row gutter={[16, 12]} className="task-metrics-row">
        {metrics.map((metric) => (
          <Col xs={24} md={8} key={metric.label}>
            <Card className="panel-card metric-card task-metric-card">
              <Typography.Text className="muted-text">{metric.label}</Typography.Text>
              <Typography.Title level={3}>{metric.value}</Typography.Title>
            </Card>
          </Col>
        ))}
      </Row>

      <Card className="panel-card page-table-card">
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
          void loadTasks()
        }}
      />

      <CreateTaskDrawer
        open={createOpen}
        users={users}
        onClose={() => {
          setCreateOpen(false)
        }}
        onCreated={() => {
          void loadTasks()
        }}
      />
    </div>
  )
}

export default TaskBoardPage
