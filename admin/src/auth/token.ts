const TOKEN_KEY = 'mall-admin-token'

/**
 * 管理端令牌的存取。
 *
 * 【为什么用 localStorage 而不是 cookie】
 * 旧应用用 cookie（vue-cookie），但那个 cookie 从来不是给服务端看的 ——
 * 令牌是作为 `token` 请求头发出去的。也就是说 cookie 只是客户端存储，
 * 换成 localStorage 在安全性上完全等价，而且少一个依赖。
 *
 * 【为什么不能用 httpOnly cookie（那本来更安全）】
 * 因为应用必须自己读出令牌放进请求头，httpOnly 的 cookie 读不到。
 * 要真正规避 XSS 读取令牌，得改成「httpOnly cookie + 服务端会话」——
 * 那是后端改动，不在这次重写范围内。
 * 现状下 localStorage 和 JS 可读 cookie 面对 XSS 的风险是一样的，
 * 而 CSRF 两者都不适用（令牌不会被浏览器自动携带）。
 *
 * 【一个已知限制】mall-admin 的 JWT 是无状态的、有效期 12 小时，
 * 【登出无法让令牌立即失效】—— 服务端没有黑名单。所以这里的 clearToken
 * 只是让本客户端忘掉它，令牌本身在过期前仍然有效。
 */
export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    // 隐私模式 / 禁用站点数据时 localStorage 的访问器本身会抛。
    // 这时候当作未登录处理，而不是让整个应用崩掉。
    return null
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // 存不下就只能这次会话有效。不抛 —— 登录流程不该因为存储不可用而失败。
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* 同上 */
  }
}
