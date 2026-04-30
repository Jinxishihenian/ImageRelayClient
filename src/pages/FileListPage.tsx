import { useState } from 'react'
import {
  Button,
  Card,
  Col,
  Modal,
  Progress,
  Row,
  Table,
  Tag,
  Typography,
  Upload,
  type TableColumnsType,
} from 'antd'

type FileRecord = {
  id: string
  name: string
  owner: string
  type: string
  status: 'ready' | 'processing' | 'failed'
  size: string
}

const fileData: FileRecord[] = [
  {
    id: 'FIL-3001',
    name: 'portrait-master.psd',
    owner: 'Ava Lin',
    type: 'PSD',
    status: 'ready',
    size: '142 MB',
  },
  {
    id: 'FIL-3002',
    name: 'catalog-spring.zip',
    owner: 'Noah Zhang',
    type: 'ZIP',
    status: 'processing',
    size: '2.8 GB',
  },
  {
    id: 'FIL-3003',
    name: 'avatar-batch.png',
    owner: 'Mia Chen',
    type: 'PNG',
    status: 'ready',
    size: '38 MB',
  },
  {
    id: 'FIL-3004',
    name: 'legacy-export.mov',
    owner: 'Ethan Wu',
    type: 'MOV',
    status: 'failed',
    size: '860 MB',
  },
]

const fileColumns: TableColumnsType<FileRecord> = [
  {
    title: '文件名',
    dataIndex: 'name',
    key: 'name',
    render: (value: string, record) => (
      <div className="flex flex-col gap-1">
        <strong>{value}</strong>
        <span className="text-xs text-[var(--text)]">{record.id}</span>
      </div>
    ),
  },
  {
    title: '归属人',
    dataIndex: 'owner',
    key: 'owner',
  },
  {
    title: '类型',
    dataIndex: 'type',
    key: 'type',
  },
  {
    title: '大小',
    dataIndex: 'size',
    key: 'size',
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    render: (status: FileRecord['status']) => {
      const colorMap = {
        ready: 'green',
        processing: 'blue',
        failed: 'red',
      }

      const labelMap = {
        ready: '可用',
        processing: '处理中',
        failed: '失败',
      }

      return <Tag color={colorMap[status]}>{labelMap[status]}</Tag>
    },
  },
  {
    title: '操作',
    key: 'actions',
    render: () => (
      <div className="flex flex-wrap gap-2">
        {/* 当前仅做交互占位展示，后续再接真实删除和下载逻辑。 */}
        <Button size="small" danger>
          删除
        </Button>
        <Button size="small">下载</Button>
      </div>
    ),
  },
]

