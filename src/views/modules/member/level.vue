<template>
  <div class="mod-member-level">
    <el-form :inline="true" :model="query" class="toolbar">
      <el-form-item>
        <el-input v-model="query.name" placeholder="等级名称" clearable style="width: 200px" />
      </el-form-item>
      <el-form-item>
        <el-select v-model="query.defaultStatus" placeholder="默认等级" clearable style="width: 140px">
          <el-option :value="1" label="是" />
          <el-option :value="0" label="否" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="search">查询</el-button>
        <el-button type="success" @click="addOrUpdate()">新增</el-button>
        <el-button type="danger" :disabled="ids.length===0" @click="batchDel">批量删除</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="list" v-loading="loading" style="width: 100%" @selection-change="onSelection" size="mini">
      <el-table-column type="selection" width="45" />
      <el-table-column prop="id" label="ID" width="100" align="center" />
      <el-table-column prop="name" label="等级名称" min-width="160" align="center" />
      <el-table-column prop="growthPoint" label="成长值" width="100" align="center" />
      <el-table-column prop="defaultStatus" label="默认等级" width="100" align="center">
        <template slot-scope="scope">
          <el-tag :type="scope.row.defaultStatus === 1 ? 'success' : 'info'" size="mini">
            {{ scope.row.defaultStatus === 1 ? '是' : '否' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="freeFreightPoint" label="免运费标准" width="140" align="center" />
      <el-table-column label="特权" min-width="220" align="center">
        <template slot-scope="scope">
          <el-tag size="mini" :type="scope.row.priviledgeFreeFreight===1?'success':'info'">免邮</el-tag>
          <el-tag size="mini" :type="scope.row.priviledgeMemberPrice===1?'success':'info'" style="margin-left:6px">会员价</el-tag>
          <el-tag size="mini" :type="scope.row.priviledgeBirthday===1?'success':'info'" style="margin-left:6px">生日</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="note" label="备注" min-width="160" align="center" />
      <el-table-column label="操作" width="140" align="center">
        <template slot-scope="scope">
          <el-button type="text" size="mini" @click="addOrUpdate(scope.row)">编辑</el-button>
          <el-button type="text" size="mini" style="color:#f56c6c" @click="del(scope.row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      class="pager"
      @size-change="onSizeChange"
      @current-change="onPageChange"
      :current-page="page"
      :page-sizes="[10,20,50,100]"
      :page-size="limit"
      layout="total, sizes, prev, pager, next, jumper"
      :total="total" />

    <el-dialog :title="dialogTitle" :visible.sync="dialogVisible" width="520px">
      <el-form ref="form" :model="form" :rules="rules" label-width="120px">
        <el-form-item label="等级名称" prop="name">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="等级成长值" prop="growthPoint">
          <el-input-number v-model="form.growthPoint" :min="0" :step="10" />
        </el-form-item>
        <el-form-item label="默认等级" prop="defaultStatus">
          <el-switch v-model="form.defaultStatus" :active-value="1" :inactive-value="0" />
        </el-form-item>
        <el-form-item label="免运费标准" prop="freeFreightPoint">
          <el-input v-model="form.freeFreightPoint" />
        </el-form-item>
        <el-form-item label="评价成长值" prop="commentGrowthPoint">
          <el-input-number v-model="form.commentGrowthPoint" :min="0" />
        </el-form-item>
        <el-form-item label="免邮特权" prop="priviledgeFreeFreight">
          <el-switch v-model="form.priviledgeFreeFreight" :active-value="1" :inactive-value="0" />
        </el-form-item>
        <el-form-item label="会员价特权" prop="priviledgeMemberPrice">
          <el-switch v-model="form.priviledgeMemberPrice" :active-value="1" :inactive-value="0" />
        </el-form-item>
        <el-form-item label="生日特权" prop="priviledgeBirthday">
          <el-switch v-model="form.priviledgeBirthday" :active-value="1" :inactive-value="0" />
        </el-form-item>
        <el-form-item label="备注" prop="note">
          <el-input v-model="form.note" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <div slot="footer">
        <el-button @click="dialogVisible=false">取 消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">保 存</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import http from '@/utils/httpRequest'

export default {
  name: 'MemberLevel',
  data () {
    return {
      loading: false,
      list: [],
      ids: [],
      page: 1,
      limit: 10,
      total: 0,
      query: { name: '', defaultStatus: undefined },
      dialogVisible: false,
      dialogTitle: '',
      saving: false,
      form: {
        id: null,
        name: '',
        growthPoint: 0,
        defaultStatus: 0,
        freeFreightPoint: '',
        commentGrowthPoint: 0,
        priviledgeFreeFreight: 0,
        priviledgeMemberPrice: 0,
        priviledgeBirthday: 0,
        note: ''
      },
      rules: {
        name: [{ required: true, message: '请输入等级名称', trigger: 'blur' }]
      }
    }
  },
  created () {
    this.fetchList()
  },
  methods: {
    async fetchList () {
      this.loading = true
      try {
        const { data } = await http({
          url: http.adornUrl('/member/memberlevel/list'),
          method: 'get',
          params: http.adornParams({
            page: this.page,
            limit: this.limit,
            key: this.query.name,
            defaultStatus: this.query.defaultStatus
          })
        })
        if (data && data.code === 0) {
          const raw = (data.page && data.page.list) || (data.data && data.data.list) || []
          // 统一将数值型开关字段转为数字，避免 '0' 在组件中被当作 true
          this.list = raw.map(item => ({
            ...item,
            id: item.id != null ? String(item.id) : null,
            defaultStatus: typeof item.defaultStatus === 'string' ? parseInt(item.defaultStatus) || 0 : item.defaultStatus,
            priviledgeFreeFreight: typeof item.priviledgeFreeFreight === 'string' ? parseInt(item.priviledgeFreeFreight) || 0 : item.priviledgeFreeFreight,
            priviledgeMemberPrice: typeof item.priviledgeMemberPrice === 'string' ? parseInt(item.priviledgeMemberPrice) || 0 : item.priviledgeMemberPrice,
            priviledgeBirthday: typeof item.priviledgeBirthday === 'string' ? parseInt(item.priviledgeBirthday) || 0 : item.priviledgeBirthday
          }))
          this.total = (data.page && data.page.totalCount) || (data.data && data.data.totalCount) || 0
        }
      } finally { this.loading = false }
    },
    search () { this.page = 1; this.fetchList() },
    onSelection (rows) { this.ids = rows.map(r => r.id) },
    onSizeChange (v) { this.limit = v; this.page = 1; this.fetchList() },
    onPageChange (v) { this.page = v; this.fetchList() },
    addOrUpdate (row) {
      this.dialogTitle = row ? '编辑会员等级' : '新增会员等级'
      this.dialogVisible = true
      this.$nextTick(() => {
        this.$refs.form && this.$refs.form.clearValidate()
      })
      if (row) {
        // 复制并规范化类型
        this.form = {
          ...row,
          defaultStatus: typeof row.defaultStatus === 'string' ? parseInt(row.defaultStatus) || 0 : row.defaultStatus,
          priviledgeFreeFreight: typeof row.priviledgeFreeFreight === 'string' ? parseInt(row.priviledgeFreeFreight) || 0 : row.priviledgeFreeFreight,
          priviledgeMemberPrice: typeof row.priviledgeMemberPrice === 'string' ? parseInt(row.priviledgeMemberPrice) || 0 : row.priviledgeMemberPrice,
          priviledgeBirthday: typeof row.priviledgeBirthday === 'string' ? parseInt(row.priviledgeBirthday) || 0 : row.priviledgeBirthday
        }
      } else {
        this.form = { id: null, name: '', growthPoint: 0, defaultStatus: 0, freeFreightPoint: '', commentGrowthPoint: 0, priviledgeFreeFreight: 0, priviledgeMemberPrice: 0, priviledgeBirthday: 0, note: '' }
      }
    },
    async submit () {
      this.$refs.form.validate(async (valid) => {
        if (!valid) return
        this.saving = true
        try {
          const url = this.form.id ? '/member/memberlevel/update' : '/member/memberlevel/save'
          const payload = { ...this.form }
          // 将主键统一为字符串，避免 JS Number 精度丢失
          if (payload.id != null) payload.id = String(payload.id)
          const { data } = await http({ url: http.adornUrl(url), method: 'post', data: http.adornData(payload) })
          if (data && data.code === 0) {
            this.$message.success('保存成功')
            this.dialogVisible = false
            this.fetchList()
          }
        } finally { this.saving = false }
      })
    },
    async del (row) {
      await this.$confirm('确认删除该等级吗？', '提示', { type: 'warning' })
      await http({ url: http.adornUrl('/member/memberlevel/delete'), method: 'post', data: http.adornData([row.id]) })
      this.$message.success('删除成功'); this.fetchList()
    },
    async batchDel () {
      if (this.ids.length === 0) return
      await this.$confirm(`确认删除选中的 ${this.ids.length} 条记录吗？`, '提示', { type: 'warning' })
      await http({ url: http.adornUrl('/member/memberlevel/delete'), method: 'post', data: http.adornData(this.ids) })
      this.$message.success('删除成功'); this.fetchList()
    }
  }
}
</script>

<style scoped>
.toolbar { margin-bottom: 12px; }
.pager { margin-top: 12px; text-align: right; }
</style>


