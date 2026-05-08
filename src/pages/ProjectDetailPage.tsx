import { Button, Card, Descriptions, Space, Table, Tag, Typography, message } from 'antd'
import type { TableColumnsType } from 'antd'
import { useCallback, useEffect, useState, useTransition } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { downloadTaskFile, getModelIterationDetail, markCurrentBestModelResult } from '../api/client'
import { useAuth } from '../context/useAuth'
import { useTableScrollY } from '../hooks/useTableScrollY'
import type { ModelIterationDetail, ModelIterationResultItem, ModelIterationTaskItem } from '../types/models'

function formatDate(value: string | null) {
  if (!value) {
    return '暂无'
  }

  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
  })
}

function ProjectDetailPage() {
  const navigate = useNavigate()
  const { projectId } = useParams()
  const { session } = useAuth()
  const { containerRef: taskTableRef, scrollY: taskScrollY } = useTableScrollY()
  const { containerRef: resultTableRef, scrollY: resultScrollY } = useTableScrollY()
  const [detail, setDetail] = useState<ModelIterationDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [markingTaskId, setMarkingTaskId] = useState<number | null>(null)
  const [downloadingTaskId, setDownloadingTaskId] = useState<number | null>(null)
  const [, startTransition] = useTransition()

  const numericProjectId = Number(projectId)

  const loadDetail = useCallback(async () => {
    if (!session || !Number.isInteger(numericProjectId) || numericProjectId <= 0) {
      if (projectId) {
        message.error('项目编号无效')
      }
      return
    }

    setLoading(true)

    try {
      const response = await getModelIterationDetail(numericProjectId, session.token)

      startTransition(() => {
        setDetail(response)
      })
    } catch (error) {
      message.error(error instanceof Error ? error.message : '项目详情加载失败')
    } finally {
      setLoading(false)
    }
  }, [numericProjectId, projectId, session, startTransition])

  useEffect(() => {
    queueMicrotask(() => {
      void loadDetail()
    })
  }, [loadDetail])

  const taskColumns: TableColumnsType<ModelIterationTaskItem> = [
    {
      title: '任务名称',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: '状态',
      dataIndex: 'statusLabel',
      key: 'statusLabel',
      width: 180,
    },
    {
      title: '清洗负责人',
      key: 'cleaner',
      width: 120,
      render: (_value, record) => record.cleaner.username,
    },
    {
      title: '标注负责人',
      key: 'annotator',
      width: 120,
      render: (_value, record) => record.annotator.username,
    },
    {
      title: '训练负责人',
      key: 'trainer',
      width: 120,
      render: (_value, record) => record.trainer.username,
    },
    {
      title: '完成时间',
      dataIndex: 'finishedAt',
      key: 'finishedAt',
      width: 190,
      render: (value: string | null) => formatDate(value),
    },
  ]

  const resultColumns: TableColumnsType<ModelIterationResultItem> = [
    {
      title: '任务名称',
      dataIndex: 'taskTitle',
      key: 'taskTitle',
    },
    {
      title: '模型文件名',
      dataIndex: 'modelFileName',
      key: 'modelFileName',
    },
    {
      title: '训练负责人',
      key: 'trainer',
      width: 120,
      render: (_value, record) => record.trainer.username,
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
      width: 220,
      render: (_value, record) => (
        <Space size="small" wrap>
          <Button
            loading={downloadingTaskId === record.taskId}
            onClick={() => {
              if (!session) {
                return
              }

              setDownloadingTaskId(record.taskId)

              void downloadTaskFile(record.download.endpoint, session.token)
                .catch((error) => {
                  message.error(error instanceof Error ? error.message : '模型文件下载失败')
                })
                .finally(() => {
                  setDownloadingTaskId(null)
                })
            }}
          >
            下载
          </Button>

          <Button
            type={detail?.currentBestTaskId === record.taskId ? 'primary' : 'default'}
            loading={markingTaskId === record.taskId}
            disabled={detail?.currentBestTaskId === record.taskId}
            onClick={() => {
              if (!session || !detail) {
                return
              }

              setMarkingTaskId(record.taskId)

              void markCurrentBestModelResult(detail.id, record.taskId, session.token)
                .then((response) => {
                  startTransition(() => {
                    setDetail(response)
                  })
                  message.success('当前最佳结果已更新')
                })
                .catch((error) => {
                  message.error(error instanceof Error ? error.message : '设置最佳结果失败')
                })
                .finally(() => {
                  setMarkingTaskId(null)
                })
            }}
          >
            {detail?.currentBestTaskId === record.taskId ? '当前最佳结果' : '设为当前最佳结果'}
          </Button>
        </Space>
      ),
    },
  ]

  if (!session) {
    return null
  }

  return (
    <div className="page-stack page-fill">
      <section className="page-header page-header-surface">
        <div className="page-header-copy">
          <Typography.Text className="section-eyebrow">
            Project Detail
          </Typography.Text>
          <Typography.Title level={2} className="page-title">
            {detail?.name ?? '项目详情'}
          </Typography.Title>
        </div>

        <div className="page-actions">
            <Button onClick={() => navigate('/projects')}>返回项目列表</Button>
        </div>
      </section>

      <Card className="panel-card" loading={loading}>
        {detail ? (
          <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="项目状态">
              <Tag
                bordered={false}
                className="status-tag"
                color={detail.status === 'active' ? '#E6F4FF' : '#FAFAFA'}
                style={{ color: detail.status === 'active' ? '#1677FF' : '#4E5969' }}
              >
                {detail.statusLabel}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="创建人">{detail.creator.username}</Descriptions.Item>
            <Descriptions.Item label="基线模型">{detail.baseModelName}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{formatDate(detail.createdAt)}</Descriptions.Item>
            <Descriptions.Item label="本轮目标" span={2}>
              {detail.goal}
            </Descriptions.Item>
            <Descriptions.Item label="项目描述" span={2}>
              {detail.description || '暂无描述'}
            </Descriptions.Item>
            <Descriptions.Item label="最近一次训练结果" span={2}>
              {detail.latestModelResult
                ? `${detail.latestModelResult.taskTitle} / ${detail.latestModelResult.modelFileName}`
                : '暂无'}
            </Descriptions.Item>
            <Descriptions.Item label="当前最佳结果" span={2}>
              {detail.currentBestResult
                ? `${detail.currentBestResult.taskTitle} / ${detail.currentBestResult.modelFileName}`
                : '暂无'}
            </Descriptions.Item>
          </Descriptions>
        ) : null}
      </Card>

      <Card className="panel-card page-table-card">
        <div className="table-card-toolbar">
          <div className="toolbar-copy">
            <Typography.Title level={5}>项目任务</Typography.Title>
            <Typography.Text className="muted-text">
              查看该项目下全部任务的当前状态与负责人。
            </Typography.Text>
          </div>
        </div>

        <div ref={taskTableRef} className="table-scroll-host">
          <Table<ModelIterationTaskItem>
            rowKey="id"
            loading={loading}
            columns={taskColumns}
            dataSource={detail?.tasks ?? []}
            scroll={taskScrollY ? { y: taskScrollY } : undefined}
            pagination={false}
            locale={{ emptyText: '当前项目暂无任务' }}
          />
        </div>
      </Card>

      <Card className="panel-card page-table-card">
        <div className="table-card-toolbar">
          <div className="toolbar-copy">
            <Typography.Title level={5}>模型结果</Typography.Title>
            <Typography.Text className="muted-text">
              聚合展示该项目下已完成任务的模型文件，并支持标记当前最佳结果。
            </Typography.Text>
          </div>
        </div>

        <div ref={resultTableRef} className="table-scroll-host">
          <Table<ModelIterationResultItem>
            rowKey="taskId"
            loading={loading}
            columns={resultColumns}
            dataSource={detail?.results ?? []}
            scroll={resultScrollY ? { y: resultScrollY } : undefined}
            pagination={false}
            locale={{ emptyText: '当前项目暂无模型结果' }}
          />
        </div>
      </Card>
    </div>
  )
}

export default ProjectDetailPage
