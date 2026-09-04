import type { ReactNode } from 'react'
import { useTable, tableFeatures, type ColumnDef, type RowData } from '@tanstack/react-table'
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, Paper, Box, Typography, CircularProgress, Alert, Button,
} from '@mui/material'

/**
 * 表格的特性集合。**故意是空的**。
 *
 * TanStack Table v9 要求显式声明启用哪些特性（v8 是按需引入 row model）。
 * 这里一个都不开，因为分页、筛选、排序<b>全部由后端做</b> ——
 * 开客户端分页会得到一个「只在当前这一页里分页」的表格，
 * 那种错在数据少于一页时完全看不出来，等数据一多才暴露。
 *
 * 以后要行选择（批量删除）就在这里加 rowSelectionFeature，
 * 要列显隐就加 columnVisibilityFeature —— 都是加一行，不用重写。
 *
 * columnMeta 是 v9 提供的「每列附加信息」槽位，值是幻影的（运行时被丢掉），
 * 只有类型有意义。列宽走这里而不是 columnDef.size ——
 * size 属于 columnSizingFeature，为了一个静态宽度去开一整套列宽调整不划算。
 */
const features = tableFeatures({
  columnMeta: {} as { width?: number | string; align?: 'left' | 'right' | 'center' },
})

/** 列定义。用 TanStack 的类型，这样 accessorKey 和 cell 渲染都有类型检查。 */
export type Col<T extends RowData> = ColumnDef<typeof features, T>

export interface DataTableProps<T extends RowData> {
  columns: Col<T>[]
  rows: T[]
  /** 行的稳定标识。给错会让 React 复用错行，表现为「翻页后某一行的展开状态串了」。 */
  getRowId: (row: T) => string
  /** 服务端分页状态。页码<b>从 1 开始</b>（后端约定），而 MUI 的 TablePagination 从 0 开始，在这里换算。 */
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  isLoading?: boolean
  /** 取数失败。传进来而不是自己 catch —— 组件不该知道数据是怎么来的。 */
  error?: unknown
  onRetry?: () => void
  /** 表格上方的工具条：搜索框、新增按钮之类。 */
  toolbar?: ReactNode
  /** 没有数据时显示的话。默认「暂无数据」。 */
  emptyText?: string
}

/**
 * 服务端分页的表格。
 *
 * <h3>为什么把「加载中 / 出错 / 空」三种状态揉在这里</h3>
 * 因为它们在界面上长得太像了 —— 都是「表格里没有行」。
 * 这个项目里反复出现的失败形状正是这个：列表空着但不报错，
 * 分不清是「真的没有数据」「还在加载」还是「请求挂了」。
 * 每个页面各写一遍必然有人漏掉其中一种，所以在这里一次性做对，
 * 并且<b>出错时要显式说出来</b>，而不是安静地显示一个空表格。
 */
export function DataTable<T extends RowData>({
  columns, rows, getRowId,
  page, pageSize, total, onPageChange, onPageSizeChange,
  isLoading, error, onRetry, toolbar, emptyText = '暂无数据',
}: DataTableProps<T>) {
  const table = useTable<typeof features, T>({
    features,
    columns,
    data: rows,
    getRowId,
  })

  const colCount = columns.length

  return (
    <Paper variant="outlined" sx={{ display: 'flex', flexDirection: 'column' }}>
      {toolbar && (
        <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>{toolbar}</Box>
      )}

      {/* 出错时把表格整个换成告警，而不是在空表格上方加一行小字 ——
          后者太容易被忽略，用户会以为「就是没有数据」。 */}
      {error ? (
        <Alert
          severity="error"
          sx={{ m: 1.5 }}
          action={onRetry && <Button color="inherit" size="small" onClick={onRetry}>重试</Button>}
        >
          {error instanceof Error ? error.message : String(error)}
        </Alert>
      ) : (
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id}>
                  {hg.headers.map((h) => (
                    <TableCell
                      key={h.id}
                      align={h.column.columnDef.meta?.align ?? 'left'}
                      sx={{ whiteSpace: 'nowrap', fontWeight: 600, width: h.column.columnDef.meta?.width }}
                    >
                      <table.FlexRender header={h} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableHead>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={colCount} align="center" sx={{ py: 4, border: 0 }}>
                    <CircularProgress size={22} />
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={colCount} align="center" sx={{ py: 4, border: 0 }}>
                    <Typography variant="body2" color="text.secondary">{emptyText}</Typography>
                  </TableCell>
                </TableRow>
              )}
              {!isLoading &&
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} hover>
                    {/* getAllCells 而不是 getVisibleCells：后者属于 columnVisibilityFeature，
                        而这里没开列显隐，所有列本来就都可见。 */}
                    {row.getAllCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        align={cell.column.columnDef.meta?.align ?? 'left'}
                        sx={{ whiteSpace: 'nowrap' }}
                      >
                        <table.FlexRender cell={cell} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* 后端页码从 1 开始，MUI 从 0 开始。换算只在这一个地方做。
          两边都直接用会得到「第一页显示第二页的数据」，而且首页看起来是对的。 */}
      <TablePagination
        component="div"
        count={total}
        page={total === 0 ? 0 : page - 1}
        onPageChange={(_, p) => onPageChange(p + 1)}
        rowsPerPage={pageSize}
        onRowsPerPageChange={(e) => {
          onPageSizeChange(Number(e.target.value))
          onPageChange(1) // 换每页条数后必须回第一页，否则可能停在一个已经不存在的页码上
        }}
        rowsPerPageOptions={[10, 20, 50, 100]}
        labelRowsPerPage="每页"
        labelDisplayedRows={({ from, to, count }) => `${from}–${to} / 共 ${count} 条`}
      />
    </Paper>
  )
}
