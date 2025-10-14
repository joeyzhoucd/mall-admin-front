<template>
  <div class="purchase-page">
    <el-card class="filter-card">
      <el-form :inline="true" :model="query" @keyup.enter.native="getDataList()">
        <el-form-item label="状态">
          <el-select v-model="query.status" clearable placeholder="请选择状态" style="width:140px">
            <el-option v-for="s in orderStatus" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键字">
          <el-input v-model="query.key" clearable placeholder="关键字" style="width:180px" />
        </el-form-item>
        <el-form-item label="参数名">
          <el-input v-model="query.param" clearable placeholder="参数名" style="width:180px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="getDataList">查询</el-button>
          <el-button @click="resetQuery">重置</el-button>
          <el-button type="success" @click="openEdit()">新增</el-button>
          <el-button type="danger" :disabled="selections.length===0" @click="batchDelete">批量删除</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card>
      <el-table :data="dataList" border v-loading="loading" @selection-change="val=>selections=val" style="width: 100%">
        <el-table-column type="selection" width="50" />
        <el-table-column prop="id" label="采购单id" width="180" align="center" />
        <el-table-column prop="assigneeId" label="采购人id" width="100" align="center" />
        <el-table-column prop="assigneeName" label="采购人名" min-width="200" align="center" />
        <el-table-column prop="phone" label="联系方式" width="120" align="center" />
        <el-table-column prop="priority" label="优先级" width="80" align="center" />
        <el-table-column prop="status" label="状态" width="80" align="center">
          <template slot-scope="scope">{{ statusText(scope.row.status) }}</template>
        </el-table-column>
        <el-table-column prop="amount" label="总金额" width="100" align="center" />
        <el-table-column prop="createTime" label="创建日期" width="200" align="center" />
        <el-table-column prop="updateTime" label="更新日期" width="200" align="center" />
        <el-table-column label="操作" width="160" align="center">
          <template slot-scope="scope">
            <el-button type="text" size="small" @click="openEdit(scope.row)">编辑</el-button>
            <el-button type="text" size="small" @click="openAssign(scope.row)" v-if="scope.row.status === 0 || scope.row.status === 1">分配</el-button>
            <el-button type="text" size="small" @click="delOne(scope.row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination class="pager"
        @size-change="val=>{pageSize=val; pageIndex=1; getDataList()}"
        @current-change="val=>{pageIndex=val; getDataList()}"
        :current-page="pageIndex" :page-sizes="[10,20,50]" :page-size="pageSize"
        layout="total, sizes, prev, pager, next, jumper" :total="total" />
    </el-card>

    <!-- 新建/编辑采购单（简单字段） -->
    <el-dialog :title="form.id ? '编辑采购单' : '新建采购单'" :visible.sync="dlg.edit" width="520px">
      <el-form ref="form" :model="form" label-width="100px">
        <el-form-item label="优先级"><el-input-number v-model="form.priority" :min="0" /></el-form-item>
      </el-form>
      <span slot="footer">
        <el-button @click="dlg.edit=false">取消</el-button>
        <el-button type="primary" @click="submit()">确定</el-button>
      </span>
    </el-dialog>

    <!-- 分配采购员 -->
    <el-dialog title="分配采购员" :visible.sync="dlg.assign" width="520px">
      <el-form label-width="100px">
        <el-form-item label="采购员">
          <el-select v-model="assignUser" filterable placeholder="选择采购员" style="width:100%">
            <el-option v-for="u in userOptions" :key="u.userId" :label="u.username + (u.mobile ? ' / ' + u.mobile : '')" :value="u.userId" />
          </el-select>
        </el-form-item>
      </el-form>
      <span slot="footer">
        <el-button @click="dlg.assign=false">取消</el-button>
        <el-button type="primary" @click="doAssign">确定</el-button>
      </span>
    </el-dialog>

    <!-- 完成采购 -->
    <el-dialog title="完成采购" :visible.sync="dlg.finish" width="680px">
      <div>
        <p>仅演示完成流程：默认将该采购单的明细全部视为成功入库（后续可细化为逐项编辑）。</p>
      </div>
      <span slot="footer">
        <el-button @click="dlg.finish=false">取消</el-button>
        <el-button type="primary" @click="doFinish">完成</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
import http from '@/utils/httpRequest'

