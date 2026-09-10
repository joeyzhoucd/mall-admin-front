import { readSiteConfig } from '@/site-config'
import { getToken, clearToken } from '@/auth/token'

/**
 * 后端统一响应包装。renren 那套约定：业务成功 code=0，失败给非 0 和 msg。
 *
 * 注意它和 HTTP 状态码是两套东西，而且【会同时出现】：
 * 网关鉴权失败给 HTTP 401 且响应体里也带 code:401；
 * 而参数校验失败通常是 HTTP 200 + code≠0。两条都要处理。
 */
export interface ApiEnvelope {
  code: number
  msg?: string
  [key: string]: unknown
}

/** 业务错误（HTTP 通了但 code≠0）。 */
export class ApiError extends Error {
  constructor(
    readonly code: number,
    message: string,
    readonly body: ApiEnvelope
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** 未认证。单独一个类型，因为调用方通常不该弹错误提示，而是跳登录页。 */
export class UnauthorizedError extends Error {
  constructor(message = '未登录或令牌已失效') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

/**
 * 401 的处理。
 *
 * 【为什么用回调而不是在这里直接跳转】
 * 这个模块不该知道路由的存在 —— 那会让它没法在测试里单独跑，
 * 也会让「HTTP 层」和「路由层」互相依赖。由 AuthProvider 在启动时注册。
 */
let onUnauthorized: (() => void) | null = null
export function setUnauthorizedHandler(fn: (() => void) | null): void {
  onUnauthorized = fn
}

function handleUnauthorized(): void {
  clearToken()
  onUnauthorized?.()
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  /** GET 的查询参数。undefined / null 的键会被丢掉，不会变成 "undefined" 字符串。 */
  query?: Record<string, string | number | boolean | undefined | null>
  /** 请求体，会 JSON 序列化。 */
  body?: unknown
  signal?: AbortSignal
  /**
   * 这个接口<b>不带 R 信封</b>，跳过 {@code code} 校验。
   *
   * <p>整个后端目前只有一个这样的接口：{@code GET /sys/menu/list}
   * 直接返回 {@code List<SysMenuEntity>}（后端 {@code SysMenuController.list()}
   * 的注释里明确写了这一点，契约在 {@code openapi/admin-api.yaml}）。
   *
   * <p><b>不要为了统一而去改后端</b>：老 Vue 后台就是按裸数组写的，
   * 而它现在还在服务 {@code /}。改后端会把老后台弄坏。
   *
   * <p>2026-09-10 实测：不加这个选项时，菜单管理页报
   * {@code 业务失败，code=undefined} —— 因为数组上没有 code 字段。
   */
  raw?: boolean
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const { baseUrl } = readSiteConfig()
  // path 一律以 / 开头，baseUrl 一律不以 / 结尾 —— 在这里归一，
  // 免得每个调用点各自决定要不要加斜杠。
  const normalized = path.startsWith('/') ? path : `/${path}`
  const url = `${baseUrl.replace(/\/$/, '')}${normalized}`
  if (!query) return url
  const usp = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue
    usp.append(k, String(v))
  }
  const qs = usp.toString()
  return qs ? `${url}${url.includes('?') ? '&' : '?'}${qs}` : url
}

/**
 * 发一个请求，返回后端响应体（已确认 code===0）。
 *
 * 【401 有两条路径，都要处理】
 * 2026-09-03 起网关的 AdminAuthFilter 对 /api/** 校验管理端 JWT，
 * 失败时返回【真正的 HTTP 401】——刻意不用 renren 那套「200 + code:401」，
 * 因为用 200 表示鉴权失败会让它在监控里完全隐形（http_server_requests 里全是 200）。
 * 但响应体里仍然带 code:401 以兼容旧约定，所以这里两条都认。
 * 只认一条的后果是令牌过期时「页面上什么都没发生」，而不是跳回登录页。
 */
export async function request<T = ApiEnvelope>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = 'GET', query, body, signal } = options
  const token = getToken()

  const headers: Record<string, string> = {}
  // 请求头的名字就是 'token'，和后端/网关约定一致（不是 Authorization: Bearer）。
  // 改这个名字要同时改 mall-gateway 的 AdminAuthFilter.TOKEN_HEADER。
  if (token) headers['token'] = token
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let res: Response
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (e) {
    // 网络层失败（DNS、连接、CORS、被 abort）。不要伪装成业务错误。
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    throw new Error(`请求失败：${path}（网络不可达或被浏览器拦截）`)
  }

  if (res.status === 401) {
    handleUnauthorized()
    throw new UnauthorizedError()
  }

