import { fetchPage } from './client'
import type { Id, PageResult } from './types'

/**
 * 会员域接口。
 *
 * 目前只用到会员等级 —— 发布商品时要给每个等级设会员价。
 * 会员管理本身还没做：MemberController 上没有 /list 和 /info/{id}，
 * 而同服务的其它控制器（等级、登录日志、收货地址）都留着完整 CRUD，
 * 说明主实体的 CRUD 是被人拿掉的，要做会员管理得先补后端查询接口。
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
