import { OutboxPanel } from '@/components/OutboxPanel'

/**
 * 库存 Outbox（wms_stock_outbox_message）。
 *
 * 实现在 components/OutboxPanel —— 和订单 Outbox 共用一份，说明见那里。
 * 菜单 url = mq/ware-outbox。
 */
export default function WareOutboxPage() {
  return <OutboxPanel kind="ware" />
}
