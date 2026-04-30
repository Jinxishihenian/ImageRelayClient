import {
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
  TaskDetail,
  UploadedFileRef,
  UserRole,
  UserSummary,
} from '../types/models'
import FileUploadField from './FileUploadField'

type CreateTaskDrawerProps = {
  open: boolean
  users: UserSummary[]
  onClose: () => void
  onCreated: (task: TaskDetail | null) => void
}

type CreateTaskFormValues = {
  title: string
  description: string
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
  onClose,
  onCreated,
}: CreateTaskDrawerProps) {
  const [form] = Form.useForm<CreateTaskFormValues>()
  const { session } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [sourceFile, setSourceFile] = useState<UploadedFileRef | null>(null)

  if (!session) {
    return null
  }

  return (
    <Drawer
      open={open}
      width={520}
      title="创建任务"
      onClose={() => {
        form.resetFields()
        setSourceFile(null)
        onClose()
      }}
      destroyOnClose
      extra={
        <Space>
          <Button onClick={onClose}>取消</Button>
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
        管理员创建任务时需要上传初始文件，并为三类执行人分别指定负责人。初始文件仅支持{' '}
        {ARCHIVE_FILE_HINT}。
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
                ...values,
                sourceFile,
              },
              session.token,
            )

            message.success('任务创建成功')
            onCreated(task)
            onClose()
          } catch (error) {
            message.error(error instanceof Error ? error.message : '任务创建失败')
          } finally {
            setSubmitting(false)
          }
        }}
      >
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
