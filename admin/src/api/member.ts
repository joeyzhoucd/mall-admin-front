import { request, fetchPage } from './client'
import type { Id, PageResult } from './types'

/**
 * 会员域接口。
 *
 * <h3>列表和详情是 2026-09-06 才补的</h3>
 * MemberService.queryPage 一直存在，但 MemberController 上没有 /list 和
 * /info/{id}，而同服务的其它控制器（等级、登录日志、收货地址、成长值记录）
 * 都留着完整的生成器 CRUD —— 说明主实体这两个是被人拿掉的。
 * 和订单那次是同一个情况。
 *
 * <h3>返回的不是实体，是 MemberAdminVo</h3>
 * MemberEntity 上有 password（BCrypt 哈希）、accessToken（第三方登录令牌）
 * 和 socialUid，这三个绝对不能出后端。后端用<b>白名单</b> VO 拦住 ——
 * 新增实体字段时默认不出现在响应里，而不是默认出现。
 *
 * <h3>列表脱敏，详情不脱敏</h3>
 * 列表里手机号是 138****5678、邮箱是 j*******@x.com。
 * <b>搜索不受影响</b>：按完整手机号搜打的还是真实列，
 * 所以「能搜到但显示成星号」是预期行为，不是 bug。
 */

export interface MemberLevel {
  id: Id
  name: string
  /** 达到该等级所需成长值。 */
  growthPoint: number
  /** 1 表示是新用户的默认等级。 */
  defaultStatus: number
}

export function fetchMemberLevels(
  q: { page: number; limit: number },
  signal?: AbortSignal
): Promise<PageResult<MemberLevel>> {
  // 容器键名（page 还是 data）由 fetchPage 兜住 —— 这个接口在别的服务里，
  // 两种约定都出现过，不该由调用方来猜。
  return fetchPage<MemberLevel>('/member/memberlevel/list', { ...q }, { signal })
}

export interface Member {
  id: Id
  levelId: Id | null
  /**
   * 等级名。<b>当前线上 ums_member_level 是空表</b>（2026-09-06 实测 0 行），
   * 所以这一列全是 null，界面要回落到显示 levelId。
   */
  levelName: string | null
  username: string | null
  nickname: string | null
  /** 列表里已脱敏；详情里是全量。 */
  mobile: string | null
  email: string | null
  /** 头像 URL。后端实体这个字段叫 header，不叫 icon。 */
  header: string | null
  gender: number | null
  birth: string | null
  city: string | null
  job: string | null
  sign: string | null
  sourceType: number | null
  integration: number | null
  growth: number | null
  /**
   * 启用状态。<b>当前 103 个会员这一列全是 NULL</b>（2026-09-06 实测）——
   * 注册流程从来没给它赋过值。所以 null 不能显示成「正常」，
   * 那是在替一个从未被设置过的字段编造含义。
   */
  status: number | null
  createTime: string | null
}

export interface MemberQuery {
  page: number
  limit: number
  /** 用户名 / 昵称 / 手机号，模糊。 */
  key?: string
  levelId?: Id
  status?: number
  createTimeFrom?: string
  createTimeTo?: string
}

export function fetchMembers(q: MemberQuery, signal?: AbortSignal): Promise<PageResult<Member>> {
  return fetchPage<Member>('/member/member/list', { ...q }, { signal })
}

/** 详情。联系方式是全量的 —— 打开这一个动作本身就是"我要看这个人"的意思。 */
export function fetchMemberDetail(id: Id, signal?: AbortSignal): Promise<Member> {
  return request<{ code: number; member: Member }>(`/member/member/info/${id}`, { signal })
    .then((r) => r.member)
}

/** 性别：0 未知 / 1 男 / 2 女。null 显示成「未填写」而不是「未知」—— 两者不是一回事。 */
export function genderLabel(gender: number | null | undefined): string {
  if (gender === null || gender === undefined) return '未填写'
  switch (gender) {
    case 1: return '男'
    case 2: return '女'
    default: return '未知'
  }
}
