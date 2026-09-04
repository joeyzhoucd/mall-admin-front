import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Box, TextField, Button, Stack, List, ListItemButton, ListItemText,
  Typography, CircularProgress, Chip, Alert,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import { fetchSkus, type Sku } from '@/api/product'

interface Props {
  value: Sku | null
  onChange: (sku: Sku | null) => void
}

/**
 * 按名称/ID 搜一个 SKU 出来。
 *
 * <h3>为什么不是下拉框</h3>
 * SKU 有一万多条（10004 个 SPU，每个下面还有多个 SKU），
 * 下拉框要么得全量拉下来（几 MB、几秒钟），要么只显示第一页 ——
 * 后者的表现是「想选的商品根本不在列表里」，而用户不知道为什么。
 * 所以做成搜索：输入关键字，从后端分页查，选中一条。
 */
export function SkuPicker({ value, onChange }: Props) {
  const [keyword, setKeyword] = useState('')
  const [search, setSearch] = useState('')

  const query = useQuery({
    queryKey: ['sku-search', search],
    queryFn: ({ signal }) => fetchSkus({ page: 1, limit: 20, key: search }, signal),
    // 没输关键字时不查 —— 查了会拿回「第一页 20 条」，
    // 那看起来像是搜索结果，其实只是碰巧排在前面的商品。
    enabled: search.trim() !== '',
  })

  if (value) {
    return (
      <Box>
        <Typography variant="body2" sx={{ mb: 0.5 }}>秒杀商品</Typography>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Chip label={`${value.skuName}（#${value.skuId}）`} onDelete={() => onChange(null)} />
          <Typography variant="caption" color="text.secondary">
            原价 ¥{Number(value.price).toFixed(2)}
          </Typography>
        </Stack>
      </Box>
    )
  }

  return (
    <Box>
      <Typography variant="body2" sx={{ mb: 0.5 }}>秒杀商品</Typography>
      <Stack direction="row" spacing={1}>
        <TextField
          size="small" fullWidth placeholder="按 SKU 名称或 ID 搜索"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setSearch(keyword) } }}
        />
        <Button size="small" startIcon={<SearchIcon />} onClick={() => setSearch(keyword)}>
          搜索
        </Button>
      </Stack>

      {query.isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={20} />
        </Box>
      )}
      {query.error && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {query.error instanceof Error ? query.error.message : '搜索失败'}
        </Alert>
      )}
      {search && !query.isLoading && (query.data?.list.length ?? 0) === 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          没有匹配「{search}」的 SKU
        </Typography>
      )}
      {(query.data?.list.length ?? 0) > 0 && (
        <List dense sx={{ maxHeight: 220, overflowY: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, mt: 1 }}>
          {(query.data?.list ?? []).map((s) => (
            <ListItemButton key={s.skuId} onClick={() => onChange(s)}>
              <ListItemText
                primary={s.skuName}
                secondary={`#${s.skuId} · 原价 ¥${Number(s.price).toFixed(2)}`}
                slotProps={{ secondary: { variant: 'caption' } }}
              />
            </ListItemButton>
          ))}
        </List>
      )}
      {query.data && query.data.totalCount > (query.data.list?.length ?? 0) && (
        <Typography variant="caption" color="text.secondary">
          共 {query.data.totalCount} 条，只显示前 {query.data.list.length} 条 —— 关键字再具体一些
        </Typography>
      )}
    </Box>
  )
}
