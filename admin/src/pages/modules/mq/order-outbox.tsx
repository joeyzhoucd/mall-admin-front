import { OutboxPanel } from '@/components/OutboxPanel'

/**
 * 订单 Outbox（oms_order_outbox_message）。
 *
 * 实现在 components/OutboxPanel —— 和库存 Outbox 共用一份。
 * 这里只是一个入口：菜单上要有两项、路由要有两条，
 * 因为运维找的是「订单的消息卡住了」，而不是「Outbox 里订单那一类」。
 *
 * 菜单 url = mq/order-outbox，对应路由 /mq-order-outbox。
 * 这个「目录名/文件名 ↔ url」的对应关系由 import.meta.glob 决定，
 * 改 url 就必须同时改文件路径，否则会落到占位页 —— 不报错，但什么都没有。
 */
export default function OrderOutboxPage() {
  return <OutboxPanel kind="order" />
}
