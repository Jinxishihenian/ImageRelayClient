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
  Tooltip,
  Typography,
  message,
} from 'antd'
import { useEffect, useRef, useState, useTransition } from 'react'
import {
  saveTaskStageDraft,
  completeTaskStage,
  downloadTaskFile,
  downloadTaskStageDraft,
  getTaskDetail,
  getTaskFileJsonContent,
  getTaskFileDownloadLink,
  getTaskStageDraftDownloadLink,
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
const JSON_EXTENSIONS = ['.json']
const JSON_FILE_HINT = 'json 清单文件'
const CLEANED_TEMPLATE_CONTENT = JSON.stringify(
  ['a.png', 'b.png'],
  null,
  2,
)
const JSON_MODAL_BODY_MAX_HEIGHT = 'calc(100vh - 280px)'

function isJsonFileName(fileName: string): boolean {
  return fileName.toLowerCase().endsWith('.json')
}

function mapDraftToUploadedFile(draft: TaskDetail['currentStageDraft']): UploadedFileRef | null {
  if (!draft) {
    return null
  }

  return {
    storageKey: draft.storageKey,
    originalName: draft.fileName,
    mimeType: 'application/octet-stream',
    // 草稿回填使用服务端真实文件大小，避免详情页重新打开后始终显示 0B。
    size: draft.size,
  }
}

function getSubmitButtonLabel(task: TaskDetail) {
  switch (task.currentStage.role) {
    case 'cleaner':
      return '保存清洗'
    case 'annotator':
      return '保存标注'
    case 'trainer':
      return '保存训练'
    default:
      return '任务已完成'
  }
}

function getConfirmSubmitButtonLabel(task: TaskDetail) {
  switch (task.currentStage.role) {
    case 'cleaner':
      return '提交清洗'
    case 'annotator':
      return '提交标注'
    case 'trainer':
      return '提交训练'
    default:
      return '提交'
  }
}

function getStageUploadRule(role: UserRole | null) {
  if (role === 'cleaner') {
    return {
      acceptedExtensions: JSON_EXTENSIONS,
      fileTypeHint: JSON_FILE_HINT,
      description:
        '清洗阶段只上传 JSON 清单文件。JSON 顶层必须是字符串数组，内容为初始 zip 中保留可用图片的文件名列表，例如 ["a.png", "b.png"]；若存在重名文件，再改用完整路径。',
    }
  }

  if (role === 'annotator') {
    return {
      acceptedExtensions: ARCHIVE_EXTENSIONS,
      fileTypeHint: ARCHIVE_FILE_HINT,
      description:
        '文件会先上传到临时区，点击完成后再正式挂到任务记录。标注阶段当前仅支持 zip / rar / 7z 压缩包，且 zip 包内只允许 .txt 文件；提交后仅支持下载，不提供预览。',
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

function getTaskStatusTagClassName(canHandle: boolean) {
  return canHandle ? 'status-tag status-tag-info' : 'status-tag status-tag-neutral'
}

function getSubmitCardDescription(task: TaskDetail) {
  if (task.currentStage.role === 'cleaner') {
    const baseDescription = '上传 JSON 清单后，后端会按清单从初始 zip 中直接引用对应图片，动态生成清洗结果，不会重新上传重复图片。点击“保存清洗”仅保存草稿，不会立即流转。'

    if (task.currentStageNeedsReview) {
      return `${baseDescription} 点击“提交清洗”后，任务才会进入等待管理员复核；若审核未通过，可重新修改并再次保存草稿。`
    }

    return `${baseDescription} 点击“提交清洗”后，任务才会自动流转到下一阶段。`
  }

  if (task.currentStageNeedsReview) {
    return `上传当前阶段产物并填写备注后，点击“${getSubmitButtonLabel(task)}”会先保存草稿。只有点击“${getConfirmSubmitButtonLabel(task)}”后，任务才会进入等待管理员复核；若审核未通过，可继续修改并重新保存草稿。`
  }

  return `上传当前阶段产物并填写备注后，点击“${getSubmitButtonLabel(task)}”会先保存草稿。只有点击“${getConfirmSubmitButtonLabel(task)}”后，任务才会正式流转到下一阶段。`
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

function QuestionCircleOutlined({ className }: { className?: string }) {
  return (
    <span className={className} role="img" aria-label="question-circle">
      <svg viewBox="64 64 896 896" focusable="false" aria-hidden="true">
        <path
          d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm0 820c-205.4 0-372-166.6-372-372s166.6-372 372-372 372 166.6 372 372-166.6 372-372 372z"/>
        <path
          d="M623.6 316.7C593.6 290.4 554 276 512 276s-81.6 14.5-111.6 40.7C369.2 344 352 380.7 352 420v7.6c0 4.4 3.6 8 8 8h48c4.4 0 8-3.6 8-8V420c0-44.1 43.1-80 96-80s96 35.9 96 80c0 31.1-22 59.6-56.1 72.7-21.2 8.1-39.2 22.3-52.1 40.9-13.1 19-19.9 41.8-19.9 64.9V620c0 4.4 3.6 8 8 8h48c4.4 0 8-3.6 8-8v-22.7a48.3 48.3 0 0130.9-44.8c59-22.7 97.1-74.7 97.1-132.5.1-39.3-17.1-76-48.3-103.3zM472 732a40 40 0 1080 0 40 40 0 10-80 0z"/>
      </svg>
    </span>
  )
}

function renderLabelWithTooltip(label: string, tooltipTitle: string) {
  return (
    <span className="detail-label-with-tooltip">
      <span>{label}</span>
      <Tooltip title={tooltipTitle}>
        <QuestionCircleOutlined className="detail-label-tooltip-icon"/>
      </Tooltip>
    </span>
  )
}

function TaskDetailDrawer({
                            taskId,
                            open,
                            onClose,
                            onTaskChanged,
                          }: TaskDetailDrawerProps) {
  const { session } = useAuth()
  const detailRequestIdRef = useRef(0)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [task, setTask] = useState<TaskDetail | null>(null)
  const [remark, setRemark] = useState('')
  const [uploadedFile, setUploadedFile] = useState<UploadedFileRef | null>(null)
  const [previewTarget, setPreviewTarget] = useState<{
    endpoint: string
    label: string
  } | null>(null)
  const [jsonPreviewTarget, setJsonPreviewTarget] = useState<{
    endpoint: string
    label: string
    fileName: string
  } | null>(null)
  const [jsonPreviewLoading, setJsonPreviewLoading] = useState(false)
  const [jsonPreviewContent, setJsonPreviewContent] = useState('')
  const [jsonPreviewError, setJsonPreviewError] = useState<string | null>(null)
  const [exampleJsonModalOpen, setExampleJsonModalOpen] = useState(false)
  const [reviewCommentDraft, setReviewCommentDraft] = useState('')
  const [, startTransition] = useTransition()
  const jsonPreviewRequestIdRef = useRef(0)
  const uploadRule = getStageUploadRule(task?.currentStage.role ?? null)
  const uploadPurpose = getStageUploadPurpose(task?.currentStage.role ?? null)
  const currentStageDraft = task?.currentStageDraft ?? null
  const hasUnsavedDraftChanges = currentStageDraft
    ? uploadedFile?.storageKey !== currentStageDraft.storageKey || remark !== (currentStageDraft.remark ?? '')
    : Boolean(uploadedFile) || remark.trim().length > 0

  useEffect(() => {
    if (!jsonPreviewTarget || !session) {
      return
    }

    const requestId = jsonPreviewRequestIdRef.current + 1
    jsonPreviewRequestIdRef.current = requestId
    setJsonPreviewLoading(true)
    setJsonPreviewContent('')
    setJsonPreviewError(null)

    void getTaskFileJsonContent(jsonPreviewTarget.endpoint, session.token)
      .then((content) => {
        if (jsonPreviewRequestIdRef.current !== requestId) {
          return
        }

        setJsonPreviewContent(content)
      })
      .catch((error) => {
        if (jsonPreviewRequestIdRef.current !== requestId) {
          return
        }

        setJsonPreviewError(error instanceof Error ? error.message : 'JSON 内容加载失败')
      })
      .finally(() => {
        if (jsonPreviewRequestIdRef.current === requestId) {
          setJsonPreviewLoading(false)
        }
      })
  }, [jsonPreviewTarget, session])

  useEffect(() => {
    if (!open || !taskId || !session) {
      return
    }

    const requestId = detailRequestIdRef.current + 1
    detailRequestIdRef.current = requestId

    queueMicrotask(() => {
      setLoading(true)
      setRemark('')
      setUploadedFile(null)
      setReviewCommentDraft('')

      void getTaskDetail(taskId, session.token)
        .then((detail) => {
          if (detailRequestIdRef.current !== requestId) {
            return
          }

          startTransition(() => {
            setTask(detail)
          })
          setRemark(detail.currentStageDraft?.remark ?? '')
          setUploadedFile(mapDraftToUploadedFile(detail.currentStageDraft))
        })
        .catch((error) => {
          if (detailRequestIdRef.current !== requestId) {
            return
          }

          message.error(error instanceof Error ? error.message : '任务详情加载失败')
        })
        .finally(() => {
          if (detailRequestIdRef.current === requestId) {
            setLoading(false)
          }
        })
    })
  }, [open, session, startTransition, taskId])

  return (
    <Drawer
      open={open}
      title={task ? task.title : '任务详情'}
      width={620}
      onClose={() => {
        detailRequestIdRef.current += 1
        setTask(null)
        setRemark('')
        setUploadedFile(null)
        setPreviewTarget(null)
        jsonPreviewRequestIdRef.current += 1
        setJsonPreviewTarget(null)
        setJsonPreviewLoading(false)
        setJsonPreviewContent('')
        setJsonPreviewError(null)
        setExampleJsonModalOpen(false)
        setReviewCommentDraft('')
        setLoading(false)
        onClose()
      }}
      destroyOnClose
      loading={loading}
    >
      {!task ? (
        <Empty description="暂无任务详情"/>
      ) : (
        <div className="detail-stack task-detail-stack">
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
                      className={getTaskStatusTagClassName(task.canHandle)}
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
                renderItem={(item) => {
                  const isJsonDownload = isJsonFileName(item.fileName)

                  return (
                    <List.Item
                      actions={isJsonDownload ? [
                        <Button
                          key="view-json"
                          size="small"
                          onClick={() => {
                            setJsonPreviewTarget({
                              endpoint: item.endpoint,
                              label: item.label,
                              fileName: item.fileName,
                            })
                          }}
                        >
                          查看 JSON
                        </Button>,
                      ] : [
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
                  )
                }}
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

            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Alert
                type="info"
                showIcon
                message={renderLabelWithTooltip(
                  `当前阶段：${task.currentStage.label}`,
                  getSubmitCardDescription(task),
                )}
              />

              {task.currentStageDraft ? (
                (() => {
                  const currentStageDraft = task.currentStageDraft

                  return (
                    <Card size="small">
                      <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        {/*<Alert*/}
                        {/*  type="success"*/}
                        {/*  showIcon*/}
                        {/*  message="已存草稿"*/}
                        {/*  description={`已保存草稿：${currentStageDraft.fileName}${currentStageDraft.savedAt ? `，保存时间 ${new Date(currentStageDraft.savedAt).toLocaleString('zh-CN', { hour12: false })}` : ''}`}*/}
                        {/*/>*/}
                        <div className="remark-section">
                          <Typography.Text strong>当前阶段草稿</Typography.Text>
                          <Typography.Paragraph className="muted-paragraph">
                            {currentStageDraft.fileName} · {`${currentStageDraft.size < 1024 ? `${currentStageDraft.size} B` : currentStageDraft.size < 1024 * 1024 ? `${(currentStageDraft.size / 1024).toFixed(1)} KB` : `${(currentStageDraft.size / (1024 * 1024)).toFixed(1)} MB`}`}
                          </Typography.Paragraph>
                        </div>
                        {session ? (
                          <Space wrap>
                            {(() => {
                              const previewEndpoint = currentStageDraft.previewEndpoint

                              return currentStageDraft.canPreview && previewEndpoint ? (
                                <Button
                                  size="small"
                                  onClick={() => {
                                    setPreviewTarget({
                                      endpoint: previewEndpoint,
                                      label: `${task.currentStage.label}草稿预览`,
                                    })
                                  }}
                                >
                                  预览草稿
                                </Button>
                              ) : null
                            })()}
                            <Button
                              size="small"
                              onClick={() => {
                                void getTaskStageDraftDownloadLink(
                                  currentStageDraft.downloadLinkEndpoint,
                                  session.token,
                                )
                                  .then((payload) => {
                                    copyTextToClipboard(payload.url)
                                    message.success('草稿下载链接已复制，可直接粘贴到浏览器地址栏下载')
                                  })
                                  .catch((error) => {
                                    message.error(
                                      error instanceof Error ? error.message : '复制草稿下载链接失败',
                                    )
                                  })
                              }}
                            >
                              复制草稿链接
                            </Button>
                            <Button
                              size="small"
                              onClick={() => {
                                void downloadTaskStageDraft(
                                  currentStageDraft.downloadLinkEndpoint,
                                  session.token,
                                ).catch((error) => {
                                  message.error(
                                    error instanceof Error ? error.message : '草稿下载失败',
                                  )
                                })
                              }}
                            >
                              下载草稿
                            </Button>
                          </Space>
                        ) : null}
                      </Space>
                    </Card>
                  )
                })()
              ) : null}

              {hasUnsavedDraftChanges ? (
                <Alert
                  type="warning"
                  showIcon
                  message="当前修改未保存"
                  description={`请先点“${getSubmitButtonLabel(task)}”，再点“${getConfirmSubmitButtonLabel(task)}”。`}
                />
              ) : null}

              {session ? (
                <FileUploadField
                  label={renderLabelWithTooltip('阶段结果文件', uploadRule.description)}
                  token={session.token}
                  value={uploadedFile}
                  onChange={setUploadedFile}
                  acceptedExtensions={uploadRule.acceptedExtensions}
                  fileTypeHint={uploadRule.fileTypeHint}
                  uploadPurpose={uploadPurpose}
                  extraActions={task.currentStage.role === 'cleaner' ? (
                    <Button
                      onClick={() => {
                        setExampleJsonModalOpen(true)
                      }}
                      disabled={submitting}
                    >
                      查看示例
                    </Button>
                  ) : null}
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
              <div
                className="flex"
                style={{
                  display: 'flex',
                  // 两个主操作按钮需要保留固定横向间距，避免“保存”和“提交”贴在一起。
                  gap: 8,
                }}
              >
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

                    void saveTaskStageDraft(
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
                        setRemark(detail?.currentStageDraft?.remark ?? '')
                        setUploadedFile(mapDraftToUploadedFile(detail?.currentStageDraft ?? null))
                        message.success('已存草稿')
                        onTaskChanged()
                      })
                      .catch((error) => {
                        message.error(
                          error instanceof Error ? error.message : '保存阶段草稿失败',
                        )
                      })
                      .finally(() => {
                        setSubmitting(false)
                      })
                  }}
                >
                  {task.canResubmitCurrentStage ? `重新${getSubmitButtonLabel(task)}` : getSubmitButtonLabel(task)}
                </Button>
                <Button
                  loading={submitting}
                  disabled={!task.hasCurrentStageDraft || hasUnsavedDraftChanges}
                  onClick={() => {
                    if (!session || !taskId) {
                      return
                    }

                    if (!task.hasCurrentStageDraft) {
                      message.warning(`请先点击“${getSubmitButtonLabel(task)}”保存草稿`)
                      return
                    }

                    if (hasUnsavedDraftChanges) {
                      message.warning(`当前修改未保存，请先点击“${getSubmitButtonLabel(task)}”`)
                      return
                    }

                    setSubmitting(true)

                    void completeTaskStage(taskId, session.token)
                      .then((detail) => {
                        startTransition(() => {
                          setTask(detail)
                        })
                        setRemark(detail?.currentStageDraft?.remark ?? '')
                        setUploadedFile(mapDraftToUploadedFile(detail?.currentStageDraft ?? null))
                        message.success(
                          task.currentStageNeedsReview ? '已提交，待复核' : '已提交',
                        )
                        onTaskChanged()
                      })
                      .catch((error) => {
                        message.error(
                          error instanceof Error ? error.message : '确认提交阶段失败',
                        )
                      })
                      .finally(() => {
                        setSubmitting(false)
                      })
                  }}
                >
                  {getConfirmSubmitButtonLabel(task)}
                </Button>
              </div>

            </Space>

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

      <Modal
        open={Boolean(jsonPreviewTarget)}
        title={jsonPreviewTarget ? `${jsonPreviewTarget.label} 内容` : 'JSON 内容'}
        width={860}
        destroyOnClose
        onCancel={() => {
          jsonPreviewRequestIdRef.current += 1
          setJsonPreviewTarget(null)
          setJsonPreviewLoading(false)
          setJsonPreviewContent('')
          setJsonPreviewError(null)
        }}
        footer={[
          <Button
            key="copy-json"
            type="primary"
            disabled={!jsonPreviewContent || jsonPreviewLoading}
            onClick={() => {
              try {
                copyTextToClipboard(jsonPreviewContent)
                message.success('JSON 内容已复制')
              } catch (error) {
                message.error(
                  error instanceof Error ? error.message : '复制 JSON 内容失败',
                )
              }
            }}
          >
            复制内容
          </Button>,
          <Button
            key="close-json"
            onClick={() => {
              jsonPreviewRequestIdRef.current += 1
              setJsonPreviewTarget(null)
              setJsonPreviewLoading(false)
              setJsonPreviewContent('')
              setJsonPreviewError(null)
            }}
          >
            关闭
          </Button>,
        ]}
      >
        {jsonPreviewLoading ? (
          <div className="json-preview-loading">
            <Typography.Text className="muted-text">JSON 内容加载中...</Typography.Text>
          </div>
        ) : jsonPreviewError ? (
          <Alert
            type="error"
            showIcon
            message="无法打开 JSON 预览"
            description={jsonPreviewError}
          />
        ) : (
          <div className="json-preview-stack">
            <Typography.Text className="muted-text">
              {jsonPreviewTarget?.fileName}
            </Typography.Text>
            <pre
              className="json-preview-content"
              style={{
                maxHeight: JSON_MODAL_BODY_MAX_HEIGHT,
              }}
            >
              {jsonPreviewContent}
            </pre>
          </div>
        )}
      </Modal>

      <Modal
        open={exampleJsonModalOpen}
        title="清洗结果示例"
        width={860}
        destroyOnClose
        onCancel={() => {
          setExampleJsonModalOpen(false)
        }}
        footer={[
          <Button
            key="copy-example-json"
            type="primary"
            onClick={() => {
              try {
                copyTextToClipboard(CLEANED_TEMPLATE_CONTENT)
                message.success('示例 JSON 已复制')
              } catch (error) {
                message.error(
                  error instanceof Error ? error.message : '复制示例 JSON 失败',
                )
              }
            }}
          >
            复制内容
          </Button>,
          <Button
            key="close-example-json"
            onClick={() => {
              setExampleJsonModalOpen(false)
            }}
          >
            关闭
          </Button>,
        ]}
      >
        <div className="json-preview-stack">
          <Typography.Text className="muted-text">
            清洗阶段请上传 JSON 字符串数组，内容为保留图片文件名列表。
          </Typography.Text>
          <pre
            className="json-preview-content"
            style={{
              maxHeight: JSON_MODAL_BODY_MAX_HEIGHT,
            }}
          >
            {CLEANED_TEMPLATE_CONTENT}
          </pre>
        </div>
      </Modal>
    </Drawer>
  )
}

export default TaskDetailDrawer
