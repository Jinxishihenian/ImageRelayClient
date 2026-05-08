import {
  Button,
  Card,
  Descriptions,
  Drawer,
  Input,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import type { TableColumnsType } from 'antd'
import { useCallback, useEffect, useState, useTransition } from 'react'
import { getDatasetDetail, getDatasets } from '../api/client'
import { useAuth } from '../context/useAuth'
import { useTableScrollY } from '../hooks/useTableScrollY'
import type { DatasetDetail, DatasetSummary, DatasetVersionSummary } from '../types/models'

const PAGE_SIZE = 10

function formatDate(value: string | null) {
  if (!value) {
    return '暂无'
  }

  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
  })
}

function getStageTagColor(stage: DatasetVersionSummary['stage']) {
  switch (stage) {
    case 'raw':
      return { background: '#FFF7E8', color: '#D46B08' }
    case 'cleaned':
      return { background: '#E6F4FF', color: '#1677FF' }
    case 'annotated':
      return { background: '#F6FFED', color: '#389E0D' }
  }
}

function FileListPage() {
  const { Search } = Input
  const { session } = useAuth()
  const { containerRef, scrollY } = useTableScrollY()
  const [items, setItems] = useState<DatasetSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [searchInput, setSearchInput] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detail, setDetail] = useState<DatasetDetail | null>(null)
  const [, startTransition] = useTransition()

  const loadDatasets = useCallback(
    async (page: number, keyword: string, options?: { silent?: boolean }) => {
      if (!session) {
        return
      }

      if (!options?.silent) {
        setLoading(true)
      }

      try {
        const response = await getDatasets(session.token, {
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
        message.error(error instanceof Error ? error.message : '数据集列表加载失败')
      } finally {
        if (!options?.silent) {
          setLoading(false)
        }
      }
    },
    [session, startTransition],
  )

  const loadDetail = useCallback(
    async (datasetId: number) => {
      if (!session) {
        return
      }

      setDetailLoading(true)

      try {
        const response = await getDatasetDetail(datasetId, session.token)
        startTransition(() => {
          setDetail(response)
        })
      } catch (error) {
        message.error(error instanceof Error ? error.message : '数据集详情加载失败')
      } finally {
        setDetailLoading(false)
      }
    },
    [session, startTransition],
  )

  useEffect(() => {
    queueMicrotask(() => {
      void loadDatasets(currentPage, searchKeyword)
    })
  }, [currentPage, loadDatasets, searchKeyword])

  useEffect(() => {
    if (!detailOpen || !selectedDatasetId) {
      return
    }

    queueMicrotask(() => {
      void loadDetail(selectedDatasetId)
    })
  }, [detailOpen, loadDetail, selectedDatasetId])

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

      void loadDatasets(1, normalizedKeyword)
    },
    [currentPage, loadDatasets, searchKeyword],
  )

  const columns: TableColumnsType<DatasetSummary> = [
    {
      title: '数据集名称',
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
      title: '所属任务',
      dataIndex: 'taskId',
      key: 'taskId',
      width: 120,
      render: (value: number) => `#${value}`,
    },
    {
      title: '当前版本',
      dataIndex: 'currentVersionLabel',
      key: 'currentVersionLabel',
      width: 160,
      render: (value: string | null) => value || '暂无',
    },
    {
      title: '版本数量',
      dataIndex: 'versionCount',
      key: 'versionCount',
      width: 120,
    },
    {
      title: '创建人',
      key: 'creator',
      width: 140,
      render: (_value, record) => record.creator.username,
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
      width: 120,
      render: (_value, record) => (
        <Button
          onClick={() => {
            setSelectedDatasetId(record.id)
            setDetailOpen(true)
          }}
        >
          查看详情
        </Button>
      ),
    },
  ]

  const versionColumns: TableColumnsType<DatasetVersionSummary> = [
    {
      title: '版本',
      dataIndex: 'label',
      key: 'label',
      width: 140,
    },
    {
      title: '阶段',
      key: 'stage',
      width: 120,
      render: (_value, record) => {
        const tagColor = getStageTagColor(record.stage)

        return (
          <Tag bordered={false} color={tagColor.background} style={{ color: tagColor.color }}>
            {record.stageLabel}
          </Tag>
        )
      },
    },
    {
      title: '来源任务',
      dataIndex: 'sourceTaskId',
      key: 'sourceTaskId',
      width: 120,
      render: (value: number) => `#${value}`,
    },
    {
      title: '父版本',
      dataIndex: 'parentVersionLabel',
      key: 'parentVersionLabel',
      width: 140,
      render: (value: string | null) => value || '无',
    },
    {
      title: '创建人',
      key: 'createdBy',
      width: 120,
      render: (_value, record) => record.createdBy.username,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (value: string) => formatDate(value),
    },
    {
      title: '生成方式',
      key: 'reviewBased',
      width: 120,
      render: (_value, record) => (record.reviewBased ? '审核通过后生成' : '提交即生成'),
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
            Datasets
          </Typography.Text>
          <Typography.Title level={2} className="page-title">
            数据集管理
          </Typography.Title>
        </div>
      </section>

      <Card className="panel-card page-table-card">
        <div className="table-card-toolbar task-table-toolbar">
          <div className="toolbar-copy">
            <Typography.Title level={5}>数据集列表</Typography.Title>
            <Typography.Text className="muted-text">
              查看任务自动沉淀的数据集以及 raw、cleaned、annotated 版本演进情况。
            </Typography.Text>
          </div>

          <Search
            value={searchInput}
            allowClear
            placeholder="请输入数据集名称"
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

        <div ref={containerRef} className="table-scroll-host">
          <Table<DatasetSummary>
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
              emptyText: searchKeyword ? '未找到匹配的数据集' : '当前暂无数据集',
            }}
          />
        </div>
      </Card>

      <Drawer
        open={detailOpen}
        width={820}
        title={detail?.name ?? '数据集详情'}
        onClose={() => {
          setDetailOpen(false)
          setSelectedDatasetId(null)
          setDetail(null)
        }}
        destroyOnClose
        loading={detailLoading}
      >
        {detail ? (
          <div className="detail-stack">
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="所属任务">{detail.taskTitle}</Descriptions.Item>
              <Descriptions.Item label="当前版本">{detail.currentVersionLabel || '暂无'}</Descriptions.Item>
              <Descriptions.Item label="模态">{detail.modality}</Descriptions.Item>
              <Descriptions.Item label="版本数量">{detail.versionCount}</Descriptions.Item>
              <Descriptions.Item label="创建人">{detail.creator.username}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{formatDate(detail.createdAt)}</Descriptions.Item>
              <Descriptions.Item label="数据集描述" span={2}>
                {detail.description || '暂无描述'}
              </Descriptions.Item>
            </Descriptions>

            <Card className="panel-card page-table-card">
              <div className="table-card-toolbar">
                <div className="toolbar-copy">
                  <Typography.Title level={5}>版本列表</Typography.Title>
                  <Typography.Text className="muted-text">
                    版本按创建时间倒序展示，用于追踪原始输入到清洗、标注的血缘关系。
                  </Typography.Text>
                </div>
              </div>

              <Table<DatasetVersionSummary>
                rowKey="id"
                columns={versionColumns}
                dataSource={detail.versions}
                pagination={false}
                locale={{ emptyText: '当前数据集暂无版本' }}
              />
            </Card>
          </div>
        ) : null}
      </Drawer>
    </div>
  )
}

export default FileListPage
