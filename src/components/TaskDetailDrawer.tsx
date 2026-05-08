import {
  Alert,
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Input,
  List,
  Modal,
  Space,
  Tag,
  Typography,
  message,
} from 'antd'
import { useEffect, useState, useTransition } from 'react'
import {
  completeTaskStage,
  downloadTaskFile,
  getTaskDetail,
  getTaskFileDownloadLink,
  reviewTaskStage,
} from '../api/client'
import { useAuth } from '../context/useAuth'
import type {
  TaskDetail,
  UploadedFileRef,
  UploadPurpose,
  UserRole,
} from '../types/models'
import { copyTextToClipboard } from '../utils/clipboard'
import ArchivePreviewModal from './ArchivePreviewModal'
import FileUploadField from './FileUploadField'

type TaskDetailDrawerProps = {
  taskId: number | null
  open: boolean
  onClose: () => void
  onTaskChanged: () => void
}

const ARCHIVE_EXTENSIONS = ['.zip', '.rar', '.7z']
const ARCHIVE_FILE_HINT = 'zip / rar / 7z 压缩包'

function getSubmitButtonLabel(task: TaskDetail) {
  switch (task.currentStage.role) {
    case 'cleaner':
      return '完成清洗'
    case 'annotator':
      return '完成标注'
    case 'trainer':
      return '完成训练'
    default:
      return '任务已完成'
  }
}

function getStageUploadRule(role: UserRole | null) {
  if (role === 'cleaner' || role === 'annotator') {
    return {
      acceptedExtensions: ARCHIVE_EXTENSIONS,
      fileTypeHint: ARCHIVE_FILE_HINT,
      description:
        '文件会先上传到临时区，点击完成后再正式挂到任务记录。当前阶段仅支持压缩包格式。',
    }
  }

  return {
    acceptedExtensions: undefined,
    fileTypeHint: '模型文件类型不限',
    description:
      '文件会先上传到临时区，点击完成后再正式挂到任务记录。当前阶段可上传任意模型结果文件。',
  }
}

function getStageUploadPurpose(role: UserRole | null): UploadPurpose | undefined {
  switch (role) {
    case 'cleaner':
      return 'task_cleaned'
    case 'annotator':
      return 'task_annotated'
    case 'trainer':
      return 'task_model'
    default:
      return undefined
  }
}

function getTaskStatusTagStyle(canHandle: boolean) {
  return canHandle
    ? {
        background: '#E6F4FF',
        color: '#1677FF',
      }
    : {
        background: '#FAFAFA',
        color: '#4E5969',
      }
}

function getSubmitCardDescription(task: TaskDetail) {
  if (task.currentStageNeedsReview) {
    return '上传当前阶段产物并填写备注后，任务会进入等待管理员复核；若审核未通过，可在当前阶段重新提交。'
  }

  return '上传当前阶段产物并填写备注后，任务会自动流转到下一阶段。'
}

function getApprovalStageLabels(task: TaskDetail) {
  const labels: string[] = []

  if (task.needCleanReview) {
    labels.push('数据清洗')
  }

  if (task.needAnnotateReview) {
    labels.push('数据标注')
  }

  if (task.needTrainReview) {
    labels.push('模型训练')
  }

  return labels.length > 0 ? labels.join('、') : '无'
}

function renderDatasetKeyVersion(label: string, value: TaskDetail['dataset'] extends infer T
  ? T extends { keyVersions: infer K }
    ? K[keyof K]
    : never
  : never,
) {
  return (
    <div className="remark-section">
      <Typography.Text strong>{label}</Typography.Text>
      <Typography.Paragraph className="muted-paragraph">
        {value ? `${value.label} / ${new Date(value.createdAt).toLocaleString('zh-CN', { hour12: false })}` : '暂无'}
      </Typography.Paragraph>
    </div>
  )
}

