/**
 * 后端响应形状的共同约定。
 *
 * <h3>这些不是照后端实体写的，是拿运行中的集群逐个探测出来的</h3>
 * 照实体猜会错，而且 TypeScript 的类型在运行时不做校验 ——
 * 猜错的类型会一路编译通过，直到界面上某一列空着才被发现。
 * 探测脚本的思路见提交记录；下面每一条不一致都标了实测来源。
 */

/** 分页容器的内层结构。这一部分在所有探测过的接口上都一致。 */
export interface PageResult<T> {
  list: T[]
  currPage: number
  pageSize: number
  totalCount: number
  totalPage: number
}

/** 列表接口的通用查询参数。renren 的约定是 page/limit，不是 pageNum/pageSize。 */
export interface PageQuery {
  page: number
  limit: number
  /** 关键字检索。各接口的字段名不统一，有的叫 key 有的叫 name，按需在各模块里覆盖。 */
  key?: string
  [extra: string]: string | number | boolean | undefined
}

/**
 * id 在后端的序列化<b>不统一</b>：
 * - 字符串：brandId、spuId、skuId、coupon、seckillsession、wareinfo、waresku…（多数）
 * - 数字：分类树的 catId / catLevel / parentCid
 *
 * 猜测原因是部分实体配了 Long → String 的序列化以避免 JS 精度丢失，而分类树没配。
 * 前端统一按<b>字符串</b>处理（见 api/client 的 normalizeId）：
 * id 的用途只有「做 key」和「当参数传回去」，两者字符串都成立，
 * 而混用 string|number 会让每个比较都要想一次「这里该用 === 还是 ==」。
 */
export type Id = string

/** 后端把 Long 序列化成字符串或数字都接受，前端统一收敛成字符串。 */
export function normalizeId(v: string | number | null | undefined): Id {
  return v === null || v === undefined ? '' : String(v)
}