  // 非 JSON 响应（比如网关直接返回的 HTML 错误页）要给出可读的错误，
  // 而不是让 res.json() 抛一个「Unexpected token < in JSON」。
  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    const text = await res.text().catch(() => '')
    throw new Error(
      `响应不是 JSON：${path} 返回 HTTP ${res.status}` +
        (text ? `，开头是「${text.slice(0, 80)}」` : '')
    )
  }

  const payload = (await res.json()) as ApiEnvelope

  // 兼容 renren 的「HTTP 200 + code:401」
  if (payload.code === 401) {
    handleUnauthorized()
    throw new UnauthorizedError(payload.msg)
  }
  if (!res.ok) {
    throw new ApiError(payload.code ?? res.status, payload.msg ?? `HTTP ${res.status}`, payload)
  }
  if (options.raw === true) {
    // 不带信封的接口：到这里已经确认了 HTTP 2xx 且 content-type 是 JSON，
    // 剩下的形状由调用方的类型参数负责。
    return payload as unknown as T
  }
  // 【区分"业务拒绝"和"这个接口压根不带信封"】
  // 两者原来都报成 `业务失败，code=undefined`，而后者的修法完全不同
  // （要加 raw: true，不是去查后端为什么拒绝）。
  // 2026-09-10 菜单管理页就卡在这里：报错完全不指向真正的原因。
  // 走 unknown 做形状检查：payload 的声明类型是 ApiEnvelope（带 code），
  // 直接在它上面用 'code' in payload 收窄会把否定分支推成 never，
  // 于是取 .length 都不让过。这里要判的恰恰是"它其实不是 ApiEnvelope"。
  const shapeless = payload as unknown
  if (shapeless === null || typeof shapeless !== 'object' || !('code' in shapeless)) {
    const shape = Array.isArray(shapeless)
      ? `数组（${shapeless.length} 项）`
      : typeof shapeless
    throw new Error(
      `${path} 的响应里没有 «code» 字段（实际是${shape}）。` +
        '这个接口大概不带 R 信封 —— 调用时加 { raw: true }，而不是去查后端为什么拒绝。'
    )
  }
  if (payload.code !== 0) {
    throw new ApiError(payload.code, payload.msg ?? `业务失败，code=${payload.code}`, payload)
  }
  return payload as T
}

/** 验证码是图片不是 JSON，所以只给 URL，由 <img> 去取。 */
export function captchaUrl(uuid: string): string {
  return buildUrl('/captcha.jpg', { uuid })
}

/**
 * 取一个分页列表。
 *
 * <h3>为什么需要这个而不是直接用 request()</h3>
 * <b>后端的分页容器键名不统一</b>，实测（2026-09-03，直连各服务）：
 * <pre>
 *   page 容器： product/spuinfo  product/skuinfo  coupon/coupon
 *               coupon/seckillsession  ware/wareinfo  ware/waresku   ← 多数
 *   data 容器： product/brand  product/category/list/tree             ← 少数
 * </pre>
 * 内层结构在所有接口上都一致（list / currPage / pageSize / totalCount / totalPage）。
 * <p>
 * 这个差异必须在这一层收敛。让每个页面各自处理的后果是：
 * 抄了 brand 页写 category 页的人会读 data，而 spuinfo 返回的是 page，
 * 于是列表<b>空着但不报错</b> —— 分不清是「没有数据」还是「读错了字段」。
 * 这正是本项目反复出现的那种失败形状。
 */
export async function fetchPage<T>(
  path: string,
  query: Record<string, string | number | boolean | undefined | null>,
  options: { signal?: AbortSignal } = {}
): Promise<import('./types').PageResult<T>> {
  const payload = await request<ApiEnvelope & {
    page?: import('./types').PageResult<T>
    data?: import('./types').PageResult<T>
  }>(path, { query, signal: options.signal })

  const container = payload.page ?? payload.data
  if (!container || !Array.isArray(container.list)) {
    // 两个键都没有 → 后端换了形状。显式报错而不是返回空列表：
    // 空列表会被当成「没有数据」，而这是一个契约变更，必须有人知道。
    throw new Error(
      `${path} 的响应里既没有 page 也没有 data 容器（拿到的顶层键：` +
        `${Object.keys(payload).join(', ')}）。后端的分页形状可能变了。`
    )
  }
  return container
}

/**
 * 取一个非分页的 data 负载（详情、树、下拉选项这类）。
 *
 * 同样有键名问题：详情接口多数用 data，但个别用别的名字。
 * 这里允许调用方指定键名，默认 data。
 */
export async function fetchData<T>(
  path: string,
  options: { query?: RequestOptions['query']; key?: string; signal?: AbortSignal } = {}
): Promise<T> {
  const { query, key = 'data', signal } = options
  const payload = await request<ApiEnvelope>(path, { query, signal })
  if (!(key in payload)) {
    throw new Error(
      `${path} 的响应里没有 «${key}» 字段（拿到的顶层键：${Object.keys(payload).join(', ')}）`
    )
  }
  return payload[key] as T
}
