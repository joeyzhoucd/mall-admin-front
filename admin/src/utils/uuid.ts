/**
 * 生成一个 v4 UUID，<b>不依赖安全上下文</b>。
 *
 * <h3>为什么不能直接用 crypto.randomUUID()</h3>
 * {@link Crypto.randomUUID} 是 <b>secure context only</b> 的 API：
 * 只有在 HTTPS 或 localhost 下才存在。本项目的后台跑在
 * {@code http://admin.mall.com}（普通 HTTP、非 localhost），
 * 于是 {@code crypto.randomUUID} 是 <b>undefined</b>。
 *
 * <p>2026-09-09 实测的后果：登录页在 {@code useState(() => crypto.randomUUID())}
 * 里就抛 {@code TypeError: crypto.randomUUID is not a function}，
 * 整个 React 后台<b>白屏进不去</b>。而且这个失败在本地 {@code npm run dev}
 * （localhost，算安全上下文）下<b>完全复现不出来</b> ——
 * 只有部署到域名上才会炸，是典型的"本地好好的"类故障。
 *
 * <h3>为什么 getRandomValues 可以用</h3>
 * 安全上下文的限制只加在 {@code crypto.randomUUID} 和 {@code crypto.subtle} 上。
 * {@code crypto.getRandomValues()} 在<b>非安全上下文里同样可用</b>，
 * 所以用它自己拼一个 v4 就行，随机性质量和 randomUUID 一样。
 *
 * <h3>最后那层 Math.random 兜底</h3>
 * 只为极老的环境准备，正常永远走不到。它<b>不具备密码学强度</b>，
 * 所以这个函数只能用在"需要一个唯一标识"的场合（比如验证码的 key），
 * <b>不要</b>用它生成令牌、密钥或任何安全凭证。
 */
export function uuidv4(): string {
  const c: Crypto | undefined = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined

  // 有原生实现（HTTPS / localhost）就用原生的
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID()
  }

  // 非安全上下文：getRandomValues 仍然可用，自己拼 v4
  if (c && typeof c.getRandomValues === 'function') {
    const b = new Uint8Array(16)
    c.getRandomValues(b)
    // v4 的两个固定位：version = 4，variant = 10xx。
    // 这里的 ?? 0 是为了满足 noUncheckedIndexedAccess —— 定长 Uint8Array 的
    // 下标不可能越界，但类型上仍是 number | undefined，用断言不如给个显式默认值。
    b[6] = ((b[6] ?? 0) & 0x0f) | 0x40
    b[8] = ((b[8] ?? 0) & 0x3f) | 0x80
    const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0'))
    return (
      hex.slice(0, 4).join('') + '-' +
      hex.slice(4, 6).join('') + '-' +
      hex.slice(6, 8).join('') + '-' +
      hex.slice(8, 10).join('') + '-' +
      hex.slice(10, 16).join('')
    )
  }

  // 连 getRandomValues 都没有。正常环境到不了这里。
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0
    const v = ch === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
