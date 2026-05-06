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
        <Card
          bordered={false}
          className="panel-card login-card"
          styles={{ body: { padding: 32 } }}
        >
          <div className="login-card-header">
            <Typography.Title level={3}>登录系统</Typography.Title>
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