function FileListPage() {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const { Dragger } = Upload

  return (
    <div className="grid gap-6">
      <section className="flex flex-col gap-2 border-b border-[var(--border)] pb-5">
        <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--text)]">
          Files
        </p>
        <h1 className="m-0 text-[clamp(1.8rem,5vw,2.6rem)] font-medium tracking-[-0.06em] text-[var(--text-h)]">
          文件列表
        </h1>
        <p className="max-w-[40rem] text-[14px] leading-7 text-[var(--text)]">
          先把资产管理入口搭好，后续可以自然接入上传、筛选、预览和处理流水线。
        </p>
      </section>

      <Row gutter={[24, 24]}>
        <Col xs={24} xl={16}>
          <Card
            bordered={false}
            className="overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--surface)] shadow-none"
            styles={{ body: { padding: 24 } }}
          >
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <Typography.Title
                  level={4}
                  className="!m-0 !text-xl !font-medium !tracking-[-0.03em]"
                >
                  最近文件
                </Typography.Title>
                <Typography.Paragraph className="mb-0 mt-2 max-w-[38rem] !text-[var(--text)]">
                  当前展示静态列表，用来承接后续真实接口返回的数据结构。
                </Typography.Paragraph>
              </div>

              <Button
                type="primary"
                className="!h-10 !rounded-full !border-none !bg-[var(--text-h)] !px-5 !text-[var(--bg)] !shadow-none"
                onClick={() => {
                  setIsUploadModalOpen(true)
                }}
              >
                上传文件
              </Button>
            </div>

            <Table<FileRecord>
              rowKey="id"
              columns={fileColumns}
              dataSource={fileData}
              pagination={false}
              className="[&_.ant-table]:bg-transparent [&_.ant-table-cell]:!border-[var(--border)] [&_.ant-table-tbody>tr.ant-table-row:hover>td]:!bg-white/[0.02] [&_.ant-table-tbody>tr>td]:!bg-transparent [&_.ant-table-thead>tr>th]:!border-[var(--border)] [&_.ant-table-thead>tr>th]:!bg-transparent [&_.ant-table-thead>tr>th]:!font-medium [&_.ant-table-thead>tr>th]:!text-[var(--text)]"
            />

            <Modal
              open={isUploadModalOpen}
              title="上传文件"
              okText="开始上传"
              cancelText="取消"
              onCancel={() => {
                setIsUploadModalOpen(false)
              }}
              onOk={() => {
                // 当前仅保留上传弹窗骨架，后续再接真实文件选择与上传逻辑。
              }}
              styles={{
                container: {
                  border: '1px solid var(--border)',
                  borderRadius: 24,
                  background: 'var(--surface)',
                  boxShadow: 'none',
                },
                header: {
                  background: 'transparent',
                  borderBottom: '1px solid var(--border)',
                  paddingBottom: 16,
                },
                body: {
                  paddingTop: 20,
                  paddingBottom: 20,
                },
                footer: {
                  borderTop: '1px solid var(--border)',
                  paddingTop: 16,
                },
              }}
            >
              <div className="grid gap-3">
                <Typography.Paragraph className="mb-0 !text-[var(--text)]">
                  将文件拖拽到区域内，或点击下方按钮预留后续上传入口。
                </Typography.Paragraph>

                <Dragger
                  multiple
                  showUploadList={false}
                  openFileDialogOnClick={false}
                  className="overflow-hidden !rounded-[24px] !border !border-dashed !border-[var(--border)] !bg-transparent"
                >
                  <div className="grid min-h-[220px] place-items-center bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] px-6 py-8 text-center">
                    <div className="grid max-w-[24rem] gap-3">
                      <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--border)] bg-white/[0.04] text-lg font-medium text-[var(--text-h)]">
                        UP
                      </span>
                      <div className="grid gap-1.5">
                        <Typography.Title
                          level={5}
                          className="!m-0 !text-[var(--text-h)]"
                        >
                          点击上传文件 / 拖拽上传文件
                        </Typography.Title>
                        <Typography.Paragraph className="mb-0 !text-[13px] !leading-6 !text-[var(--text)]">
                          当前仅展示上传区域样式，不会读取或提交本地文件。
                        </Typography.Paragraph>
                      </div>

                      <div className="pt-1">
                        <Button className="!h-10 !rounded-full !border-[var(--border)] !bg-transparent !px-5 !text-[var(--text-h)] !shadow-none">
                          点击上传文件
                        </Button>
                      </div>
                    </div>
                  </div>
                </Dragger>
              </div>
            </Modal>
          </Card>
        </Col>

        <Col xs={24} xl={8}>
          <Card
            bordered={false}
            className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] shadow-none"
            styles={{ body: { padding: 24 } }}
          >
            <Typography.Text className="block text-[10px] uppercase tracking-[0.22em] text-[var(--text)]">
              Storage
            </Typography.Text>
            <Typography.Title
              level={4}
              className="!mb-0 !mt-2 !text-xl !font-medium !tracking-[-0.03em]"
            >
              存储概况
            </Typography.Title>

            <div className="mt-5 grid gap-2.5">
              <div>
                <span className="text-[13px] text-[var(--text)]">已用容量</span>
                <strong>68%</strong>
              </div>
              <Progress percent={68} showInfo={false} strokeColor="#d7dde8" />
            </div>

            <div className="mt-5 grid gap-3.5">
              <div className="grid gap-1.5 rounded-2xl border border-[var(--border)] px-4 py-4">
                <span className="text-[13px] text-[var(--text)]">处理中任务</span>
                <strong>7</strong>
              </div>
              <div className="grid gap-1.5 rounded-2xl border border-[var(--border)] px-4 py-4">
                <span className="text-[13px] text-[var(--text)]">失败告警</span>
                <strong>2</strong>
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default FileListPage
