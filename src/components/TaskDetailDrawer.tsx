import {
  Alert,
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Input,
  List,
  Space,
  Tag,
  Typography,
  message,
} from 'antd'
import { useEffect, useState } from 'react'
import { completeTaskStage, downloadTaskFile, getTaskDetail } from '../api/client'
import { useAuth } from '../context/AuthContext'
import type { TaskDetail, UploadedFileRef, UserRole } from '../types/models'
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
      description: '文件会先上传到临时区，点击完成后再正式挂到任务记录。当前阶段仅支持压缩包格式。',
    }
  }

  return {
    acceptedExtensions: undefined,
    fileTypeHint: '模型文件类型不限',
    description: '文件会先上传到临时区，点击完成后再正式挂到任务记录。当前阶段可上传任意模型结果文件。',
  }
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
  const uploadRule = getStageUploadRule(task?.currentStage.role ?? null)

  useEffect(() => {
    if (!open || !taskId || !session) {
      return
    }

    setLoading(true)
    setRemark('')
    setUploadedFile(null)

    void getTaskDetail(taskId, session.token)
      .then((detail) => {
        setTask(detail)
      })
      .catch((error) => {
        message.error(error instanceof Error ? error.message : '任务详情加载失败')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [open, session, taskId])

  return (
    <Drawer
      open={open}
      title={task ? task.title : '任务详情'}
      width={620}
      onClose={onClose}
      destroyOnClose
      loading={loading}
    >
      {!task ? (
        <Empty description="暂无任务详情" />
      ) : (
        <div className="detail-stack">
          <Descriptions
            bordered
            size="small"
            column={1}
            items={[
              {
                key: 'status',
                label: '当前状态',
                children: (
                  <Tag color={task.canHandle ? 'processing' : 'default'}>
                    {task.statusLabel}
                  </Tag>
                ),
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
            <Typography.Title level={5}>可下载文件</Typography.Title>
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
                      <Button
                        key="download"
                        size="small"
                        onClick={() => {
                          if (!session) {
                            return
                          }

                          void downloadTaskFile(
                            item.endpoint,
                            item.fileName,
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
                    ]}
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

          <Card size="small" className="panel-card">
            <Typography.Title level={5}>阶段备注</Typography.Title>
            <div className="remark-list">
              <div>
                <Typography.Text strong>清洗备注</Typography.Text>
                <Typography.Paragraph className="muted-paragraph">
                  {task.remarks.cleaner || '暂无'}
                </Typography.Paragraph>
              </div>
              <div>
                <Typography.Text strong>标注备注</Typography.Text>
                <Typography.Paragraph className="muted-paragraph">
                  {task.remarks.annotator || '暂无'}
                </Typography.Paragraph>
              </div>
              <div>
                <Typography.Text strong>训练备注</Typography.Text>
                <Typography.Paragraph className="muted-paragraph">
                  {task.remarks.trainer || '暂无'}
                </Typography.Paragraph>
              </div>
            </div>
          </Card>

          {task.canSubmitCurrentStage ? (
            <Card size="small" className="panel-card">
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Alert
                  type="info"
                  showIcon
                  message={`当前阶段：${task.currentStage.label}`}
                  description="上传当前阶段产物并填写备注后，任务会自动流转到下一阶段。"
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
                        setTask(detail)
                        setRemark('')
                        setUploadedFile(null)
                        message.success('任务阶段已提交')
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
                  {getSubmitButtonLabel(task)}
                </Button>
              </Space>
            </Card>
          ) : null}
        </div>
      )}
    </Drawer>
  )
}

export default TaskDetailDrawer
