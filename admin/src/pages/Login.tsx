import { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  Box, Button, Card, CardContent, Stack, TextField, Typography, Alert,
} from '@mui/material'
import { captchaUrl } from '@/api/client'
import { uuidv4 } from '@/utils/uuid'
import { useAuth } from '@/auth/AuthProvider'

interface FormValues {
  username: string
  password: string
  captcha: string
}

/**
 * 登录页。
 *
 * 【验证码的 uuid 是客户端生成的】
 * 后端把验证码答案按 uuid 存起来（mall-admin 的 captcha 是<b>存在服务端内存</b>里的，
 * 所以 replicaCount>1 时会出现「在 A 实例取的码到 B 实例校验不到」——
 * 这个限制在 mall-admin 的 application.yml 里写着，当前它是单副本）。
 * 所以刷新验证码必须换一个新 uuid，否则拿到的是同一张图。
 */
export function Login() {
  const { login } = useAuth()
  const [uuid, setUuid] = useState(() => uuidv4())
  const [error, setError] = useState<string | null>(null)
  const {
    register, handleSubmit, formState: { errors, isSubmitting }, setValue,
  } = useForm<FormValues>({ defaultValues: { username: '', password: '', captcha: '' } })

  const refreshCaptcha = useCallback(() => {
    setUuid(uuidv4())
    setValue('captcha', '')
  }, [setValue])

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    try {
      await login({ ...values, uuid })
      // 成功后不在这里手动跳转，靠已登录路由树里那条 login -> /home 的重定向。
      //
      // 【第一版这里写错了】原注释说「isAuthenticated 变 true，路由树整体换掉，
      // 所以不用跳转」—— 换路由树【不会改 URL】，浏览器还停在 #/login，
      // 而已登录的树里没有 login 这条路由，结果是登录完看到 404
      // （侧边栏和菜单都正常，只有内容区是 404，很容易误判成菜单接口的问题）。
      // 修在路由表里而不是这里：手动敲 #/login 或用旧书签进来是同一个症状。
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      // 验证码是一次性的，失败后必须换一张 —— 否则用户会拿同一个错码反复试。
      refreshCaptcha()
    }
  })

  return (
    <Box sx={{
      minHeight: '100vh', display: 'grid', placeItems: 'center',
      bgcolor: 'grey.100', p: 2,
    }}>
      <Card sx={{ width: 380 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>mall 后台管理</Typography>

          <form onSubmit={onSubmit} noValidate>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="账号" autoComplete="username" autoFocus fullWidth
                error={!!errors.username} helperText={errors.username?.message}
                {...register('username', { required: '请输入账号' })}
              />
              <TextField
                label="密码" type="password" autoComplete="current-password" fullWidth
                error={!!errors.password} helperText={errors.password?.message}
                {...register('password', { required: '请输入密码' })}
              />
              {/* alignItems 要放进 sx —— MUI 9 的 Stack 不再接受系统属性作为直接 prop
                  （v5–v7 是接受的）。写成直接 prop 在没有 TS 的情况下会静默失效。 */}
              <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
                <TextField
                  label="验证码" fullWidth
                  error={!!errors.captcha} helperText={errors.captcha?.message}
                  {...register('captcha', { required: '请输入验证码' })}
                />
                {/* 点图片换一张。key 带上 uuid，让 React 在 uuid 变化时真的重新取图 ——
                    只改 src 的查询串在某些浏览器上会命中缓存。 */}
                <Box
                  component="img" key={uuid} src={captchaUrl(uuid)} alt="验证码"
                  onClick={refreshCaptcha} title="点击换一张"
                  sx={{ height: 40, cursor: 'pointer', border: 1, borderColor: 'divider', borderRadius: 1 }}
                />
              </Stack>

              {error && <Alert severity="error">{error}</Alert>}

              <Button type="submit" variant="contained" disabled={isSubmitting} fullWidth>
                {isSubmitting ? '登录中…' : '登录'}
              </Button>
            </Stack>
          </form>
        </CardContent>
      </Card>
    </Box>
  )
}