function TaskDetailDrawer({
  taskId,
  open,
  onClose,
  onTaskChanged,
}: TaskDetailDrawerProps) {
  const { session } = useAuth()
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [task, setTask] = useState<TaskDetail | null>(null)
  const [remark, setRemark] = useState('')
  const [uploadedFile, setUploadedFile] = useState<UploadedFileRef | null>(null)
  const [previewTarget, setPreviewTarget] = useState<{
    endpoint: string
    label: string
  } | null>(null)
  const [reviewCommentDraft, setReviewCommentDraft] = useState('')
  const [, startTransition] = useTransition()
  const uploadRule = getStageUploadRule(task?.currentStage.role ?? null)
  const uploadPurpose = getStageUploadPurpose(task?.currentStage.role ?? null)

  useEffect(() => {
    if (!open || !taskId || !session) {
      return
    }

    queueMicrotask(() => {
      setLoading(true)
      setRemark('')
      setUploadedFile(null)
      setReviewCommentDraft('')

      void getTaskDetail(taskId, session.token)
        .then((detail) => {
          startTransition(() => {
            setTask(detail)
          })
        })
        .catch((error) => {
          message.error(error instanceof Error ? error.message : '任务详情加载失败')
        })
        .finally(() => {
          setLoading(false)
        })
    })
  }, [open, session, startTransition, taskId])

  return (
    <Drawer
      open={open}
      title={task ? task.title : '任务详情'}
      width={620}
      onClose={() => {
        setTask(null)
        setRemark('')
        setUploadedFile(null)
        setPreviewTarget(null)
        setReviewCommentDraft('')
        setLoading(false)
        onClose()
      }}
      destroyOnClose
      loading={loading}
    >
      {!task ? (
        <Empty description="暂无任务详情" />
      ) : (
        <div className="detail-stack">
          <Descriptions
            className="drawer-descriptions"
            bordered
            size="small"
            column={1}
            items={[
              {
                key: 'status',
                label: '当前状态',
                children: (() => {
                  const tagStyle = getTaskStatusTagStyle(task.canHandle)

                  return (
                    <Tag
                      bordered={false}
                      className="status-tag"
                      color={tagStyle.background}
                      style={{ color: tagStyle.color }}
                    >
                      {task.statusLabel}
                    </Tag>
                  )
                })(),
              },
              {
                key: 'approvalStages',
                label: '审批流程控制',
                children: getApprovalStageLabels(task),
              },
              {
                key: 'reviewStatus',
                label: '审核状态',
                children: task.currentStageNeedsReview ? task.reviewStatusLabel : '不适用',
              },
              {
                key: 'modelIteration',
                label: '所属项目',
                children: task.modelIteration.name,
              },
              {
                key: 'description',
                label: '任务描述',
                children: task.description || '未填写描述',
              },
              {
                key: 'creator',
                label: '创建人',
                children: task.creator.username,
              },
              {
                key: 'cleaner',
                label: '清洗负责人',
                children: task.assignees.cleaner.username,
              },
              {
                key: 'annotator',
                label: '标注负责人',
                children: task.assignees.annotator.username,
              },
              {
                key: 'trainer',
                label: '训练负责人',
                children: task.assignees.trainer.username,
              },
            ]}
          />

          <Card size="small" className="panel-card">
            <Typography.Title level={5} className="drawer-section-title">
              数据集版本
            </Typography.Title>

            {task.dataset ? (
              <div className="remark-list">
                <div className="remark-section">
                  <Typography.Text strong>数据集</Typography.Text>
                  <Typography.Paragraph className="muted-paragraph">
                    {task.dataset.name}
                  </Typography.Paragraph>
                </div>
                <div className="remark-section">
                  <Typography.Text strong>当前版本</Typography.Text>
                  <Typography.Paragraph className="muted-paragraph">
                    {task.dataset.currentVersion?.label || '暂无'}
                  </Typography.Paragraph>
                </div>
                {renderDatasetKeyVersion('原始版本', task.dataset.keyVersions.raw)}
                {renderDatasetKeyVersion('清洗版本', task.dataset.keyVersions.cleaned)}
                {renderDatasetKeyVersion('标注版本', task.dataset.keyVersions.annotated)}
              </div>
            ) : (
              <Typography.Text className="muted-text">
                当前任务尚未生成数据集
              </Typography.Text>
            )}
          </Card>

          <Card size="small" className="panel-card">
            <Typography.Title level={5} className="drawer-section-title">
              可下载文件
            </Typography.Title>
            {task.downloads.length === 0 ? (
              <Typography.Text className="muted-text">
                当前角色暂无可下载文件
              </Typography.Text>
            ) : (
              <List
                dataSource={task.downloads}
                renderItem={(item) => (
                  <List.Item
                    actions={[
                      item.canPreview && item.previewEndpoint ? (
                        <Button
                          key="preview"
                          size="small"
                          onClick={() => {
                            setPreviewTarget({
                              endpoint: item.previewEndpoint!,
                              label: item.label,
                            })
                          }}
                        >
                          预览
                        </Button>
                      ) : null,
                      <Button
                        key="copy-link"
                        size="small"
                        onClick={() => {
                          if (!session) {
                            return
                          }

                          // 复制的是临时签名下载链接，避免把需要 Authorization 头的接口地址
                          // 直接暴露给用户后却无法在浏览器地址栏中使用。
                          void getTaskFileDownloadLink(
                            `${item.endpoint}-link`,
                            session.token,
                          )
                            .then((payload) => {
                              copyTextToClipboard(payload.url)
                              message.success(
                                '下载链接已复制，可直接粘贴到浏览器地址栏下载',
                              )
                            })
                            .catch((error) => {
                              message.error(
                                error instanceof Error
                                  ? error.message
                                  : '复制下载链接失败',
                              )
                            })
                        }}
                      >
                        复制链接
                      </Button>,
                      <Button
                        key="download"
                        size="small"
                        onClick={() => {
                          if (!session) {
                            return
                          }

                          void downloadTaskFile(
                            item.endpoint,
                            session.token,
                          ).catch((error) => {
                            message.error(
                              error instanceof Error ? error.message : '文件下载失败',
                            )
                          })
                        }}
                      >
                        下载
                      </Button>,
                    ].filter(Boolean)}
                  >
                    <List.Item.Meta
                      title={item.label}
                      description={item.fileName}
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>

          {task.currentStageNeedsReview && task.reviewComment ? (
            <Alert
              type={task.reviewStatus === 'rejected' ? 'error' : 'info'}
              showIcon
              message={
                task.reviewStatus === 'rejected' ? '管理员审核未通过' : '管理员审核备注'
              }
              description={task.reviewComment}
            />
          ) : null}

          <Card size="small" className="panel-card">
            <Typography.Title level={5} className="drawer-section-title">
              阶段备注
            </Typography.Title>
            <div className="remark-list">
              <div className="remark-section">
                <Typography.Text strong>清洗备注</Typography.Text>
                <Typography.Paragraph className="muted-paragraph">
                  {task.remarks.cleaner || '暂无'}
                </Typography.Paragraph>
              </div>
              <div className="remark-section">
                <Typography.Text strong>标注备注</Typography.Text>
                <Typography.Paragraph className="muted-paragraph">
                  {task.remarks.annotator || '暂无'}
                </Typography.Paragraph>
              </div>
              <div className="remark-section">
                <Typography.Text strong>训练备注</Typography.Text>
                <Typography.Paragraph className="muted-paragraph">
                  {task.remarks.trainer || '暂无'}
                </Typography.Paragraph>
              </div>
            </div>
          </Card>

          {task.canSubmitCurrentStage ? (
            <Card size="small" className="panel-card stage-submit-card">
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Alert
                  type="info"
                  showIcon
                  message={`当前阶段：${task.currentStage.label}`}
                  description={getSubmitCardDescription(task)}
                />

                {session ? (
                  <FileUploadField
                    label="阶段结果文件"
                    token={session.token}
                    value={uploadedFile}
                    onChange={setUploadedFile}
                    description={uploadRule.description}
                    acceptedExtensions={uploadRule.acceptedExtensions}
                    fileTypeHint={uploadRule.fileTypeHint}
                    uploadPurpose={uploadPurpose}
                  />
                ) : null}

                <div>
                  <Typography.Text strong>阶段备注</Typography.Text>
                  <Input.TextArea
                    rows={4}
                    value={remark}
                    onChange={(event) => {
                      setRemark(event.target.value)
                    }}
                    placeholder="记录本阶段处理说明、问题和交接要点"
                    style={{ marginTop: 8 }}
                  />
                </div>

                <Button
                  type="primary"
                  loading={submitting}
                  onClick={() => {
                    if (!session || !taskId) {
                      return
                    }

                    if (!uploadedFile) {
                      message.warning('请先上传阶段结果文件')
                      return
                    }

                    setSubmitting(true)

                    void completeTaskStage(
                      taskId,
                      {
                        file: uploadedFile,
                        remark,
                      },
                      session.token,
                    )
                      .then((detail) => {
                        startTransition(() => {
                          setTask(detail)
                        })
                        setRemark('')
                        setUploadedFile(null)
                        message.success(
                          task.currentStageNeedsReview ? '任务阶段已提交，等待管理员复核' : '任务阶段已提交',
                        )
                        onTaskChanged()
                      })
                      .catch((error) => {
                        message.error(
                          error instanceof Error ? error.message : '提交阶段失败',
                        )
                      })
                      .finally(() => {
                        setSubmitting(false)
                      })
                  }}
                >
                  {task.canResubmitCurrentStage ? '重新提交当前阶段' : getSubmitButtonLabel(task)}
                </Button>
              </Space>
            </Card>
          ) : null}

          {task.canReviewCurrentStage && task.reviewStage ? (
            <Card size="small" className="panel-card stage-submit-card">
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Alert
                  type="warning"
                  showIcon
                  message={`待复核内容：${task.reviewStageLabel ?? task.reviewActionLabel ?? '当前阶段结果'}`}
                  description="当前阶段已开启审批。管理员审核通过后才会继续流转；驳回后由当前阶段负责人根据审核意见重新提交。"
                />

                <div>
                  <Typography.Text strong>审核意见</Typography.Text>
                  <Input.TextArea
                    rows={4}
                    value={reviewCommentDraft}
                    onChange={(event) => {
                      setReviewCommentDraft(event.target.value)
                    }}
                    placeholder="通过时可选填说明；驳回时必须填写原因"
                    style={{ marginTop: 8 }}
                  />
                </div>

                <Space>
                  <Button
                    danger
                    loading={submitting}
                    onClick={() => {
                      if (!session || !taskId || !task.reviewStage) {
                        return
                      }

                      const reviewStage = task.reviewStage
                      const normalizedComment = reviewCommentDraft.trim()

                      if (!normalizedComment) {
                        message.warning('驳回时请先填写审核意见')
                        return
                      }

                      Modal.confirm({
                        title: '确认驳回当前阶段结果吗？',
                        content: '驳回后任务将保留在当前主状态，由当前阶段负责人根据审核意见重新提交。',
                        okText: '确认驳回',
                        cancelText: '取消',
                        okButtonProps: {
                          danger: true,
                        },
                        onOk: async () => {
                          setSubmitting(true)

                          try {
                            const detail = await reviewTaskStage(
                              taskId,
                              {
                                action: 'reject',
                                reviewStage,
                                reviewComment: normalizedComment,
                              },
                              session.token,
                            )

                            startTransition(() => {
                              setTask(detail)
                            })
                            setReviewCommentDraft('')
                            message.success('审核已驳回，任务待重新提交')
                            onTaskChanged()
                          } catch (error) {
                            message.error(
                              error instanceof Error ? error.message : '驳回审核失败',
                            )
                          } finally {
                            setSubmitting(false)
                          }
                        },
                      })
                    }}
                  >
                    驳回并退回修改
                  </Button>

                  <Button
                    type="primary"
                    loading={submitting}
                    onClick={() => {
                      if (!session || !taskId || !task.reviewStage) {
                        return
                      }

                      const reviewStage = task.reviewStage
                      setSubmitting(true)

                      void reviewTaskStage(
                        taskId,
                        {
                          action: 'approve',
                          reviewStage,
                          reviewComment: reviewCommentDraft.trim() || undefined,
                        },
                        session.token,
                      )
                        .then((detail) => {
                          startTransition(() => {
                            setTask(detail)
                          })
                          setReviewCommentDraft('')
                          message.success('审核通过，任务已继续流转')
                          onTaskChanged()
                        })
                        .catch((error) => {
                          message.error(
                            error instanceof Error ? error.message : '审核通过失败',
                          )
                        })
                        .finally(() => {
                          setSubmitting(false)
                        })
                    }}
                  >
                    审核通过并流转
                  </Button>
                </Space>
              </Space>
            </Card>
          ) : null}
        </div>
      )}

      {session && previewTarget ? (
        <ArchivePreviewModal
          open
          title={`${previewTarget.label}预览`}
          previewEndpoint={previewTarget.endpoint}
          token={session.token}
          onClose={() => {
            setPreviewTarget(null)
          }}
        />
      ) : null}
    </Drawer>
  )
}

export default TaskDetailDrawer
