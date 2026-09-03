/**
 * 运行时配置的类型与读取。
 *
 * `window.SITE_CONFIG` 由 `public/config/index.js` 在 index.html 里同步加载，
 * 【不进 bundle】—— 这样同一个镜像可以指向不同环境的后端。
 * 代价是它在类型系统里是"外部输入"，所以这里做一次显式的读取和校验，
 * 而不是到处 `window.SITE_CONFIG!.baseUrl` 地断言。
 */

export interface SiteConfig {
  /** 后端网关的前缀。生产是 '/api'（由 nginx 转给网关）。 */
  baseUrl: string
}

declare global {
  interface Window {
    SITE_CONFIG?: Partial<SiteConfig>
  }
}

/**
 * 读运行时配置。
 *
 * 缺失时<b>直接抛错而不是回落到某个默认值</b>：配置文件没加载上意味着
 * 部署出了问题（nginx 没拷 config/ 目录、路径写错），而回落到 '/api' 会让它
 * 看起来能跑、直到某个环境指向了错误的后端才发现。宁可白屏加一条明确的报错。
 */
export function readSiteConfig(): SiteConfig {
  const raw = window.SITE_CONFIG
  if (!raw || typeof raw.baseUrl !== 'string' || raw.baseUrl.length === 0) {
    throw new Error(
      '运行时配置缺失：window.SITE_CONFIG.baseUrl 没有值。' +
        '检查 index.html 是否加载了 ./config/index.js，以及部署时有没有把 config/ 目录一起拷过去。'
    )
  }
  return { baseUrl: raw.baseUrl }
}