export default {
  name: 'Purchase',
  data () {
    return {
      query: { status: null },
      pageIndex: 1,
      pageSize: 10,
      total: 0,
      dataList: [],
      loading: false,
      selections: [],
      dlg: { edit: false, assign: false, finish: false },
      form: { id: 0, priority: 0 },
      orderStatus: [
        { label: '新建', value: 0 },
        { label: '已分配', value: 1 },
        { label: '已领取', value: 2 },
        { label: '已完成', value: 3 },
        { label: '有异常', value: 4 }
      ],
      assignUser: null,
      userOptions: [],
      currentPurchase: null
    }
  },
  created () { this.getDataList() },
  methods: {
    statusText (v) { const m = this.orderStatus.find(i => i.value === v); return m ? m.label : v },
    getDataList () {
      this.loading = true
      http({
        url: http.adornUrl('/ware/purchase/list'),
        method: 'get',
        params: http.adornParams({
          page: this.pageIndex,
          limit: this.pageSize,
          status: this.query.status
        })
      }).then(({ data }) => {
        if (data && data.code === 0) { this.dataList = data.page.list || []; this.total = data.page.totalCount || 0 } else { this.dataList = []; this.total = 0 }
      }).finally(() => { this.loading = false })
    },
    resetQuery () { this.query = { status: null }; this.pageIndex = 1; this.getDataList() },
    openEdit (row) { this.dlg.edit = true; this.form = row ? { ...row } : { id: 0, priority: 0 } },
    submit () {
      const url = this.form.id ? '/ware/purchase/update' : '/ware/purchase/save'
      const payload = this.form.id ? { id: this.form.id, priority: this.form.priority } : { priority: this.form.priority }
      http({ url: http.adornUrl(url), method: 'post', data: http.adornData(payload) })
        .then(({ data }) => { if (data && data.code === 0) { this.$message.success('操作成功'); this.dlg.edit = false; this.getDataList() } else { this.$message.error(data.msg) } })
    },
    delOne (id) { this.$confirm('确认删除该采购单？', '提示', { type: 'warning' }).then(() => this._delete([id])) },
    batchDelete () { if (this.selections.length) this._delete(this.selections.map(i => i.id)) },
    _delete (ids) {
      http({
        url: http.adornUrl('/ware/purchase/delete'),
        method: 'post',
        data: ids
      }).then(({ data }) => {
        if (data && data.code === 0) { this.$message.success('删除成功'); this.getDataList() } else { this.$message.error(data.msg) }
      })
    },
    openAssign (row) {
      this.assignUser = null
      this.loadUsers()
      this.dlg.assign = true
      this.currentPurchase = row
    },
    loadUsers () {
      // 复用系统用户接口（从登录体系中获取用户列表）
      http({ url: http.adornUrl('/sys/user/list'), method: 'get', params: http.adornParams({ page: 1, limit: 1000 }) })
        .then(({ data }) => { if (data && data.code === 0) this.userOptions = (data.page && data.page.list) || [] })
    },
    doAssign () {
      if (!this.assignUser) return this.$message.warning('请选择采购员')
      const u = this.userOptions.find(x => String(x.userId) === String(this.assignUser)) || {}
      const body = { purchaseId: this.currentPurchase.id, assigneeId: u.userId, assigneeName: u.username, phone: u.mobile }
      http({ url: http.adornUrl('/ware/purchase/assign'), method: 'post', data: http.adornData(body, false) })
        .then(({ data }) => { if (data && data.code === 0) { this.$message.success('分配成功'); this.dlg.assign = false; this.getDataList() } else { this.$message.error(data.msg) } })
    },
    receive () {
      const ids = this.selections.map(i => i.id)
      if (ids.length === 0) return
      http({ url: http.adornUrl('/ware/purchase/receive'), method: 'post', data: http.adornData({ purchaseIds: ids, receiverId: null, receiverName: null }, false) })
        .then(({ data }) => { if (data && data.code === 0) { this.$message.success('领取成功'); this.getDataList() } else { this.$message.error(data.msg) } })
    },
    openFinish () { this.dlg.finish = true },
    doFinish () {
      const pid = this.selections[0].id
      // 简化：全部明细完成入库，真实项目可先查询该单下的明细，分成功/失败提交
      http({ url: http.adornUrl('/ware/purchase/finish'), method: 'post', data: http.adornData({ purchaseId: pid, successDetailIds: [], failedDetailIds: [] }, false) })
        .then(({ data }) => { if (data && data.code === 0) { this.$message.success('已完成'); this.dlg.finish = false; this.getDataList() } else { this.$message.error(data.msg) } })
    }
  }
}
</script>

<style scoped>
.filter-card { margin-bottom: 16px; }
.pager { margin-top: 16px; text-align: right; }
</style>


