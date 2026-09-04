import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Stack,
  Typography, Chip, CircularProgress, Alert, List, ListItem, ListItemText,
  IconButton, Checkbox, Divider, Tooltip,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/LinkOff'
import {
  fetchGroupAttrs, fetchUnrelatedAttrs, addGroupAttrs, removeGroupAttr,
  type AttrGroup,
} from '@/api/attr'
import type { Id } from '@/api/types'

interface Props {
  group: AttrGroup
  onClose: () => void
  onToast: (t: { msg: string; severity: 'success' | 'error' }) => void
}

/**
 * 分组 ⇄ 属性 关联。
 *
 * <h3>和品牌那边的「关联分类」语义相反，别照抄</h3>
 * 品牌用的是 updateRelations —— <b>整体覆盖</b>，传什么就是什么。
 * 这里是 saveBatch + delete/{attrId}/{groupId} —— <b>增量</b>：
 * 勾选后点「添加关联」是追加，解除要一条条来。
 * 照着品牌那边写成「取消勾选就解除」会导致<b>什么都没解除</b>，
 * 而界面上勾选确实取消了，看起来像是成功了。
 *
 * 所以这里做成左右两栏（已关联 / 待添加），让「增量」这件事在界面上是明摆着的，
 * 而不是伪装成一个覆盖式的多选。
 */
export function AttrGroupRelationDialog({ group, onClose, onToast }: Props) {
  const qc = useQueryClient()
  const [picked, setPicked] = useState<Set<Id>>(new Set())

  const relatedQuery = useQuery({
    queryKey: ['group-attrs', group.attrGroupId],
    queryFn: ({ signal }) => fetchGroupAttrs(group.attrGroupId, signal),
  })

  const unrelatedQuery = useQuery({
    queryKey: ['group-unrelated-attrs', group.attrGroupId],
    queryFn: ({ signal }) => fetchUnrelatedAttrs(group.attrGroupId, signal),
  })

  const refresh = (msg: string) => {
    void qc.invalidateQueries({ queryKey: ['group-attrs', group.attrGroupId] })
    void qc.invalidateQueries({ queryKey: ['group-unrelated-attrs', group.attrGroupId] })
    // 属性列表里的「所属分组」列也跟着变了
    void qc.invalidateQueries({ queryKey: ['attrs'] })
    onToast({ msg, severity: 'success' })
  }
  const onError = (e: unknown) =>
    onToast({ msg: e instanceof Error ? e.message : String(e), severity: 'error' })

  const addMutation = useMutation({
    mutationFn: () => addGroupAttrs(group.attrGroupId, [...picked]),
    onSuccess: () => { setPicked(new Set()); refresh('已添加关联') },
    onError,
  })

  const removeMutation = useMutation({
    mutationFn: (attrId: Id) => removeGroupAttr(group.attrGroupId, attrId),
    onSuccess: () => refresh('已解除关联'),
    onError,
  })

  const toggle = (id: Id) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const loading = relatedQuery.isLoading || unrelatedQuery.isLoading
  const error = relatedQuery.error ?? unrelatedQuery.error
  const related = relatedQuery.data ?? []
  const unrelated = unrelatedQuery.data ?? []

  return (
    <Dialog open fullWidth maxWidth="md" onClose={onClose}>
      <DialogTitle>关联属性 · {group.attrGroupName}</DialogTitle>
      <DialogContent dividers>
        {error ? (
          <Alert severity="error">
            {error instanceof Error ? error.message : String(error)}
          </Alert>
        ) : loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} divider={<Divider flexItem orientation="vertical" />}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                已关联（{related.length}）
              </Typography>
              {related.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                  这个分组下还没有属性
                </Typography>
              ) : (
                <List dense sx={{ maxHeight: 340, overflowY: 'auto' }}>
                  {related.map((r) => (
                    <ListItem
                      key={r.id}
                      secondaryAction={
                        <Tooltip title="解除关联">
                          <IconButton
                            edge="end" size="small" color="error"
                            disabled={removeMutation.isPending}
                            onClick={() => removeMutation.mutate(r.attrId)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      }
                    >
                      <ListItemText
                        primary={r.attrName}
                        secondary={`#${r.attrId}`}
                        slotProps={{ secondary: { variant: 'caption' } }}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                可添加（{unrelated.length}）
              </Typography>
              {unrelated.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                  没有可添加的属性了
                </Typography>
              ) : (
                <List dense sx={{ maxHeight: 340, overflowY: 'auto' }}>
                  {unrelated.map((a) => (
                    <ListItem key={a.attrId} disablePadding>
                      <Checkbox
                        size="small"
                        checked={picked.has(a.attrId)}
                        onChange={() => toggle(a.attrId)}
                      />
                      <ListItemText
                        primary={a.attrName}
                        secondary={`#${a.attrId}`}
                        slotProps={{ secondary: { variant: 'caption' } }}
                      />
                      {a.enable !== '1' && (
                        <Chip size="small" label="已禁用" variant="outlined" sx={{ height: 20 }} />
                      )}
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Typography variant="caption" color="text.secondary" sx={{ mr: 'auto', ml: 2 }}>
          添加是追加，解除要在左侧逐条点
        </Typography>
        <Button onClick={onClose}>关闭</Button>
        <Button
          variant="contained"
          disabled={picked.size === 0 || addMutation.isPending}
          onClick={() => addMutation.mutate()}
        >
          {addMutation.isPending ? '添加中…' : `添加关联（${picked.size}）`}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
