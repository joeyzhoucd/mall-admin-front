<template>
  <div class="purchase-detail-page">
    <el-card class="filter-card">
      <el-form :inline="true" :model="query" @keyup.enter.native="getDataList()">
        <el-form-item label="仓库">
          <el-select v-model="query.wareId" clearable placeholder="请选择仓库" style="width:160px" filterable>
            <el-option v-for="w in wareOptions" :key="w.id" :label="w.name" :value="w.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="query.status" clearable placeholder="请选择状态" style="width:140px">
            <el-option v-for="s in statusOptions" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键字">
          <el-input v-model="query.key" clearable placeholder="参数名" style="width:180px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="getDataList">查询</el-button>
          <el-button @click="resetQuery">重置</el-button>
          <el-dropdown split-button type="primary" @command="onBatchCommand" :disabled="selections.length===0">
            批量操作
            <el-dropdown-menu slot="dropdown">
              <el-dropdown-item command="merge">合并到采购单</el-dropdown-item>
              <el-dropdown-item command="delete">批量删除</el-dropdown-item>
            </el-dropdown-menu>
          </el-dropdown>
          <el-button type="success" @click="addOrUpdate()">新增</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card>
      <el-table :data="dataList" border v-loading="loading" @selection-change="val=>selections=val" style="width: 100%">
        <el-table-column type="selection" width="50" />
        <el-table-column prop="id" label="id" width="80" align="center" />
        <el-table-column prop="purchaseId" label="采购单id" width="120" align="center" />
        <el-table-column prop="skuId" label="采购商品id" min-width="200" align="center" />
        <el-table-column prop="skuNum" label="采购数量" width="90" align="center" />
        <el-table-column prop="skuPrice" label="采购金额" width="120" align="center" />
        <el-table-column prop="wareId" label="仓库id" width="200" align="center" />
        <el-table-column prop="status" label="状态" width="80" align="center">
          <template slot-scope="scope">{{ statusText(scope.row.status) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120" align="center">
          <template slot-scope="scope">
            <el-button type="text" size="small" @click="addOrUpdate(scope.row)">编辑</el-button>
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

    <!-- 新增/编辑 -->
    <el-dialog :title="form.id ? '编辑采购项' : '新增采购项'" :visible.sync="dlg.edit" width="520px">
      <el-form ref="form" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="SKU ID" prop="skuId"><el-input v-model="form.skuId" /></el-form-item>
        <el-form-item label="数量" prop="skuNum"><el-input-number v-model="form.skuNum" :min="1" /></el-form-item>
        <el-form-item label="金额" prop="skuPrice"><el-input v-model="form.skuPrice" /></el-form-item>
        <el-form-item label="仓库ID" prop="wareId">
          <el-select v-model="form.wareId" placeholder="请选择仓库" style="width:100%" filterable>
            <el-option v-for="w in wareOptions" :key="w.id" :label="w.name + '（' + w.id + '）'" :value="w.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-select v-model="form.status" style="width:100%">
            <el-option v-for="s in statusOptions" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
        </el-form-item>
      </el-form>
      <span slot="footer">
        <el-button @click="dlg.edit=false">取消</el-button>
        <el-button type="primary" @click="submit()">确定</el-button>
      </span>
    </el-dialog>

    <!-- 合并到采购单 -->
    <el-dialog title="合并到采购单" :visible.sync="dlg.merge" width="500px">
      <el-form label-width="120px">
        <el-form-item label="选择采购单">
          <el-select v-model="mergeTargetId" placeholder="请选择采购单（不选则新建）" style="width: 100%" clearable>
            <el-option
              v-for="item in purchaseOptions"
              :key="item.id"
              :label="`采购单${item.id} (${item.assigneeName || '未分配'})`"
              :value="item.id">
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-alert
            title="提示：选择采购单将合并到现有采购单，不选择将创建新的采购单"
            type="info"
            :closable="false"
            show-icon>
          </el-alert>
        </el-form-item>
      </el-form>
      <span slot="footer">
        <el-button @click="dlg.merge=false">取消</el-button>
        <el-button type="primary" @click="doMerge">合并</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
import http from '@/utils/httpRequest'

export default {
  name: 'PurchaseDetail',
  data () {
    return {
      query: { purchaseId: '', status: null, wareId: null, key: '' },
      pageIndex: 1,
      pageSize: 10,
      total: 0,
      dataList: [],
      loading: false,
      selections: [],
      dlg: { edit: false, merge: false },
      form: { id: 0, purchaseId: '', skuId: '', skuNum: 1, skuPrice: '', wareId: '', status: 0 },
      rules: {
        skuId: [{ required: true, message: '请输入SKU ID', trigger: 'blur' }],
        skuNum: [{ required: true, message: '请输入数量', trigger: 'blur' }],
        wareId: [{ required: true, message: '请输入仓库ID', trigger: 'blur' }]
      },
      statusOptions: [
        { label: '新建', value: 0 },
        { label: '已分配', value: 1 },
        { label: '采购中', value: 2 },
        { label: '已完成', value: 3 },
        { label: '采购失败', value: 4 }
      ],
      mergeTargetId: '',
      wareOptions: [],
      purchaseOptions: []
    }
  },
  created () { this.getDataList(); this.loadWares(); this.loadPurchases() },
  methods: {
    loadWares () {
      // 从仓库维护接口获取下拉
      http({ url: http.adornUrl('/ware/wareinfo/list'), method: 'get', params: http.adornParams({ page: 1, limit: 1000 }) })
        .then(({ data }) => {
          if (data && data.code === 0) this.wareOptions = (data.page && data.page.list) || []
        })
    },
    loadPurchases () {
      // 从采购单接口获取可合并的采购单列表（新建和已分配的采购单）
      http({ url: http.adornUrl('/ware/purchase/list'), method: 'get', params: http.adornParams({ page: 1, limit: 1000 }) })
        .then(({ data }) => {
          if (data && data.code === 0) {
            // 过滤出新建(0)和已分配(1)状态的采购单
            const allPurchases = (data.page && data.page.list) || []
            this.purchaseOptions = allPurchases.filter(item => item.status === 0 || item.status === 1)
          }
        })
    },
    statusText (v) { const m = this.statusOptions.find(i => i.value === v); return m ? m.label : v },
    getDataList () {
      this.loading = true
      http({
        url: http.adornUrl('/ware/purchasedetail/list'),
        method: 'get',
        params: http.adornParams({
          page: this.pageIndex,
          limit: this.pageSize,
          purchaseId: this.query.purchaseId,
          status: this.query.status,
          wareId: this.query.wareId ? String(this.query.wareId) : '',
          key: this.query.key
        })
      }).then(({ data }) => {
        if (data && data.code === 0) { this.dataList = data.page.list || []; this.total = data.page.totalCount || 0 } else { this.dataList = []; this.total = 0 }
      }).finally(() => { this.loading = false })
    },
    resetQuery () { this.query = { purchaseId: '', status: null, wareId: null, key: '' }; this.pageIndex = 1; this.getDataList() },
    addOrUpdate (row) {
      this.dlg.edit = true
      this.$nextTick(() => {
        this.$refs.form && this.$refs.form.resetFields()
        if (row) Object.assign(this.form, row)
        else this.form = { id: 0, purchaseId: '', skuId: '', skuNum: 1, skuPrice: '', wareId: '', status: 0 }
      })
    },
    submit () {
      this.$refs.form.validate(valid => {
        if (!valid) return
        const url = this.form.id ? '/ware/purchasedetail/update' : '/ware/purchasedetail/save'
        http({ url: http.adornUrl(url), method: 'post', data: http.adornData(this.form) })
          .then(({ data }) => { if (data && data.code === 0) { this.$message.success('操作成功'); this.dlg.edit = false; this.getDataList() } else { this.$message.error(data.msg) } })
      })
    },
    delOne (id) { this.$confirm('确认删除该记录？', '提示', { type: 'warning' }).then(() => this._delete([id])) },
    batchDelete () { if (this.selections.length) this._delete(this.selections.map(i => i.id)) },
    _delete (ids) {
      http({ url: http.adornUrl('/ware/purchasedetail/delete'), method: 'post', data: ids })
        .then(({ data }) => { if (data && data.code === 0) { this.$message.success('删除成功'); this.getDataList() } else { this.$message.error(data.msg) } })
    },
    openMerge () {
      this.mergeTargetId = ''
      this.dlg.merge = true
      // 重新加载采购单列表，确保数据最新
      this.loadPurchases()
    },
    doMerge () {
      const body = { detailIds: this.selections.map(i => i.id) }
      if (String(this.mergeTargetId).trim()) body.purchaseId = this.mergeTargetId
      http({ url: http.adornUrl('/ware/purchase/merge'), method: 'post', data: http.adornData(body, false) })
        .then(({ data }) => { if (data && data.code === 0) { this.$message.success('合并成功'); this.dlg.merge = false; this.getDataList() } else { this.$message.error(data.msg) } })
    },
    onBatchCommand (command) {
      if (command === 'merge') {
        this.openMerge()
      } else if (command === 'delete') {
        this.batchDelete()
      }
    }
  }
}
</script>

<style scoped>
.filter-card { margin-bottom: 16px; }
.pager { margin-top: 16px; text-align: right; }
</style>
