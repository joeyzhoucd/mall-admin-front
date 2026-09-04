import { AttrListPage } from '@/features/attr/AttrListPage'

/**
 * 销售属性。
 *
 * 和规格参数（attr-spec）共用实现。销售属性不归属性分组，
 * 所以 withGroup 为 false —— 这也是基线里 attr-sale.vue 比 attr-spec.vue
 * 少一个 /product/attrgroup/list 的原因。
 *
 * 接口对照 BASELINE.md 的 attr-sale.vue：
 *   /product/attr/sale/list /save /update /delete /delete/{} /updateEnable
 */
export default function AttrSalePage() {
  return <AttrListPage kind="sale" title="销售属性" withGroup={false} />
}
