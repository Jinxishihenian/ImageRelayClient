import { Badge, Button, Card, Col, Input, Popconfirm, Row, Space, Table, Tag, Typography, message } from 'antd'
import type { TableColumnsType, TablePaginationConfig, TableProps } from 'antd'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { deleteTask, getModelIterations, getTasks, getUsers } from '../api/client'
import CreateTaskDrawer from '../components/CreateTaskDrawer'
import TaskDetailDrawer from '../components/TaskDetailDrawer'
import { useAuth } from '../context/useAuth'
import { useTableScrollY } from '../hooks/useTableScrollY'
import type {
  ModelIterationSummary,
  TaskListSummary,
  TaskStatus,
  TaskSummary,
  UserSummary,
} from '../types/models'

const PAGE_SIZE = 10

const EMPTY_TASK_SUMMARY: TaskListSummary = {
  total: 0,
  actionableCount: 0,
  finishedCount: 0,
}

const METRIC_ANIMATION_DURATION = 1000

function formatDate(value: string) {
  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
  })
}

function getTaskSortPriority(record: TaskSummary) {
  // Keep pending items ahead of finished items, but do not change the time order within a group.
  return record.status === 'finished' && record.reviewStatus !== 'pending_admin_review' ? 1 : 0
}

function sortTaskSummaries(items: TaskSummary[]) {
  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const priorityDiff = getTaskSortPriority(left.item) - getTaskSortPriority(right.item)
      if (priorityDiff !== 0) {
        return priorityDiff
      }

      const timeDiff = Date.parse(right.item.createdAt) - Date.parse(left.item.createdAt)
      if (timeDiff !== 0) {
        return timeDiff
      }

      // Fallback to the API order when timestamps are identical.
      return left.index - right.index
    })
    .map(({ item }) => item)
}

