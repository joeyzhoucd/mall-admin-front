import { request, fetchPage } from './client'
import type { Id, PageResult } from './types'

/**
 * 优惠券域接口。
 *
 * <h3>save / update / delete / info 是 2026-09-08 才补的</h3>
 * 在此之前 `CouponController` 上<b>只有</b> `/list`、一个 `/placeholder`，
 * 和一个返回硬编码假券的 `/member/list`（"Full 100 off 10"）——
 * 也就是后台根本不能建券。这和会员、订单那两次是同一个情况：
 * 生成器的 CRUD 被人拿掉了一部分，只剩列表。
 *
 * <h3>两个字段前端不发、发了也无效</h3>
 * `receiveCount` / `useCount` 是<b>运行时计数</b>，只由领券和用券流程推进。
 * 后端在 save 时强制归零、在 update 时置空（让 MyBatis-Plus 跳过那两列）。
 * <p>
 * 【这不是洁癖】后台编辑是"GET 详情 → 改几个字段 → POST 回来"，
 * 请求体里的 receiveCount 是<b>打开表单那一刻</b>的旧值。原样写回等于：
 * 运营 10:00 打开表单（已领 40），10:00-10:05 用户领了 60 张到达上限 100，
 * 10:05 点保存把 receive_count 写回 40 —— 上限凭空多出 60 张，直接超发。
 * 后端有 `CouponAdminWriteGuardTest` 钉着这一条。
 *
 * <h3>两类限制目前会被后端拒绝，这是有意的</h3>
 * - `memberLevel > 0`：会员等级体系不存在（`ums_member_level` 实测 0 行，
 *   也没有任何接口能查某个会员的等级），所以这个限制<b>无法校验</b>。
 *   忽略它照发 = 等级专属券被所有人领走（不可撤回的资金损失）；当作不可领 = 零损失。
 * - `useType > 0`（指定分类/指定商品）：需要订单里的 spu 和分类，
 *   而 `oms_order_item.spu_id` / `category_id` 从来不写入（实测三列全 NULL）。
 *
 * 后端在校验时会返回带原因的错误而不是静默接受 —— 静默接受等于让运营
 * 建一个没人能领的活动，而且界面上看起来是成功的。
 */

export interface Coupon {
  id: Id
  /** 券类型[0 全场赠券 / 1 会员赠券 / 2 购物赠券 / 3 注册赠券]。目前只用 0。 */
  couponType: number | null
  couponName: string | null
  couponImg: string | null
  /** 面额（减多少）。 */
  amount: string | number | null
  /** 使用门槛（满多少可用），0 = 无门槛。 */
  minPoint: string | number | null
  /** 每人限领张数。 */
  perLimit: number | null
  /** 发行量 = 领取上限。业务上看这个，不看历史遗留的 num。 */
  publishCount: number | null
  /** 已领取数。只读，由领券流程推进。 */
  receiveCount: number | null
  /** 已使用数。只读，由用券流程推进。 */
  useCount: number | null
  /** 券本身的有效期（领到手之后能用到什么时候）。 */
  startTime: string | null
  endTime: string | null
  /** 领取窗口（什么时候之前能领）。 */
  enableStartTime: string | null
  enableEndTime: string | null
  /** 适用范围[0 全场通用 / 1 指定分类 / 2 指定商品]。只有 0 可用，见文件头。 */
  useType: number | null
  /** 可领取的会员等级，0 = 不限。只有 0 可用，见文件头。 */
  memberLevel: number | null
  /** 发布状态[0 未发布 / 1 已发布]。未发布的券不出现在促销页、也领不了。 */
  publish: number | null
  code: string | null
  note: string | null
  num: number | null
}

export interface CouponQuery {
  page: number
  limit: number
}

export function fetchCoupons(q: CouponQuery, signal?: AbortSignal): Promise<PageResult<Coupon>> {
  return fetchPage<Coupon>('/coupon/coupon/list', { ...q }, { signal })
}

export function fetchCouponDetail(id: Id, signal?: AbortSignal): Promise<Coupon> {
  return request<{ code: number; coupon: Coupon }>(`/coupon/coupon/info/${id}`, { signal })
    .then((r) => r.coupon)
}

