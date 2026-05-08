import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import type { TableColumnsType } from 'antd'
import { useCallback, useEffect, useState, useTransition } from 'react'
import { useNavigate } from 'react-router-dom'
import { createModelIteration, getModelIterations } from '../api/client'
import { useAuth } from '../context/useAuth'
import { useTableScrollY } from '../hooks/useTableScrollY'
import type { ModelIterationSummary } from '../types/models'

const PAGE_SIZE = 10

type CreateProjectFormValues = {
  name: string
  description: string
  baseModelName: string
  goal: string
}

function formatDate(value: string | null) {
  if (!value) {
    return '暂无'
  }

  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
  })
}

function ProjectManagementPage() {
  const { Search } = Input
  const navigate = useNavigate()
  const { session } = useAuth()
  const { containerRef: tableContainerRef, scrollY } = useTableScrollY()
  const [form] = Form.useForm<CreateProjectFormValues>()
  const [items, setItems] = useState<ModelIterationSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [searchInput, setSearchInput] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [, startTransition] = useTransition()

  const loadProjects = useCallback(
    async (page: number, keyword: string, options?: { silent?: boolean }) => {
      if (!session) {
        return
      }

      if (!options?.silent) {
        setLoading(true)
      }

      try {
        const response = await getModelIterations(session.token, {
          page,
          pageSize: PAGE_SIZE,
          keyword,
        })

        startTransition(() => {
          setItems(response.items)
          setTotal(response.pagination.total)
          setCurrentPage(response.pagination.page)
        })
      } catch (error) {
        message.error(error instanceof Error ? error.message : '项目列表加载失败')
      } finally {
        if (!options?.silent) {
          setLoading(false)
        }
      }
    },
    [session, startTransition],
  )

  useEffect(() => {
    queueMicrotask(() => {
      void loadProjects(currentPage, searchKeyword)
    })
  }, [currentPage, loadProjects, searchKeyword])

  const handleSearch = useCallback(
    (value: string) => {
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

      void loadProjects(1, normalizedKeyword)
    },
    [currentPage, loadProjects, searchKeyword],
  )

  const columns: TableColumnsType<ModelIterationSummary> = [
    {
      title: '项目名称',
      dataIndex: 'name',
      key: 'name',
      render: (value: string, record) => (
        <div className="data-cell-title">
          <Typography.Text strong>{value}</Typography.Text>
          <Typography.Paragraph className="muted-paragraph compact">
            {record.description || '暂无描述'}
          </Typography.Paragraph>
        </div>
      ),
    },
    {
      title: '基线模型',
      dataIndex: 'baseModelName',
      key: 'baseModelName',
      width: 180,
    },
    {
      title: '迭代目标',
      dataIndex: 'goal',
      key: 'goal',
      render: (value: string) => (
        <Typography.Paragraph className="muted-paragraph compact">
          {value}
        </Typography.Paragraph>
      ),
    },
    {
      title: '状态',
      key: 'status',
      width: 120,
      render: (_value, record) => (
        <Tag
          bordered={false}
          className="status-tag"
          color={record.status === 'active' ? '#E6F4FF' : '#FAFAFA'}
          style={{ color: record.status === 'active' ? '#1677FF' : '#4E5969' }}
        >
          {record.statusLabel}
        </Tag>
      ),
    },
    {
      title: '任务数量',
      dataIndex: 'taskCount',
      key: 'taskCount',
      width: 120,
    },
    {
      title: '最新任务时间',
      dataIndex: 'latestTaskAt',
      key: 'latestTaskAt',
      width: 190,
      render: (value: string | null) => formatDate(value),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 190,
      render: (value: string) => formatDate(value),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_value, record) => (
        <Button onClick={() => navigate(`/projects/${record.id}`)}>
          查看详情
        </Button>
      ),
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
            Project Management
          </Typography.Text>
          <Typography.Title level={2} className="page-title">
            项目管理
          </Typography.Title>
        </div>

        <div className="page-actions">
            <Button type="primary" size="large" onClick={() => setCreateOpen(true)}>
            新建项目
            </Button>
        </div>
      </section>

      <Card className="panel-card page-table-card">
        <div className="table-card-toolbar task-table-toolbar">
          <div className="toolbar-copy">
            <Typography.Title level={5}>项目列表</Typography.Title>
            <Typography.Text className="muted-text">
              统一管理项目主线，并查看该项目下的任务和模型结果聚合。
            </Typography.Text>
          </div>

          <Search
            value={searchInput}
            allowClear
            placeholder="请输入项目名称"
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
          <Table<ModelIterationSummary>
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={items}
            scroll={scrollY ? { y: scrollY } : undefined}
            pagination={{
              current: currentPage,
              pageSize: PAGE_SIZE,
              total,
              hideOnSinglePage: true,
              showSizeChanger: false,
              onChange: (page) => {
                if (page !== currentPage) {
                  setCurrentPage(page)
                }
              },
            }}
            locale={{
              emptyText: searchKeyword ? '未找到匹配的项目' : '当前暂无项目',
            }}
          />
        </div>
      </Card>

      <Modal
        open={createOpen}
        title="新建项目"
        okText="创建"
        cancelText="取消"
        confirmLoading={submitting}
        onCancel={() => setCreateOpen(false)}
        onOk={() => {
          void form.submit()
        }}
        destroyOnHidden
      >
        <Form<CreateProjectFormValues>
          form={form}
          layout="vertical"
          onFinish={async (values) => {
            if (!session) {
              return
            }

            setSubmitting(true)

            try {
              await createModelIteration(values, session.token)
              message.success('项目创建成功')
              setCreateOpen(false)
              form.resetFields()

              if (currentPage !== 1) {
                setCurrentPage(1)
              } else {
                await loadProjects(1, searchKeyword, { silent: true })
              }
            } catch (error) {
              message.error(error instanceof Error ? error.message : '项目创建失败')
            } finally {
              setSubmitting(false)
            }
          }}
        >
          <Form.Item label="项目名称" name="name" rules={[{ required: true, message: '请输入项目名称' }]}>
            <Input placeholder="例如：通用目标检测 v2" />
          </Form.Item>

          <Form.Item label="项目描述" name="description">
            <Input.TextArea rows={3} placeholder="补充本项目背景与说明" />
          </Form.Item>

          <Form.Item
            label="基线模型名称或来源说明"
            name="baseModelName"
            rules={[{ required: true, message: '请输入基线模型名称或来源说明' }]}
          >
            <Input placeholder="例如：YOLOv8n / 2026-04 基线模型" />
          </Form.Item>

          <Form.Item label="本轮迭代目标" name="goal" rules={[{ required: true, message: '请输入迭代目标' }]}>
            <Input.TextArea rows={4} placeholder="例如：提升夜间场景检出率并减少误报" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default ProjectManagementPage
