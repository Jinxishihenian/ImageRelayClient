import { Button, Card, Spin, Typography, message } from 'antd'
import { useRef, useState } from 'react'
import { uploadBinaryFile } from '../api/client'
import type { UploadedFileRef } from '../types/models'

type FileUploadFieldProps = {
  label: string
  token: string
  value: UploadedFileRef | null
  onChange: (value: UploadedFileRef | null) => void
  description?: string
  acceptedExtensions?: string[]
  fileTypeHint?: string
}

function normalizeExtension(extension: string) {
  const trimmed = extension.trim().toLowerCase()

  if (!trimmed) {
    return ''
  }

  return trimmed.startsWith('.') ? trimmed : `.${trimmed}`
}

function getFileExtension(fileName: string) {
  const lastDotIndex = fileName.lastIndexOf('.')

  if (lastDotIndex < 0) {
    return ''
  }

  return fileName.slice(lastDotIndex).toLowerCase()
}

function formatExtensionList(extensions: string[]) {
  return extensions.map((extension) => extension.replace(/^\./, '')).join(' / ')
}

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function FileUploadField({
  label,
  token,
  value,
  onChange,
  description,
  acceptedExtensions,
  fileTypeHint,
}: FileUploadFieldProps) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const normalizedAcceptedExtensions = (acceptedExtensions ?? [])
    .map(normalizeExtension)
    .filter(Boolean)
  const acceptValue =
    normalizedAcceptedExtensions.length > 0
      ? normalizedAcceptedExtensions.join(',')
      : undefined

  return (
    <Card size="small" className="panel-card">
      <div className="upload-field">
        <div>
          <Typography.Text strong>{label}</Typography.Text>
          {description ? (
            <Typography.Paragraph className="muted-paragraph">
              {description}
            </Typography.Paragraph>
          ) : null}
          {fileTypeHint ? (
            <Typography.Paragraph className="muted-paragraph compact">
              可上传类型：{fileTypeHint}
            </Typography.Paragraph>
          ) : null}
          {value ? (
            <div className="upload-result">
              <span>{value.originalName}</span>
              <span className="muted-text">{formatFileSize(value.size)}</span>
            </div>
          ) : (
            <Typography.Text className="muted-text">
              尚未上传文件
            </Typography.Text>
          )}
        </div>

        <div className="upload-actions">
          <input
            ref={inputRef}
            hidden
            type="file"
            accept={acceptValue}
            onChange={async (event) => {
              const file = event.target.files?.[0]

              if (!file) {
                return
              }

              if (normalizedAcceptedExtensions.length > 0) {
                const currentExtension = getFileExtension(file.name)

                // 浏览器上报的 MIME 不稳定，这里先按文件名后缀做最小可用校验，
                // 后端业务接口还会再次校验，避免只靠前端拦截。
                if (!normalizedAcceptedExtensions.includes(currentExtension)) {
                  message.error(
                    `当前仅支持上传 ${formatExtensionList(normalizedAcceptedExtensions)} 格式文件。`,
                  )
                  event.target.value = ''
                  return
                }
              }

              setUploading(true)

              try {
                const uploaded = await uploadBinaryFile(file, token)
                onChange(uploaded)
                message.success(`${file.name} 上传成功`)
              } catch (error) {
                message.error(
                  error instanceof Error ? error.message : '文件上传失败',
                )
              } finally {
                setUploading(false)
                event.target.value = ''
              }
            }}
          />

          <Button
            onClick={() => {
              inputRef.current?.click()
            }}
            disabled={uploading}
          >
            {value ? '重新上传' : '选择文件'}
          </Button>
          {value ? (
            <Button
              type="link"
              danger
              onClick={() => {
                onChange(null)
              }}
            >
              清空
            </Button>
          ) : null}
          {uploading ? <Spin size="small" /> : null}
        </div>
      </div>
    </Card>
  )
}

export default FileUploadField
