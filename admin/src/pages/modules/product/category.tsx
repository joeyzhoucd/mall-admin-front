import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import {
  Box, Paper, Stack, Button, IconButton, Tooltip, Checkbox, Typography,
  Chip, CircularProgress, Alert, Snackbar, Dialog, DialogTitle, DialogContent,
  DialogActions, Badge,
} from '@mui/material'
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView'
import { TreeItem } from '@mui/x-tree-view/TreeItem'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import ArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import ArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import SaveIcon from '@mui/icons-material/Save'
import {
  fetchCategoryTree, createCategory, updateCategory, deleteCategories,
  saveCategoryPositions,
  type CategoryNode, type CategoryDraft, type CategoryPositionChange,
} from '@/api/product'
import type { Id } from '@/api/types'
import { CategoryForm } from '@/features/category/CategoryForm'

/**
 * 商品分类。
 *
 * <h3>和旧版一个刻意的差别：用「上移/下移」代替拖拽</h3>
 * 旧版是拖拽调整层级和顺序。MUI X Tree View 的<b>拖拽重排是 Pro（付费）功能</b>，
 * 社区版只提供了 TreeItemDragAndDropOverlay 这个原语和动作类型，
 * RichTreeView 上并没有对应的 prop。
 *
 * 所以这里换成：同级顺序用 ↑/↓ 按钮，换父分类在表单里选。
 * 能力是等价的，用的还是同一个接口（/product/category/save/drag），
 * 而且对键鼠操作来说比拖拽更精确 —— 拖拽在三层树上很容易掉错地方。
 *
 * <h3>顺序改动是「攒着的」，和旧版一致</h3>
 * 点 ↑/↓ 只改本地状态并累积到 pending 里，点「保存排序」才一次性提交。
 * 这样调整多个位置只发一次请求，也给了反悔的机会。
 * 顶部会显示待保存的数量 —— 不显示的话，改完直接离开会<b>悄悄丢掉</b>。
 */
