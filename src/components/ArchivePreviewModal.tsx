import { Empty, Image, Modal, Pagination, Spin, Typography, message } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { getProtectedBlob, getTaskFilePreviewPage } from '../api/client'
import type { TaskArchivePreviewPage } from '../types/models'

type ArchivePreviewModalProps = {
  open: boolean
  title: string
  previewEndpoint: string
  token: string
  onClose: () => void
}

const PAGE_SIZE = 24

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function ArchivePreviewModal({
  open,
  title,
  previewEndpoint,
  token,
  onClose,
}: ArchivePreviewModalProps) {
  const [loading, setLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [previewPage, setPreviewPage] = useState<TaskArchivePreviewPage | null>(null)
  const [imageUrlMap, setImageUrlMap] = useState<Record<string, string>>({})
  const objectUrlsRef = useRef<string[]>([])

  useEffect(() => {
    if (!open) {
      return
    }

    setCurrentPage(1)
  }, [open, previewEndpoint])

  useEffect(() => {
    if (!open) {
      return
    }

    let cancelled = false

    const revokeObjectUrls = () => {
      objectUrlsRef.current.forEach((url) => {
        URL.revokeObjectURL(url)
      })
      objectUrlsRef.current = []
    }

    setLoading(true)

    void getTaskFilePreviewPage(previewEndpoint, token, {
      page: currentPage,
      pageSize: PAGE_SIZE,
    })
      .then(async (pageData) => {
        const nextImageUrls = await Promise.all(
          pageData.items.map(async (item) => {
            const blob = await getProtectedBlob(item.endpoint, token)
            const url = URL.createObjectURL(blob)

            return [item.id, url] as const
          }),
        )

        if (cancelled) {
          nextImageUrls.forEach(([, url]) => {
            URL.revokeObjectURL(url)
          })
          return
        }

        revokeObjectUrls()
        objectUrlsRef.current = nextImageUrls.map(([, url]) => url)
        setPreviewPage(pageData)
        setImageUrlMap(Object.fromEntries(nextImageUrls))
      })
      .catch((error) => {
        if (!cancelled) {
          setPreviewPage(null)
          setImageUrlMap({})
          message.error(error instanceof Error ? error.message : '压缩包预览加载失败')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
      revokeObjectUrls()
      setImageUrlMap({})
    }
  }, [currentPage, open, previewEndpoint, token])

  return (
    <Modal
      open={open}
      title={title}
      width={980}
      footer={null}
      onCancel={onClose}
      destroyOnClose
    >
      <div className="archive-preview-stack">
        <Typography.Paragraph className="muted-paragraph">
          压缩包中的图片较多时，仅加载当前页缩略图。点击缩略图可查看大图。
        </Typography.Paragraph>

        {loading ? (
          <div className="archive-preview-loading">
            <Spin />
          </div>
        ) : previewPage?.items.length ? (
          <>
            <Typography.Text className="muted-text">
              共 {previewPage.pagination.total} 张图片
            </Typography.Text>

            <Image.PreviewGroup>
              <div className="archive-preview-grid">
                {previewPage.items.map((item) => {
                  const previewUrl = imageUrlMap[item.id]

                  return (
                    <div key={item.id} className="archive-preview-card">
                      {previewUrl ? (
                        <Image
                          src={previewUrl}
                          alt={item.name}
                          className="archive-preview-image"
                        />
                      ) : (
                        <div className="archive-preview-image archive-preview-image-placeholder">
                          <Spin size="small" />
                        </div>
                      )}

                      <div className="archive-preview-meta">
                        <Typography.Text
                          className="archive-preview-name"
                          title={item.name}
                        >
                          {item.name}
                        </Typography.Text>
                        <Typography.Text className="muted-text">
                          {formatFileSize(item.size)}
                        </Typography.Text>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Image.PreviewGroup>

            <div className="archive-preview-pagination">
              <Pagination
                current={previewPage.pagination.page}
                pageSize={previewPage.pagination.pageSize}
                total={previewPage.pagination.total}
                showSizeChanger={false}
                onChange={(page) => {
                  if (page !== currentPage) {
                    setCurrentPage(page)
                  }
                }}
              />
            </div>
          </>
        ) : (
          <Empty description="当前压缩包内暂无可预览图片" />
        )}
      </div>
    </Modal>
  )
}

export default ArchivePreviewModal
