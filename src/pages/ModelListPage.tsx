import { Button, Card, Input, Space, Table, Typography, message } from 'antd'
import type { TableColumnsType } from 'antd'
import { useCallback, useEffect, useState, useTransition } from 'react'
import { downloadTaskFile, getModels } from '../api/client'
import { useAuth } from '../context/useAuth'
import { useTableScrollY } from '../hooks/useTableScrollY'
import type { ModelListItem } from '../types/models'

const PAGE_SIZE = 10

function formatDate(value: string) {
  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
  })
}

function ModelListPage() {
  const { Search } = Input
  const { session } = useAuth()
  const { containerRef: tableContainerRef, scrollY } = useTableScrollY()
  const [models, setModels] = useState<ModelListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [downloadingTaskId, setDownloadingTaskId] = useState<number | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [searchInput, setSearchInput] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [, startTransition] = useTransition()

  const loadModels = useCallback(
    async (page: number, keyword: string, options?: { silent?: boolean }) => {
      if (!session) {
        return
      }

      if (!options?.silent) {
        setLoading(true)
      }

      try {
        const response = await getModels(session.token, {
          page,
          pageSize: PAGE_SIZE,
          keyword,
        })

        startTransition(() => {
          setModels(response.items)
          setTotal(response.pagination.total)
          setCurrentPage(response.pagination.page)
        })
      } catch (error) {
        message.error(error instanceof Error ? error.message : '模型列表加载失败')
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
      void loadModels(currentPage, searchKeyword)
    })
  }, [currentPage, loadModels, searchKeyword])

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

      void loadModels(1, normalizedKeyword)
    },
    [currentPage, loadModels, searchKeyword],
  )

  const columns: TableColumnsType<ModelListItem> = [
    {
      title: '任务名称',
      dataIndex: 'taskTitle',
      key: 'taskTitle',
      render: (value: string, record) => (
        <div className="data-cell-title">
          <Typography.Text strong>{value}</Typography.Text>
          <Typography.Text className="muted-text">任务 ID：{record.taskId}</Typography.Text>
        </div>
      ),
    },
    {
      title: '模型文件名',
      dataIndex: 'modelFileName',
      key: 'modelFileName',
      render: (value: string) => <Typography.Text>{value}</Typography.Text>,
    },
    {
      title: '训练负责人',
      dataIndex: 'trainer',
      key: 'trainer',
      width: 140,
      render: (_value, record) => record.trainer.username,
    },
    {
      title: '训练备注',
      dataIndex: 'trainerRemark',
      key: 'trainerRemark',
      render: (value: string | null) => (
        <Typography.Paragraph className="muted-paragraph compact">
          {value?.trim() || '暂无备注'}
        </Typography.Paragraph>
      ),
    },
    {
      title: '完成时间',
      dataIndex: 'finishedAt',
      key: 'finishedAt',
      width: 190,
      render: (value: string) => formatDate(value),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_value, record) => (
        <Space size="small">
          <Button
            loading={downloadingTaskId === record.taskId}
            onClick={() => {
              void (async () => {
                if (!session) {
                  return
                }

                setDownloadingTaskId(record.taskId)

                try {
                  await downloadTaskFile(
                    record.download.endpoint,
                    session.token,
                  )
                } catch (error) {
                  message.error(error instanceof Error ? error.message : '模型文件下载失败')
                } finally {
                  setDownloadingTaskId(null)
                }
              })()
            }}
          >
            下载
          </Button>
        </Space>
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
            Model Results
          </Typography.Text>
          <Typography.Title level={2} className="page-title">
            模型列表
          </Typography.Title>
        </div>
      </section>

      <Card className="panel-card page-table-card">
        <div className="table-card-toolbar task-table-toolbar">
          <div className="toolbar-copy">
            <Typography.Title level={5}>模型结果列表</Typography.Title>
            <Typography.Text className="muted-text">
              统一查看所有已完成任务输出的模型文件，并支持直接下载。
            </Typography.Text>
          </div>

          <Search
            value={searchInput}
            allowClear
            placeholder="请输入任务名称或模型文件名"
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
          <Table<ModelListItem>
            rowKey="taskId"
            loading={loading}
            columns={columns}
            dataSource={models}
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
              emptyText: '当前暂无模型结果文件',
            }}
          />
        </div>
      </Card>
    </div>
  )
}

export default ModelListPage