export default function CategoryPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()

  const [expanded, setExpanded] = useState<string[]>([])
  const [checked, setChecked] = useState<Set<Id>>(new Set())
  const [editing, setEditing] = useState<{ node: CategoryNode | null; parent: CategoryNode | null } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<CategoryNode[] | null>(null)
  const [toast, setToast] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null)

  /** 本地未保存的顺序调整：catId → 新的 sort。 */
  const [pendingSort, setPendingSort] = useState<Map<Id, number>>(new Map())

  const treeQuery = useQuery({
    queryKey: ['category-tree'],
    queryFn: ({ signal }) => fetchCategoryTree(signal),
  })

  const onError = (e: unknown) =>
    setToast({ msg: e instanceof Error ? e.message : String(e), severity: 'error' })

  const refresh = (msg: string) => {
    void qc.invalidateQueries({ queryKey: ['category-tree'] })
    setToast({ msg, severity: 'success' })
  }

  const saveMutation = useMutation({
    mutationFn: (draft: CategoryDraft) =>
      draft.catId ? updateCategory(draft) : createCategory(draft),
    onSuccess: () => { setEditing(null); refresh('保存成功') },
    onError,
  })

  const deleteMutation = useMutation({
    mutationFn: (nodes: CategoryNode[]) => deleteCategories(nodes.map((n) => n.id)),
    onSuccess: () => {
      setConfirmDelete(null)
      setChecked(new Set())
      refresh('已删除')
    },
    onError,
  })

  const positionMutation = useMutation({
    mutationFn: (changes: CategoryPositionChange[]) => saveCategoryPositions(changes),
    onSuccess: () => { setPendingSort(new Map()); refresh('排序已保存') },
    onError,
  })

  /** 应用本地 pending 顺序后的树。展示的永远是「改完之后的样子」。 */
  const tree = useMemo(() => {
    const raw = treeQuery.data ?? []
    if (pendingSort.size === 0) return raw
    const apply = (nodes: CategoryNode[]): CategoryNode[] =>
      nodes
        .map((n) => ({ ...n, sort: pendingSort.get(n.id) ?? n.sort, children: apply(n.children) }))
        .sort((a, b) => a.sort - b.sort)
    return apply(raw)
  }, [treeQuery.data, pendingSort])

  /**
   * 和相邻兄弟交换位置。
   *
   * 交换的是 sort 值而不是数组下标 —— 后端只认 sort，
   * 只改数组顺序的话界面动了、保存上去却什么都没变。
   *
   * sort 可能有重复值（后端不保证唯一），所以交换前先按当前显示顺序
   * 重新编号，否则两个 sort 都是 0 的节点怎么换都换不动。
   */
  const move = (siblings: CategoryNode[], index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= siblings.length) return
    setPendingSort((prev) => {
      const next = new Map(prev)
      const reordered = [...siblings]
      const [moved] = reordered.splice(index, 1)
      if (!moved) return prev // index 越界。理论上到不了，但静默改错顺序更糟
      reordered.splice(target, 0, moved)
      reordered.forEach((n, i) => { if (n.sort !== i) next.set(n.id, i) })
      return next
    })
  }

  const toggleCheck = (id: Id) =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  /** 勾选集合还原成节点。批量删除要用到节点本身（名字、子节点数）。 */
  const checkedNodes = useMemo(() => {
    const out: CategoryNode[] = []
    const walk = (ns: CategoryNode[]) => ns.forEach((n) => { if (checked.has(n.id)) out.push(n); walk(n.children) })
    walk(tree)
    return out
  }, [tree, checked])

  const renderNodes = (siblings: CategoryNode[], parent: CategoryNode | null) =>
    siblings.map((node, index) => (
      <TreeItem
        key={node.id}
        itemId={node.id}
        label={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, py: 0.25 }}>
            <Checkbox
              size="small"
              checked={checked.has(node.id)}
              onClick={(e) => e.stopPropagation()} // 不然点复选框会顺带展开/折叠节点
              onChange={() => toggleCheck(node.id)}
              sx={{ p: 0.5 }}
            />
            <Typography variant="body2" sx={{ mr: 0.5 }}>{node.name}</Typography>

            {node.showStatus !== 1 && (
              <Chip size="small" label="隐藏" variant="outlined" sx={{ height: 18, fontSize: 11 }} />
            )}
            {pendingSort.has(node.id) && (
              <Chip size="small" color="warning" label="待保存" sx={{ height: 18, fontSize: 11 }} />
            )}

            <Box sx={{ flexGrow: 1 }} />

            {/* 按钮要挡住展开点击，否则每次操作都会连带展开/折叠 */}
            <Box onClick={(e) => e.stopPropagation()} sx={{ display: 'flex' }}>
              <Tooltip title="上移">
                <span>
                  <IconButton size="small" disabled={index === 0} onClick={() => move(siblings, index, -1)}>
                    <ArrowUpIcon fontSize="inherit" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="下移">
                <span>
                  <IconButton
                    size="small"
                    disabled={index === siblings.length - 1}
                    onClick={() => move(siblings, index, 1)}
                  >
                    <ArrowDownIcon fontSize="inherit" />
                  </IconButton>
                </span>
              </Tooltip>
              {/* 三级分类下面不再建子分类：这个后台的分类树就是三层，
                  第四层在前台是渲染不出来的。 */}
              {node.level < 3 && (
                <Tooltip title="添加子分类">
                  <IconButton size="small" onClick={() => setEditing({ node: null, parent: node })}>
                    <AddIcon fontSize="inherit" />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="编辑">
                <IconButton size="small" onClick={() => setEditing({ node, parent })}>
                  <EditIcon fontSize="inherit" />
                </IconButton>
              </Tooltip>
              <Tooltip title="删除">
                <IconButton size="small" color="error" onClick={() => setConfirmDelete([node])}>
                  <DeleteIcon fontSize="inherit" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        }
      >
        {node.children.length > 0 && renderNodes(node.children, node)}
      </TreeItem>
    ))

  return (
    <Box sx={{ p: 2 }}>
      <Paper variant="outlined">
        <Stack direction="row" spacing={1} sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider', alignItems: 'center' }}>
          <Button size="small" variant="contained" startIcon={<AddIcon />}
            onClick={() => setEditing({ node: null, parent: null })}>
            新增一级分类
          </Button>

          <Badge badgeContent={pendingSort.size} color="warning">
            <Button
              size="small" variant="outlined" startIcon={<SaveIcon />}
              disabled={pendingSort.size === 0 || positionMutation.isPending}
              onClick={() => positionMutation.mutate(collectChanges(tree, pendingSort))}
            >
              保存排序
            </Button>
          </Badge>
          {pendingSort.size > 0 && (
            <Button size="small" color="inherit" onClick={() => setPendingSort(new Map())}>
              撤销排序改动
            </Button>
          )}

          <Button
            size="small" color="error" variant="outlined" startIcon={<DeleteIcon />}
            disabled={checkedNodes.length === 0}
            onClick={() => setConfirmDelete(checkedNodes)}
          >
            批量删除{checkedNodes.length > 0 ? `（${checkedNodes.length}）` : ''}
          </Button>

          <Box sx={{ flexGrow: 1 }} />
          <Button size="small" onClick={() => navigate('/product-attr-group')}>
            属性分组管理
          </Button>
        </Stack>

        <Box sx={{ p: 1.5, minHeight: 200 }}>
          {treeQuery.error ? (
            <Alert severity="error" action={
              <Button color="inherit" size="small" onClick={() => void treeQuery.refetch()}>重试</Button>
            }>
              {treeQuery.error instanceof Error ? treeQuery.error.message : String(treeQuery.error)}
            </Alert>
          ) : treeQuery.isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={24} />
            </Box>
          ) : tree.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              还没有分类
            </Typography>
          ) : (
            <SimpleTreeView
              expandedItems={expanded}
              onExpandedItemsChange={(_e, ids) => setExpanded(ids)}
            >
              {renderNodes(tree, null)}
            </SimpleTreeView>
          )}
        </Box>
      </Paper>

      {editing && (
        <CategoryForm
          node={editing.node}
          parent={editing.parent}
          tree={tree}
          submitting={saveMutation.isPending}
          onCancel={() => setEditing(null)}
          onSubmit={(draft) => saveMutation.mutate(draft)}
        />
      )}

      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle>删除分类</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            将删除 {confirmDelete?.length ?? 0} 个分类：
            {confirmDelete?.map((n) => n.name).join('、')}
          </Typography>
          {/* 后端会拒绝「删父留子」，这里先说清楚，免得用户点了才发现 */}
          <Alert severity="info" variant="outlined">
            分类是逻辑删除。<b>下面还挂着子分类的分类不能删</b> ——
            要删整棵，请把父子一起勾上。
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>取消</Button>
          <Button
            color="error"
            disabled={deleteMutation.isPending}
            onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete)}
          >
            删除
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!toast}
        autoHideDuration={toast?.severity === 'error' ? null : 3000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={toast?.severity ?? 'success'} onClose={() => setToast(null)}>
          {toast?.msg}
        </Alert>
      </Snackbar>
    </Box>
  )
}

/**
 * 把 pending 的 sort 变化摊成后端要的载荷。
 *
 * parentCid 和 catLevel 一并带上，和旧前端发的载荷保持一致。
 * （后端 updateBatchById 的字段策略是 NOT_NULL，不传的列不会被改动，
 * 所以少传不会造成数据损坏 —— 带上只是为了让载荷自解释。）
 */
function collectChanges(tree: CategoryNode[], pending: Map<Id, number>): CategoryPositionChange[] {
  const out: CategoryPositionChange[] = []
  const walk = (ns: CategoryNode[]) =>
    ns.forEach((n) => {
      if (pending.has(n.id)) {
        out.push({ catId: n.id, parentCid: n.parentId, catLevel: n.level, sort: pending.get(n.id)! })
      }
      walk(n.children)
    })
  walk(tree)
  return out
}
