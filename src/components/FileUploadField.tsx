import type { ReactNode } from 'react'
import { Button, Card, Progress, Spin, Typography, message } from 'antd'
import { Uppy, Tus } from 'uppy'
import { useEffect, useRef, useState } from 'react'
import { finalizeChunkUpload } from '../api/client'
import type { UploadedFileRef, UploadPurpose } from '../types/models'

type FileUploadFieldProps = {
  label: ReactNode
  token: string
  value: UploadedFileRef | null
  onChange: (value: UploadedFileRef | null) => void
  description?: string
  acceptedExtensions?: string[]
  fileTypeHint?: string
  uploadPurpose?: UploadPurpose
  extraActions?: ReactNode
}

type UploadState = {
  fileName: string
  progress: number
}

type UppyUploadSuccessResponse = {
  uploadURL?: string
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

function extractUploadIdFromUrl(uploadUrl: string) {
  try {
    const normalizedUrl = uploadUrl.startsWith('http')
      ? new URL(uploadUrl)
      : new URL(uploadUrl, window.location.origin)
    const segments = normalizedUrl.pathname.split('/').filter(Boolean)
    return segments.at(-1) ?? ''
  } catch {
    return ''
  }
}

function FileUploadField({
  label,
  token,
  value,
  onChange,
  description,
  acceptedExtensions,
  fileTypeHint,
  uploadPurpose,
  extraActions,
}: FileUploadFieldProps) {
  const [uploading, setUploading] = useState(false)
  const [uploadState, setUploadState] = useState<UploadState | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const uppyRef = useRef<any>(null)
  const normalizedAcceptedExtensions = (acceptedExtensions ?? [])
    .map(normalizeExtension)
    .filter(Boolean)
  const acceptValue =
    normalizedAcceptedExtensions.length > 0
      ? normalizedAcceptedExtensions.join(',')
      : undefined

  useEffect(() => {
    return () => {
      void uppyRef.current?.cancelAll()
      uppyRef.current?.destroy()
      uppyRef.current = null
    }
  }, [])

  return (
    <Card size="small" className="panel-card">
      <div className="upload-field">
        <div>
          <Typography.Text strong className="drawer-section-title">
            {label}
          </Typography.Text>
          {description ? (
            <Typography.Paragraph className="drawer-section-copy">
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
              <span className="upload-value-name">{value.originalName}</span>
              <span className="muted-text">{formatFileSize(value.size)}</span>
            </div>
          ) : (
            <Typography.Text className="muted-text">
              尚未上传文件
            </Typography.Text>
          )}
          {uploadState ? (
            <div style={{ marginTop: 12 }}>
              <Typography.Paragraph className="muted-paragraph compact">
                正在上传：{uploadState.fileName}
              </Typography.Paragraph>
              <Progress percent={Math.round(uploadState.progress)} size="small" />
            </div>
          ) : null}
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
              setUploadState({
                fileName: file.name,
                progress: 0,
              })

              const currentUppy = new Uppy({
                autoProceed: true,
                restrictions: {
                  maxNumberOfFiles: 1,
                },
              }) as any

              uppyRef.current?.destroy()
              uppyRef.current = currentUppy

              currentUppy.use(Tus, {
                endpoint: '/api/v1/files/tus',
                headers: {
                  Authorization: `Bearer ${token}`,
                },
                chunkSize: 5 * 1024 * 1024,
                retryDelays: [0, 1000, 3000, 5000],
                allowedMetaFields: ['originalName', 'mimeType', 'purpose'],
              })

              currentUppy.on('upload-progress', (_uppyFile: unknown, progress: {
                bytesUploaded: number
                bytesTotal: number | null
              }) => {
                setUploadState((current) =>
                  current
                    ? (() => {
                        const bytesTotal = progress.bytesTotal ?? 0

                        return {
                          ...current,
                          progress:
                            bytesTotal > 0
                              ? (progress.bytesUploaded / bytesTotal) * 100
                              : 0,
                        }
                      })()
                    : current,
                )
              })

              currentUppy.on(
                'upload-success',
                async (
                  _file: unknown,
                  response: UppyUploadSuccessResponse,
                ) => {
                  try {
                    const uploadId = response.uploadURL
                      ? extractUploadIdFromUrl(response.uploadURL)
                      : ''

                    if (!uploadId) {
                      throw new Error('上传成功，但未能识别上传会话标识。')
                    }

                    const uploaded = await finalizeChunkUpload(uploadId, token)
                    onChange(uploaded)
                    message.success(`${file.name} 上传成功`)
                  } catch (error) {
                    message.error(
                      error instanceof Error ? error.message : '文件上传完成确认失败',
                    )
                  } finally {
                    setUploading(false)
                    setUploadState(null)
                    event.target.value = ''
                    currentUppy.destroy()
                    if (uppyRef.current === currentUppy) {
                      uppyRef.current = null
                    }
                  }
                },
              )

              currentUppy.on('error', (error: unknown) => {
                message.error(error instanceof Error ? error.message : '文件上传失败')
                setUploading(false)
                setUploadState(null)
                event.target.value = ''
              })

              currentUppy.on('upload-error', (_file: unknown, error: unknown) => {
                message.error(error instanceof Error ? error.message : '文件上传失败')
                setUploading(false)
                setUploadState(null)
                event.target.value = ''
              })

              currentUppy.addFile({
                name: file.name,
                type: file.type,
                data: file,
                meta: {
                  originalName: file.name,
                  mimeType: file.type || 'application/octet-stream',
                  purpose: uploadPurpose ?? '',
                },
              })
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
          {extraActions}
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
