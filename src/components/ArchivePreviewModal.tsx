import { Empty, Image, Modal, Pagination, Spin, Typography, message } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { getProtectedBlob, getTaskFilePreviewPage } from '../api/client'
import type {
  TaskArchivePreviewItem,
  TaskArchivePreviewPage,
} from '../types/models'

type ArchivePreviewModalProps = {
  open: boolean
  title: string
  previewEndpoint: string
  token: string
  onClose: () => void
}

type PreviewImageCardProps = {
  item: TaskArchivePreviewItem
  token: string
}

const PAGE_SIZE = 24
const ARCHIVE_PREVIEW_MODAL_BODY_MAX_HEIGHT = 'calc(100vh - 200px)'
const IMAGE_LAZY_ROOT_MARGIN = '200px'

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function PreviewImageCard({ item, token }: PreviewImageCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const [shouldLoad, setShouldLoad] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    const cardElement = cardRef.current

    if (!cardElement) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries

        if (!entry?.isIntersecting) {
          return
        }

        // 预留少量提前量，避免用户刚滚到卡片时仍然只能看到占位。
        setShouldLoad(true)
        observer.disconnect()
      },
      {
        root: null,
        rootMargin: IMAGE_LAZY_ROOT_MARGIN,
        threshold: 0.01,
      },
    )

    observer.observe(cardElement)

    return () => {
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    if (!shouldLoad || previewUrl || loadError) {
      return
    }

    let cancelled = false

    setLoading(true)

    void getProtectedBlob(item.endpoint, token)
      .then((blob) => {
        const nextObjectUrl = URL.createObjectURL(blob)

        if (cancelled) {
          URL.revokeObjectURL(nextObjectUrl)
          return
        }

        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current)
        }

        objectUrlRef.current = nextObjectUrl
        setPreviewUrl(nextObjectUrl)
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(true)
          message.error(error instanceof Error ? error.message : '预览图片加载失败')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [item.endpoint, loadError, previewUrl, shouldLoad, token])

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }
  }, [])

  return (
    <div ref={cardRef} className="archive-preview-card">
      {previewUrl ? (
        <Image
          src={previewUrl}
          alt={item.name}
          className="archive-preview-image"
          loading="lazy"
        />
      ) : (
        <div
          className={`archive-preview-image archive-preview-image-placeholder${
            loadError ? ' archive-preview-image-error' : ''
          }`}
        >
          {loadError ? (
            <Typography.Text className="muted-text">加载失败</Typography.Text>
          ) : (
            <Spin size="small" spinning={loading || !shouldLoad} />
          )}
        </div>
      )}

      <div className="archive-preview-meta">
        <Typography.Text className="archive-preview-name" title={item.name}>
          {item.name}
        </Typography.Text>
        <Typography.Text className="muted-text">
          {formatFileSize(item.size)}
        </Typography.Text>
      </div>
    </div>
  )
}

function ArchivePreviewModal({
  open,
  title,
  previewEndpoint,
  token,
  onClose,
}: ArchivePreviewModalProps) {
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [previewPage, setPreviewPage] = useState<TaskArchivePreviewPage | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    let cancelled = false

    void getTaskFilePreviewPage(previewEndpoint, token, {
      page: currentPage,
      pageSize: PAGE_SIZE,
    })
      .then((pageData) => {
        if (!cancelled) {
          // 弹框层只获取当前页元数据，图片下载延后到卡片进入可视区时再触发。
          setPreviewPage(pageData)
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setPreviewPage(null)
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
    }
  }, [currentPage, open, previewEndpoint, token])

  useEffect(() => {
    if (!open) {
      setLoading(true)
      setPreviewPage(null)
    }
  }, [open])

  useEffect(() => {
    if (open) {
      // 不同预览目标共用同一个弹框实例时，切换文件需要回到第一页重新取元数据。
      setCurrentPage(1)
      setLoading(true)
    }
  }, [open, previewEndpoint])

  const paginationFooter = previewPage?.items.length ? (
    <div className="archive-preview-pagination">
      <Pagination
        current={previewPage.pagination.page}
        pageSize={previewPage.pagination.pageSize}
        total={previewPage.pagination.total}
        showSizeChanger={false}
        onChange={(page) => {
          if (page !== currentPage) {
            // 翻页前先切到加载态，避免大图较多时用户误以为点击未生效。
            setLoading(true)
            setCurrentPage(page)
          }
        }}
      />
    </div>
  ) : null

  return (
    <Modal
      open={open}
      title={title}
      width={980}
      footer={paginationFooter}
      onCancel={onClose}
      destroyOnClose
      styles={{
        body: {
          // 限制预览弹窗内容区高度，避免图片较多时整窗超出一屏。
          // 仅让 body 内部滚动，这样标题栏和页脚分页会始终保留在可见区域。
          maxHeight: ARCHIVE_PREVIEW_MODAL_BODY_MAX_HEIGHT,
          overflowY: 'auto',
        },
      }}
    >
      <div className="archive-preview-stack">
        <Typography.Paragraph className="muted-paragraph">
          压缩包中的图片较多时，仅在滚动到可视区域附近后加载当前页缩略图。点击缩略图可查看大图。
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
                {previewPage.items.map((item) => (
                  <PreviewImageCard key={item.id} item={item} token={token} />
                ))}
              </div>
            </Image.PreviewGroup>
          </>
        ) : (
          <Empty description="当前压缩包内暂无可预览图片" />
        )}
      </div>
    </Modal>
  )
}

export default ArchivePreviewModal
