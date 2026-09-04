import { AttrListPage } from '@/features/attr/AttrListPage'

/**
 * 规格参数。
 *
 * 和销售属性（attr-sale）共用一套实现，差别只有接口前缀和「有没有属性分组」——
 * 旧版是两个几乎一模一样的文件，复制的那份迟早只有一边被改到。
 *
 * 接口对照 BASELINE.md 的 attr-spec.vue：
 *   /product/attr/spec/list /save /update /delete /delete/{} /updateEnable
 *   /product/attrgroup/list（分组下拉）
 */
export default function AttrSpecPage() {
  return <AttrListPage kind="spec" title="规格参数" withGroup />
}
