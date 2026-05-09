import { Button, Card, Descriptions, Drawer, Space, Table, Tabs, Tag, Typography, message } from 'antd'
import type { TableColumnsType } from 'antd'
import { useCallback, useEffect, useState, useTransition } from 'react'
import {
  downloadDatasetVersionFile,
  downloadTaskFile,
  getDatasetDetail,
  markCurrentBestModelResult,
} from '../api/client'
import { useTableScrollY } from '../hooks/useTableScrollY'
import type {
  DatasetDetail,
  DatasetSummary,
  DatasetVersionSummary,
  ModelIterationDetail,
  ModelIterationResultItem,
  ModelIterationTaskItem,
} from '../types/models'

type ProjectDetailContentProps = {
  detail: ModelIterationDetail | null
  loading: boolean
  token: string
  onDetailChange?: (detail: ModelIterationDetail | null) => void
}

function formatDate(value: string | null) {
  if (!value) {
    return '暂无'
  }

  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
  })
}

function formatVersionNo(versionNo: number | null | undefined) {
  if (!versionNo) {
    return '暂无'
  }

  return `v${versionNo}`
}

function formatCurrentVersion(record: DatasetSummary | DatasetDetail) {
  if (!record.currentVersionNo) {
    return '未设置'
  }

  if (!record.currentVersionStageLabel) {
    return formatVersionNo(record.currentVersionNo)
  }

  return `${formatVersionNo(record.currentVersionNo)} / ${record.currentVersionStageLabel}`
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

function ProjectDetailContent({ detail, loading, token, onDetailChange }: ProjectDetailContentProps) {
  const { containerRef: taskTableRef, scrollY: taskScrollY } = useTableScrollY()
  const { containerRef: resultTableRef, scrollY: resultScrollY } = useTableScrollY()
  const { containerRef: datasetTableRef, scrollY: datasetScrollY } = useTableScrollY()
  const [markingTaskId, setMarkingTaskId] = useState<number | null>(null)
  const [downloadingTaskId, setDownloadingTaskId] = useState<number | null>(null)
  const [downloadingDatasetVersionId, setDownloadingDatasetVersionId] = useState<number | null>(null)
  const [datasetDetailOpen, setDatasetDetailOpen] = useState(false)
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(null)
  const [datasetDetailLoading, setDatasetDetailLoading] = useState(false)
  const [datasetDetail, setDatasetDetail] = useState<DatasetDetail | null>(null)
  const [, startTransition] = useTransition()

  const loadDatasetDetail = useCallback(
    async (datasetId: number) => {
      setDatasetDetailLoading(true)

      try {
        const response = await getDatasetDetail(datasetId, token)
        startTransition(() => {
          setDatasetDetail(response)
        })
      } catch (error) {
        message.error(error instanceof Error ? error.message : '项目数据集详情加载失败')
      } finally {
        setDatasetDetailLoading(false)
      }
    },
    [token, startTransition],
  )

  useEffect(() => {
    if (!datasetDetailOpen || !selectedDatasetId) {
      return
    }

    queueMicrotask(() => {
      void loadDatasetDetail(selectedDatasetId)
    })
  }, [datasetDetailOpen, loadDatasetDetail, selectedDatasetId])

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
              setDownloadingTaskId(record.taskId)

              void downloadTaskFile(record.download.endpoint, token)
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
            disabled={detail?.currentBestTaskId === record.taskId || !detail}
            onClick={() => {
              if (!detail) {
                return
              }

              setMarkingTaskId(record.taskId)

              void markCurrentBestModelResult(detail.id, record.taskId, token)
                .then((response) => {
                  onDetailChange?.(response)
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
            {detail?.currentBestTaskId === record.taskId ? '最佳结果' : '设为最佳'}
          </Button>
        </Space>
      ),
    },
  ]

  const datasetColumns: TableColumnsType<DatasetSummary> = [
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
      key: 'currentVersion',
      width: 150,
      render: (_value, record) => formatCurrentVersion(record),
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
      width: 120,
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
            setDatasetDetailOpen(true)
          }}
        >
          版本列表
        </Button>
      ),
    },
  ]

  const datasetVersionColumns: TableColumnsType<DatasetVersionSummary> = [
    {
      title: '版本',
      key: 'versionNo',
      width: 140,
      render: (_value, record) => formatVersionNo(record.versionNo),
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
      key: 'parentVersion',
      width: 140,
      render: (_value, record) => formatVersionNo(record.parentVersionNo) === '暂无' ? '无' : formatVersionNo(record.parentVersionNo),
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
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_value, record) => (
        <Button
          loading={downloadingDatasetVersionId === record.id}
          onClick={() => {
            if (!datasetDetail) {
              return
            }

            setDownloadingDatasetVersionId(record.id)

            // 项目详情内的数据集版本列表与 datasets 页面共用同一下载接口，保持行为一致。
            void downloadDatasetVersionFile(
              `/api/v1/datasets/${datasetDetail.id}/versions/${record.id}/download`,
              token,
            )
              .catch((error) => {
                message.error(error instanceof Error ? error.message : '数据集版本下载失败')
              })
              .finally(() => {
                setDownloadingDatasetVersionId(null)
              })
          }}
        >
          下载
        </Button>
      ),
    },
  ]

  return (
    <>
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
        <Tabs
          defaultActiveKey="overview"
          items={[
            {
              key: 'overview',
              label: '概览',
              children: (
                <Descriptions bordered size="small" column={2}>
                  <Descriptions.Item label="项目状态">
                    <Tag
                      bordered={false}
                      className="status-tag"
                      color={detail?.status === 'active' ? '#E6F4FF' : '#FAFAFA'}
                      style={{ color: detail?.status === 'active' ? '#1677FF' : '#4E5969' }}
                    >
                      {detail?.statusLabel || '暂无'}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="项目数据集数量">
                    {detail?.datasets.length ?? 0}
                  </Descriptions.Item>
                  <Descriptions.Item label="任务数量">
                    {detail?.tasks.length ?? 0}
                  </Descriptions.Item>
                  <Descriptions.Item label="模型结果数量">
                    {detail?.results.length ?? 0}
                  </Descriptions.Item>
                  <Descriptions.Item label="最近一次训练结果" span={2}>
                    {detail?.latestModelResult
                      ? `${detail.latestModelResult.taskTitle} / ${detail.latestModelResult.modelFileName}`
                      : '暂无'}
                  </Descriptions.Item>
                  <Descriptions.Item label="当前最佳结果" span={2}>
                    {detail?.currentBestResult
                      ? `${detail.currentBestResult.taskTitle} / ${detail.currentBestResult.modelFileName}`
                      : '暂无'}
                  </Descriptions.Item>
                </Descriptions>
              ),
            },
            {
              key: 'tasks',
              label: '项目任务',
              children: (
                <>
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
                </>
              ),
            },
            {
              key: 'results',
              label: '模型结果',
              children: (
                <>
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
                </>
              ),
            },
            {
              key: 'datasets',
              label: '数据集',
              children: (
                <>
                  <div className="table-card-toolbar">
                    <div className="toolbar-copy">
                      <Typography.Title level={5}>项目数据集</Typography.Title>
                      <Typography.Text className="muted-text">
                        聚合查看当前项目下各任务自动沉淀的数据集及其版本状态。
                      </Typography.Text>
                    </div>
                  </div>

                  <div ref={datasetTableRef} className="table-scroll-host">
                    <Table<DatasetSummary>
                      rowKey="id"
                      loading={loading}
                      columns={datasetColumns}
                      dataSource={detail?.datasets ?? []}
                      scroll={datasetScrollY ? { y: datasetScrollY } : undefined}
                      pagination={false}
                      locale={{ emptyText: '当前项目暂无数据集' }}
                    />
                  </div>
                </>
              ),
            },
          ]}
        />
      </Card>

      <Drawer
        open={datasetDetailOpen}
        width={820}
        title={datasetDetail?.name ?? '项目数据集详情'}
        onClose={() => {
          setDatasetDetailOpen(false)
          setSelectedDatasetId(null)
          setDatasetDetail(null)
        }}
        destroyOnClose
        loading={datasetDetailLoading}
      >
        {datasetDetail ? (
          <div className="detail-stack">
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="所属任务">{datasetDetail.taskTitle}</Descriptions.Item>
              <Descriptions.Item label="当前版本">
                {formatCurrentVersion(datasetDetail)}
              </Descriptions.Item>
              <Descriptions.Item label="模态">{datasetDetail.modality}</Descriptions.Item>
              <Descriptions.Item label="版本数量">{datasetDetail.versionCount}</Descriptions.Item>
              <Descriptions.Item label="创建人">{datasetDetail.creator.username}</Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {formatDate(datasetDetail.createdAt)}
              </Descriptions.Item>
              <Descriptions.Item label="数据集描述" span={2}>
                {datasetDetail.description || '暂无描述'}
              </Descriptions.Item>
            </Descriptions>

            <Card className="panel-card page-table-card">
              <div className="table-card-toolbar">
                <div className="toolbar-copy">
                  <Typography.Title level={5}>版本列表</Typography.Title>
                  <Typography.Text className="muted-text">
                    版本按创建时间倒序展示，用于追踪原始输入、清洗和标注的演进关系。
                  </Typography.Text>
                </div>
              </div>

              <Table<DatasetVersionSummary>
                rowKey="id"
                columns={datasetVersionColumns}
                dataSource={datasetDetail.versions}
                pagination={false}
                locale={{ emptyText: '当前数据集暂无版本' }}
              />
            </Card>
          </div>
        ) : null}
      </Drawer>
    </>
  )
}

export default ProjectDetailContent