// 按任务阶段固定配色，避免把“当前是否可处理”和“任务所处状态”混在一起。
const taskStatusTagStyleMap: Record<TaskStatus, { background: string; color: string }> = {
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

// “复核”是列表筛选用的业务态，不并入任务主状态枚举。
type TaskListStatusFilter = TaskStatus | 'pending_admin_review'

const taskStatusFilterOptions: Array<{ text: string; value: TaskListStatusFilter }> = [
  {
    text: '待清洗',
    value: 'pending_clean',
  },
  {
    text: '待标注',
    value: 'pending_annotate',
  },
  {
    text: '待训练',
    value: 'pending_train',
  },
  {
    text: '复核',
    value: 'pending_admin_review',
  },
  {
    text: '已完成',
    value: 'finished',
  },
]

function getApprovalTags(record: TaskSummary) {
  const tags: Array<{ label: string; background: string; color: string }> = []

  if (record.needCleanReview) {
    tags.push({ label: '清洗', background: '#FFF7E8', color: '#D46B08' })
  }

  if (record.needAnnotateReview) {
    tags.push({ label: '标注', background: '#E6F4FF', color: '#1677FF' })
  }

  if (record.needTrainReview) {
    tags.push({ label: '训练', background: '#F6FFED', color: '#389E0D' })
  }

  return tags
}

type TaskTableFilters = Parameters<NonNullable<TableProps<TaskSummary>['onChange']>>[1]

function getSelectedTaskStatus(filters: TaskTableFilters): TaskListStatusFilter | null {
  const nextStatus = filters.status?.[0]

  if (
    nextStatus === 'pending_clean' ||
    nextStatus === 'pending_annotate' ||
    nextStatus === 'pending_train' ||
    nextStatus === 'pending_admin_review' ||
    nextStatus === 'finished'
  ) {
    return nextStatus
  }

  return null
}

function isTaskStatus(value: TaskListStatusFilter | null): value is TaskStatus {
  return (
    value === 'pending_clean' ||
    value === 'pending_annotate' ||
    value === 'pending_train' ||
    value === 'finished'
  )
}

function easeOutCubic(progress: number) {
  return 1 - (1 - progress) ** 3
}

function TaskBoardPage() {
  const { Search } = Input
  const { session } = useAuth()
  const { containerRef: tableContainerRef, scrollY } = useTableScrollY()
  const [tasks, setTasks] = useState<TaskSummary[]>([])
  const [users, setUsers] = useState<UserSummary[]>([])
  const [modelIterations, setModelIterations] = useState<ModelIterationSummary[]>([])
  const [summary, setSummary] = useState<TaskListSummary>(EMPTY_TASK_SUMMARY)
  const [animatedSummary, setAnimatedSummary] = useState<TaskListSummary>(EMPTY_TASK_SUMMARY)
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [deletingTaskId, setDeletingTaskId] = useState<number | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<TaskListStatusFilter | null>(null)
  const [, startTransition] = useTransition()
  const metricAnimationFrameRef = useRef<number | null>(null)
  const hasLoadedSummaryRef = useRef(false)
  const hasPlayedMetricAnimationRef = useRef(false)

  const cancelMetricAnimation = useCallback(() => {
    if (metricAnimationFrameRef.current !== null) {
      cancelAnimationFrame(metricAnimationFrameRef.current)
      metricAnimationFrameRef.current = null
    }
  }, [])

  const loadTasks = useCallback(
    async (
      page: number,
      keyword: string,
      status: TaskListStatusFilter | null,
      options?: { silent?: boolean },
    ) => {
      if (!session) {
        return
      }

      if (!options?.silent) {
        setLoading(true)
      }

      try {
        const response = await getTasks(session.token, {
          page,
          pageSize: PAGE_SIZE,
          keyword,
          // “复核”来自 review_status，而不是主状态 status。
          status: isTaskStatus(status) ? status : undefined,
          reviewStatus: status === 'pending_admin_review' ? 'pending_admin_review' : undefined,
        })
        hasLoadedSummaryRef.current = true

        startTransition(() => {
          setTasks(sortTaskSummaries(response.items))
          setSummary(response.summary)
          setCurrentPage(response.pagination.page)
        })
      } catch (error) {
        message.error(error instanceof Error ? error.message : '任务列表加载失败')
      } finally {
        if (!options?.silent) {
          setLoading(false)
        }
      }
    },
    [session, startTransition],
  )

  const loadUsers = useCallback(async () => {
    if (!session || session.user.role !== 'admin') {
      return
    }

    try {
      // 创建任务抽屉需要完整用户选项，不能被列表默认分页截断。
      const response = await getUsers(session.token, { all: true })

      startTransition(() => {
        setUsers(response.items)
      })
    } catch (error) {
      message.error(error instanceof Error ? error.message : '用户列表加载失败')
    }
  }, [session, startTransition])

  const loadModelIterations = useCallback(async () => {
    if (!session || session.user.role !== 'admin') {
      return
    }

    try {
      const response = await getModelIterations(session.token, { all: true })

      startTransition(() => {
        setModelIterations(response.items)
      })
    } catch (error) {
      message.error(error instanceof Error ? error.message : '项目列表加载失败')
    }
  }, [session, startTransition])

  useEffect(() => {
    queueMicrotask(() => {
      void loadTasks(currentPage, searchKeyword, selectedStatus)
    })
  }, [currentPage, loadTasks, searchKeyword, selectedStatus])

  useEffect(() => {
    queueMicrotask(() => {
      void loadUsers()
    })
  }, [loadUsers])

  useEffect(() => {
    queueMicrotask(() => {
      void loadModelIterations()
    })
  }, [loadModelIterations])

  useEffect(() => {
    if (!hasLoadedSummaryRef.current) {
      return
    }

    cancelMetricAnimation()

    const nextSummary: TaskListSummary = {
      total: summary.total,
      actionableCount: summary.actionableCount,
      finishedCount: summary.finishedCount,
    }

    const shouldAnimateOnFirstPaint =
      !hasPlayedMetricAnimationRef.current &&
      (nextSummary.total > 0 || nextSummary.actionableCount > 0 || nextSummary.finishedCount > 0)

    if (!shouldAnimateOnFirstPaint) {
      // 首次接口返回就是 0 时直接显示，避免为了“播动画”制造无意义跳动。
      // 同时这里也负责后续筛选/翻页后的同步更新，确保只在首屏播放一次。
      hasPlayedMetricAnimationRef.current = true
      setAnimatedSummary(nextSummary)
      return
    }

    hasPlayedMetricAnimationRef.current = true
    const animationStartAt = performance.now()

    const step = (timestamp: number) => {
      const progress = Math.min((timestamp - animationStartAt) / METRIC_ANIMATION_DURATION, 1)
      const easedProgress = easeOutCubic(progress)

      setAnimatedSummary({
        total: Math.round(nextSummary.total * easedProgress),
        actionableCount: Math.round(nextSummary.actionableCount * easedProgress),
        finishedCount: Math.round(nextSummary.finishedCount * easedProgress),
      })

      if (progress < 1) {
        metricAnimationFrameRef.current = requestAnimationFrame(step)
        return
      }

      metricAnimationFrameRef.current = null
      setAnimatedSummary(nextSummary)
    }

    metricAnimationFrameRef.current = requestAnimationFrame(step)

    return () => {
      // React StrictMode 下 effect 会重复进入，清掉旧帧可以避免数字抖动或叠加。
      cancelMetricAnimation()
    }
  }, [cancelMetricAnimation, summary])

  useEffect(() => {
    return () => {
      cancelMetricAnimation()
    }
  }, [cancelMetricAnimation])

  const handleSearch = useCallback((value: string) => {
    const normalizedKeyword = value.trim()
    setSearchInput(normalizedKeyword)

    if (normalizedKeyword !== searchKeyword) {
      setSearchKeyword(normalizedKeyword)

      if (currentPage !== 1) {
        setCurrentPage(1)
      }

      return
    }

    if (currentPage !== 1) {
      setCurrentPage(1)
      return
    }

    void loadTasks(1, normalizedKeyword, selectedStatus)
  }, [currentPage, loadTasks, searchKeyword, selectedStatus])

  const handleTableChange = useCallback(
    (pagination: TablePaginationConfig, filters: TaskTableFilters) => {
      const nextStatus = getSelectedTaskStatus(filters)
      const nextPage = pagination.current ?? 1

      if (nextStatus !== selectedStatus) {
        setSelectedStatus(nextStatus)

        if (currentPage !== 1) {
          setCurrentPage(1)
        }
        return
      }

      if (nextPage !== currentPage) {
        setCurrentPage(nextPage)
      }
    },
    [currentPage, loadTasks, searchKeyword, selectedStatus],
  )

  const handleDeleteTask = useCallback(
    async (taskId: number) => {
      if (!session) {
        return
      }

      setDeletingTaskId(taskId)

      try {
        await deleteTask(taskId, session.token)
        message.success('任务已删除')
        await loadTasks(currentPage, searchKeyword, selectedStatus, { silent: true })
      } catch (error) {
        message.error(error instanceof Error ? error.message : '任务删除失败')
      } finally {
        setDeletingTaskId(null)
      }
    },
    [currentPage, loadTasks, searchKeyword, selectedStatus, session],
  )

  const columns: TableColumnsType<TaskSummary> = [
    {
      title: '任务',
      dataIndex: 'title',
      key: 'title',
      width: 280,
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
      title: '所属项目',
      key: 'modelIteration',
      width: 220,
      render: (_value, record) => (
        <div className="data-cell-title">
          <Typography.Text strong>{record.modelIteration.name}</Typography.Text>
          <Typography.Text className="muted-text">ID：{record.modelIteration.id}</Typography.Text>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'statusLabel',
      key: 'status',
      width: 160,
      filters: taskStatusFilterOptions,
      filterMultiple: false,
      filteredValue: selectedStatus ? [selectedStatus] : null,
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
      title: '审批流程控制',
      key: 'approvalStages',
      width: 220,
      render: (_value, record) => {
        const tags = getApprovalTags(record)

        if (tags.length === 0) {
          return <Typography.Text className="muted-text">无</Typography.Text>
        }

        return (
          <Space size={[6, 6]} wrap>
            {tags.map((tag) => (
              <Tag
                key={tag.label}
                bordered={false}
                className="status-tag"
                color={tag.background}
                style={{ color: tag.color }}
              >
                {tag.label}
              </Tag>
            ))}
          </Space>
        )
      },
    },
    {
      title: '审核状态',
      key: 'reviewStatus',
      width: 200,
      render: (_value, record) => {
        if (!record.currentStageNeedsReview) {
          return <Typography.Text className="muted-text">不适用</Typography.Text>
        }

        if (record.reviewActionLabel && record.needsAdminReview) {
          return <Typography.Text>{record.reviewActionLabel}</Typography.Text>
        }

        return (
          <Typography.Text className={record.reviewStatus === 'rejected' ? '' : 'muted-text'}>
            {record.reviewStatusLabel}
          </Typography.Text>
        )
      },
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
      width: 180,
      render: (value: string) => formatDate(value),
    },
    {
      title: '操作',
      key: 'actions',
      width: session?.user.role === 'admin' ? 260 : 140,
      fixed: 'right',
      render: (_value, record) => (
        <Space size="small">
          <Button
            type={record.canHandle || record.canReview || record.canResubmit ? 'primary' : 'default'}
            onClick={() => {
              setSelectedTaskId(record.id)
              setDetailOpen(true)
            }}
          >
            {record.canReview
              ? '进入审核'
              : record.canResubmit
                ? '重新提交'
                : record.canHandle
                  ? '进入处理'
                  : '查看详情'}
          </Button>

          {session?.user.role === 'admin' ? (
            <Popconfirm
              title="确认删除该任务吗？"
              description="仅删除任务记录，不会同步删除已上传文件。"
              okText="删除"
              cancelText="取消"
              okButtonProps={{
                danger: true,
                loading: deletingTaskId === record.id,
              }}
              onConfirm={async () => {
                await handleDeleteTask(record.id)
              }}
            >
              <Button
                danger
                disabled={deletingTaskId !== null}
                loading={deletingTaskId === record.id}
              >
                删除
              </Button>
            </Popconfirm>
          ) : null}
        </Space>
      ),
    },
  ]

  const metrics = [
    {
      label: '待我处理',
      value: animatedSummary.actionableCount,
    },
    {
      label: '总任务数',
      value: animatedSummary.total,
    },
    {
      label: '已完成',
      value: animatedSummary.finishedCount,
    },
  ]

  function renderMetricCard(metric: { label: string; value: number }, index: number) {
    const card = (
      <Card
        className="panel-card metric-card task-metric-card animate__animated animate__fadeInUp"
        style={{ animationDelay: `${index * 120}ms` }}
      >
        <Typography.Text className="muted-text">{metric.label}</Typography.Text>
        <Typography.Title level={3}>{metric.value}</Typography.Title>
      </Card>
    )

    if (metric.label === '待我处理') {
      // 用醒目的角标强调“待我处理”卡片，提醒用户这里有高优先级待办。
      return (
        <Badge.Ribbon text="优先处理" color="red">
          {card}
        </Badge.Ribbon>
      )
    }

    return card
  }

  if (!session) {
    return null
  }

  return (
    <div className="page-stack page-fill page-table-layout">
      <section className="page-header page-header-surface">
        <div className="page-header-copy">
          {/*<Typography.Text className="section-eyebrow">*/}
          {/*  Task Workspace*/}
          {/*</Typography.Text>*/}
          <Typography.Title level={2} className="page-title">
            任务工作台
          </Typography.Title>
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
        {metrics.map((metric, index) => (
          <Col xs={24} md={8} key={metric.label}>
            {renderMetricCard(metric, index)}
          </Col>
        ))}
      </Row>

      <Card className="panel-card page-table-card">
        <div className="table-card-toolbar task-table-toolbar">
          <div className="toolbar-copy">
            <Typography.Title level={5}>任务列表</Typography.Title>
            <Typography.Text className="muted-text">
              按任务名称模糊搜索，并支持按状态筛选，结果会同步影响分页和统计。
            </Typography.Text>
          </div>

          <Search
            value={searchInput}
            allowClear
            placeholder="请输入任务名称"
            className="task-search-input"
            onChange={(event) => {
              const nextValue = event.target.value
              setSearchInput(nextValue)

              if (nextValue === '' && searchKeyword !== '') {
                handleSearch('')
              }
            }}
            onSearch={handleSearch}
          />
        </div>

        <div ref={tableContainerRef} className="table-scroll-host">
          <Table<TaskSummary>
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={tasks}
            // fixed 列依赖横向滚动配置；这里保留纵向自适应滚动，避免操作列固定后失效。
            scroll={{
              x: 1680,
              ...(scrollY ? { y: scrollY } : {}),
            }}
            pagination={{
              current: currentPage,
              pageSize: PAGE_SIZE,
              total: summary.total,
              hideOnSinglePage: true,
              showSizeChanger: false,
            }}
            onChange={handleTableChange}
            locale={{
              emptyText: searchKeyword || selectedStatus ? '未找到匹配的任务' : '当前暂无任务',
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
          void loadTasks(currentPage, searchKeyword, selectedStatus, { silent: true })
        }}
      />

      <CreateTaskDrawer
        open={createOpen}
        users={users}
        modelIterations={modelIterations}
        onClose={() => {
          setCreateOpen(false)
        }}
        onCreated={() => {
          if (currentPage === 1) {
            void loadTasks(1, searchKeyword, selectedStatus, { silent: true })
            return
          }

          setCurrentPage(1)
        }}
      />
    </div>
  )
}

export default TaskBoardPage
