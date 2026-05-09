import { Button, Typography, message } from 'antd'
import { useCallback, useEffect, useState, useTransition } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getModelIterationDetail } from '../api/client'
import ProjectDetailContent from '../components/ProjectDetailContent'
import { useAuth } from '../context/useAuth'
import type { ModelIterationDetail } from '../types/models'

function ProjectDetailPage() {
  const navigate = useNavigate()
  const { projectId } = useParams()
  const { session } = useAuth()
  const [detail, setDetail] = useState<ModelIterationDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [, startTransition] = useTransition()

  const numericProjectId = Number(projectId)

  const loadDetail = useCallback(async () => {
    if (!session || !Number.isInteger(numericProjectId) || numericProjectId <= 0) {
      if (projectId) {
        message.error('项目编号无效')
      }
      return
    }

    setLoading(true)

    try {
      const response = await getModelIterationDetail(numericProjectId, session.token)

      startTransition(() => {
        setDetail(response)
      })
    } catch (error) {
      message.error(error instanceof Error ? error.message : '项目详情加载失败')
    } finally {
      setLoading(false)
    }
  }, [numericProjectId, projectId, session, startTransition])

  useEffect(() => {
    queueMicrotask(() => {
      void loadDetail()
    })
  }, [loadDetail])

  if (!session) {
    return null
  }

  return (
    <div className="page-stack page-fill">
      <section className="page-header page-header-surface">
        <div className="page-header-copy">
          <Typography.Text className="section-eyebrow">
            Project Detail
          </Typography.Text>
          <Typography.Title level={2} className="page-title">
            {detail?.name ?? '项目详情'}
          </Typography.Title>
        </div>

        <div className="page-actions">
            <Button onClick={() => navigate('/projects')}>返回项目列表</Button>
        </div>
      </section>

      <ProjectDetailContent
        detail={detail}
        loading={loading}
        token={session.token}
        onDetailChange={(nextDetail) => {
          startTransition(() => {
            setDetail(nextDetail)
          })
        }}
      />
    </div>
  )
}

export default ProjectDetailPage