/** 新建时提交的字段。刻意不包含 receiveCount / useCount / id，见文件头。 */
export type CouponDraft = Omit<Coupon, 'id' | 'receiveCount' | 'useCount' | 'num'>

export function saveCoupon(draft: CouponDraft): Promise<{ code: number; id?: Id; msg?: string }> {
  return request<{ code: number; id?: Id; msg?: string }>('/coupon/coupon/save', {
    method: 'POST',
    body: draft,
  })
}

export function updateCoupon(
  id: Id,
  draft: CouponDraft
): Promise<{ code: number; msg?: string }> {
  return request<{ code: number; msg?: string }>('/coupon/coupon/update', {
    method: 'POST',
    body: { ...draft, id },
  })
}

/**
 * 删除。请求体是 id 数组（生成器的批量删除约定）。
 *
 * <p><b>已被领取过的券后端会拒绝删除</b>，那是有意的：
 * `sms_coupon_history` 靠 coupon_id 关联券面信息（名称/面额/门槛都只存在
 * `sms_coupon` 上），删掉券之后用户"我的优惠券"里那些行 join 不上，
 * 会直接从列表里<b>消失</b>——手里的券凭空不见，且没有任何报错。
 * 想停止发放应当把发布状态改成未发布。
 */
export function deleteCoupons(ids: Id[]): Promise<{ code: number; msg?: string }> {
  return request<{ code: number; msg?: string }>('/coupon/coupon/delete', {
    method: 'POST',
    body: ids,
  })
}

// ---------------------------------------------------------------------------
// 领券记录
// ---------------------------------------------------------------------------

export interface CouponHistory {
  id: Id
  couponId: Id
  memberId: Id
  memberNickName: string | null
  /** 本人领取序号，1..perLimit。 */
  receiveSeq: number | null
  /** 获取方式[0 后台赠送 / 1 主动领取]。 */
  getType: number | null
  createTime: string | null
  /** 领取时冻结的失效时间，快照自 sms_coupon.end_time。 */
  expireTime: string | null
  /**
   * 使用状态[0 未使用 / 1 已使用]。
   *
   * <b>库里不存在 2（已过期）</b>：过期是读的时候按 expireTime 算的，
   * 没有定时任务去改这一列。所以按 status=2 筛会返回空 ——
   * 要查已过期的用 `expiredBefore` 参数。
   */
  useType: number | null
  useTime: string | null
  orderSn: string | null
}

export interface CouponHistoryQuery {
  page: number
  limit: number
  couponId?: Id
  memberId?: Id
  /** 0 未使用 / 1 已使用。传 2 无效，见 CouponHistory.useType 的注释。 */
  status?: number
  /** 查已过期：传当前时间，后端会筛 use_type=0 且 expire_time < 这个时间。 */
  expiredBefore?: string
  orderSn?: string
}

export function fetchCouponHistories(
  q: CouponHistoryQuery,
  signal?: AbortSignal
): Promise<PageResult<CouponHistory>> {
  return fetchPage<CouponHistory>('/coupon/couponhistory/list', { ...q }, { signal })
}

/** 已领量占发行量的比例，用于列表里的进度显示。发行量缺失时返回 0。 */
export function claimedRatio(c: Coupon): number {
  if (!c.publishCount || c.publishCount <= 0) return 0
  return Math.min(1, (c.receiveCount ?? 0) / c.publishCount)
}

/**
 * 券的当前状态。和后端 `CouponDao.selectPromotionCoupons` 的判据保持一致。
 *
 * <p>顺序有讲究：未发布优先于时间窗，因为一张未发布的券即使在时间窗内也领不了，
 * 显示成"可领取"会让人以为它已经上线了。
 */
export function couponState(c: Coupon): '未发布' | '领取未开始' | '领取已结束' | '已领完' | '可领取' {
  if (c.publish !== 1) return '未发布'
  const now = Date.now()
  if (c.enableStartTime && new Date(c.enableStartTime).getTime() > now) return '领取未开始'
  if (c.enableEndTime && new Date(c.enableEndTime).getTime() < now) return '领取已结束'
  if ((c.receiveCount ?? 0) >= (c.publishCount ?? 0)) return '已领完'
  return '可领取'
}
