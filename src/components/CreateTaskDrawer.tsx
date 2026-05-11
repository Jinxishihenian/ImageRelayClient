import {
  Checkbox,
  Button,
  Drawer,
  Form,
  Input,
  Select,
  Space,
  Typography,
  message,
} from 'antd'
import { useState } from 'react'
import { createTask } from '../api/client'
import { useAuth } from '../context/useAuth'
import type {
  ModelIterationSummary,
  TaskDetail,
  UploadedFileRef,
  UserRole,
  UserSummary,
} from '../types/models'
import FileUploadField from './FileUploadField'

type CreateTaskDrawerProps = {
  open: boolean
  users: UserSummary[]
  modelIterations: ModelIterationSummary[]
  onClose: () => void
  onCreated: (task: TaskDetail | null) => void
}

type CreateTaskFormValues = {
  modelIterationId: number
  title: string
  description: string
  approvalStages: Array<'clean' | 'annotate' | 'train'>
  cleanerId: number
  annotatorId: number
  trainerId: number
}

const ROLE_GROUPS: Array<{ role: UserRole; label: string }> = [
  { role: 'cleaner', label: '数据清洗者' },
  { role: 'annotator', label: '数据标注者' },
  { role: 'trainer', label: '模型训练者' },
]
const ARCHIVE_EXTENSIONS = ['.zip', '.rar', '.7z']
const ARCHIVE_FILE_HINT = 'zip / rar / 7z 压缩包'

function CreateTaskDrawer({
  open,
  users,
  modelIterations,
  onClose,
  onCreated,
}: CreateTaskDrawerProps) {
  const [form] = Form.useForm<CreateTaskFormValues>()
  const { session } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [sourceFile, setSourceFile] = useState<UploadedFileRef | null>(null)

  const handleClose = () => {
    // 统一收口所有关闭路径，避免“取消”或“创建成功后关闭”绕过 Drawer.onClose，
    // 导致下次打开抽屉时仍然保留上一次输入和上传结果。
    form.resetFields()
    setSourceFile(null)
    onClose()
  }

  if (!session) {
    return null
  }

  return (
    <Drawer
      open={open}
      width={520}
      title="创建任务"
      onClose={handleClose}
      destroyOnClose
      extra={
        <Space>
          <Button onClick={handleClose}>取消</Button>
          <Button
            type="primary"
            loading={submitting}
            onClick={() => {
              void form.submit()
            }}
          >
            创建任务
          </Button>
        </Space>
      }
    >
      <Typography.Paragraph className="drawer-helper">
        管理员创建任务时需要上传初始文件、配置审批流程控制，并为三类执行人分别指定负责人。
        标注者当前固定为单人。初始文件仅支持 {ARCHIVE_FILE_HINT}。
      </Typography.Paragraph>

      <Form<CreateTaskFormValues>
        form={form}
        layout="vertical"
        onFinish={async (values) => {
          if (!sourceFile) {
            message.warning('请先上传初始文件')
            return
          }

          setSubmitting(true)

          try {
            const task = await createTask(
              {
                modelIterationId: values.modelIterationId,
                title: values.title,
                description: values.description,
                needCleanReview: values.approvalStages.includes('clean'),
                needAnnotateReview: values.approvalStages.includes('annotate'),
                needTrainReview: values.approvalStages.includes('train'),
                cleanerId: values.cleanerId,
                annotatorId: values.annotatorId,
                trainerId: values.trainerId,
                sourceFile,
              },
              session.token,
            )

            message.success('任务创建成功')
            onCreated(task)
            handleClose()
          } catch (error) {
            message.error(error instanceof Error ? error.message : '任务创建失败')
          } finally {
            setSubmitting(false)
          }
        }}
      >
        <Form.Item
          label="所属项目"
          name="modelIterationId"
          rules={[{ required: true, message: '请选择所属项目' }]}
        >
          <Select
            placeholder="请选择所属项目"
            options={modelIterations.map((item) => ({
              value: item.id,
              label: `${item.name}（${item.statusLabel}）`,
              disabled: item.status !== 'active',
            }))}
          />
        </Form.Item>

        <Form.Item
          label="任务名称"
          name="title"
          rules={[{ required: true, message: '请输入任务名称' }]}
        >
          <Input placeholder="例如：4 月图像样本标注批次" />
        </Form.Item>

        <Form.Item label="任务描述" name="description">
          <Input.TextArea
            rows={4}
            placeholder="补充数据来源、处理要求、验收口径等说明"
          />
        </Form.Item>

        <Form.Item label="审批流程控制" name="approvalStages" initialValue={[]}>
          <Checkbox.Group
            options={[
              { label: '数据清洗', value: 'clean' },
              { label: '数据标注', value: 'annotate' },
              { label: '模型训练', value: 'train' },
            ]}
          />
        </Form.Item>

        {ROLE_GROUPS.map((group) => (
          <Form.Item
            key={group.role}
            label={group.label}
            name={`${group.role}Id` as const}
            rules={[{ required: true, message: `请选择${group.label}` }]}
          >
            <Select
              placeholder={`请选择${group.label}`}
              options={users
                .filter((user) => user.role === group.role)
                .map((user) => ({
                  value: user.id,
                  label: user.username,
                }))}
            />
          </Form.Item>
        ))}
      </Form>

      <FileUploadField
        label="初始文件"
        token={session.token}
        value={sourceFile}
        onChange={setSourceFile}
        description="文件上传成功后才可提交创建任务。当前采用本地目录存储。"
        acceptedExtensions={ARCHIVE_EXTENSIONS}
        fileTypeHint={ARCHIVE_FILE_HINT}
        uploadPurpose="task_source"
      />
    </Drawer>
  )
}

export default CreateTaskDrawer
