/// <reference types="vite/client" />
// 这一行提供 import.meta.glob / import.meta.env 的类型。
// 缺了它 pageRegistry.ts 会报 "Property 'glob' does not exist on type 'ImportMeta'"。
