import { Button, Card, Form, Input, Typography, message } from 'antd'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

type LoginFormValues = {
  username: string
  password: string
}

function LoginPage() {
  const { login, session } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  if (session) {
    return <Navigate to="/tasks" replace />
  }

  return (
    <main className="login-screen">
      <section className="login-wrap">
        <div className="login-copy">
          <Typography.Text className="section-eyebrow">
            Image Relay MVP
          </Typography.Text>
          <Typography.Title className="login-title">
            资源中转管理平台
          </Typography.Title>
          <Typography.Paragraph className="muted-paragraph">
            使用数据库预置账号登录后，按固定角色完成任务创建、文件交接和阶段流转。
          </Typography.Paragraph>

          <ul className="login-points">
            <li>
              <span className="login-point-index">01</span>
              <div className="login-point-copy">
                <Typography.Text strong>固定职责链路</Typography.Text>
                <Typography.Text className="muted-text">
                  管理员创建任务后，清洗、标注、训练按顺序完成交接。
                </Typography.Text>
              </div>
            </li>
            <li>
              <span className="login-point-index">02</span>
              <div className="login-point-copy">
                <Typography.Text strong>文件与备注同步沉淀</Typography.Text>
                <Typography.Text className="muted-text">
                  每个阶段都记录结果文件和处理说明，便于后续追踪。
                </Typography.Text>
              </div>
            </li>
            <li>
              <span className="login-point-index">03</span>
              <div className="login-point-copy">
                <Typography.Text strong>最小学习成本</Typography.Text>
                <Typography.Text className="muted-text">
                  页面只保留任务流转必需信息，适合快速投入使用。
                </Typography.Text>
              </div>
            </li>
          </ul>
        </div>

        <Card
          bordered={false}
          className="panel-card login-card"
          styles={{ body: { padding: 32 } }}
        >
          <div className="login-card-header">
            <Typography.Title level={3}>登录系统</Typography.Title>
            <Typography.Paragraph className="muted-paragraph">
              输入预置账号后进入任务工作台。
            </Typography.Paragraph>
          </div>

          <div className="login-card-tip">
            默认密码为 `123456`。例如可使用 `admin01`、`cleaner01`、`annotator01`、`trainer01` 登录。
          </div>

          <Form<LoginFormValues>
            layout="vertical"
            style={{ marginTop: 24 }}
            onFinish={async (values) => {
              try {
                await login(values.username, values.password)
                navigate(
                  (location.state as { from?: string } | null)?.from || '/tasks',
                  { replace: true },
                )
              } catch (error) {
                message.error(error instanceof Error ? error.message : '登录失败')
              }
            }}
          >
            <Form.Item
              label="账号"
              name="username"
              rules={[{ required: true, message: '请输入账号' }]}
            >
              <Input size="large" placeholder="请输入预置用户名" />
            </Form.Item>

            <Form.Item
              label="密码"
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password size="large" placeholder="请输入密码" />
            </Form.Item>

            <Button htmlType="submit" type="primary" size="large" block>
              登录并进入工作台
            </Button>
          </Form>
        </Card>
      </section>
    </main>
  )
}

export default LoginPage
