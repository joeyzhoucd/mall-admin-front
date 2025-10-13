<template>
  <div class="ware-sku-management">
    <!-- 筛选条件 -->
    <el-card class="filter-card">
      <el-form :inline="true" :model="dataForm" @keyup.enter.native="getDataList()">
        <el-form-item label="仓库">
          <el-select v-model="dataForm.wareId" clearable placeholder="请选择仓库" style="width: 200px">
            <el-option
              v-for="ware in wareOptions"
              :key="ware.id"
              :label="ware.name"
              :value="ware.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="检索">
          <el-input
            v-model="dataForm.key"
            placeholder="SKU名称/ID"
            clearable
            style="width: 220px"
          />
        </el-form-item>
        <el-form-item label="库存状态">
          <el-select v-model="dataForm.stockStatus" clearable placeholder="请选择库存状态" style="width: 150px">
            <el-option label="有库存" value="inStock" />
            <el-option label="无库存" value="outOfStock" />
            <el-option label="低库存" value="lowStock" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="getDataList()">查询</el-button>
          <el-button @click="resetDataForm()">重置</el-button>
          <el-button type="success" @click="addOrUpdateHandle()">新增</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 批量操作 -->
    <el-card class="batch-card" v-if="dataListSelections.length > 0">
      <div class="batch-actions">
        <span>已选择 {{ dataListSelections.length }} 项</span>
        <el-button type="danger" size="small" @click="batchDelete">批量删除</el-button>
      </div>
    </el-card>

    <!-- 数据表格 -->
    <el-card class="table-card">
      <el-table
        v-loading="dataListLoading"
        :data="dataList"
        border
        style="width: 100%"
        @selection-change="selectionChangeHandle"
      >
        <el-table-column type="selection" header-align="center" align="center" width="50" />
        <el-table-column prop="id" header-align="center" align="center" label="ID" width="80" />
        <el-table-column prop="skuId" header-align="center" align="center" label="SKU ID" width="120" />
        <el-table-column prop="wareId" header-align="center" align="center" label="仓库ID" width="100" />
        <el-table-column prop="stock" header-align="center" align="center" label="库存数量" width="100">
          <template slot-scope="scope">
            <el-tag :type="scope.row.stock > 0 ? 'success' : 'danger'">
              {{ scope.row.stock }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="skuName" header-align="center" align="center" label="商品名称" min-width="200" show-overflow-tooltip />
        <el-table-column prop="stockLocked" header-align="center" align="center" label="锁定库存" width="100">
          <template slot-scope="scope">
            <el-tag :type="scope.row.stockLocked > 0 ? 'warning' : 'info'">
              {{ scope.row.stockLocked }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column fixed="right" header-align="center" align="center" width="150" label="操作">
          <template slot-scope="scope">
            <el-button type="text" size="small" @click="addOrUpdateHandle(scope.row.id)">修改</el-button>
            <el-button type="text" size="small" @click="deleteHandle(scope.row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <el-pagination
        @size-change="sizeChangeHandle"
        @current-change="currentChangeHandle"
        :current-page="pageIndex"
        :page-sizes="[10, 20, 50, 100]"
        :page-size="pageSize"
        :total="totalPage"
        layout="total, sizes, prev, pager, next, jumper"
      />
    </el-card>

    <!-- 弹窗, 新增 / 修改 -->
    <el-dialog :title="!dataForm.id ? '新增' : '修改'" :visible.sync="addOrUpdateVisible" :close-on-click-modal="false">
      <el-form :model="dataForm" :rules="dataRule" ref="dataForm" @keyup.enter.native="dataFormSubmit()" label-width="100px">
        <el-form-item label="商品SKU" prop="skuId">
          <el-input v-model="dataForm.skuId" placeholder="请输入商品SKU ID" type="number"></el-input>
        </el-form-item>
        <el-form-item label="所属仓库" prop="wareId">
          <el-select v-model="dataForm.wareId" placeholder="请选择仓库" style="width: 100%" filterable>
            <el-option
              v-for="ware in wareOptions"
              :key="ware.id"
              :label="ware.name"
              :value="ware.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="库存数量" prop="stock">
          <el-input-number v-model="dataForm.stock" :min="0" :step="1" style="width: 100%" placeholder="请输入库存数量"></el-input-number>
        </el-form-item>
        <el-form-item label="商品名称" prop="skuName">
          <el-input v-model="dataForm.skuName" placeholder="请输入商品名称"></el-input>
        </el-form-item>
        <el-form-item label="锁定库存" prop="stockLocked">
          <el-input-number v-model="dataForm.stockLocked" :min="0" :step="1" style="width: 100%" placeholder="请输入锁定库存数量"></el-input-number>
        </el-form-item>
      </el-form>
      <span slot="footer" class="dialog-footer">
        <el-button @click="addOrUpdateVisible = false">取消</el-button>
        <el-button type="primary" @click="dataFormSubmit()">确定</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
import http from '@/utils/httpRequest'

export default {
  name: 'WareSkuManagement',
  data () {
    return {
      dataForm: {
        id: 0,
        skuId: null,
        wareId: null,
        stock: 0,
        skuName: '',
        stockLocked: 0,
        key: '',
        stockStatus: null
      },
      dataList: [],
      pageIndex: 1,
      pageSize: 10,
      totalPage: 0,
      dataListLoading: false,
      dataListSelections: [],
      addOrUpdateVisible: false,
      wareOptions: [],
      dataRule: {
        skuId: [
          { required: true, message: '商品SKU不能为空', trigger: 'blur' },
          { pattern: /^\d+$/, message: '商品SKU必须为数字', trigger: 'blur' }
        ],
        wareId: [
          { required: true, message: '所属仓库不能为空', trigger: 'change' }
        ],
        stock: [
          { required: true, message: '库存数量不能为空', trigger: 'blur' }
        ],
        skuName: [
          { required: true, message: '商品名称不能为空', trigger: 'blur' },
          { min: 1, max: 200, message: '商品名称长度在 1 到 200 个字符', trigger: 'blur' }
        ],
        stockLocked: []
      }
    }
  },
  created () {
    this.getDataList()
    this.getWareList()
  },
  methods: {
    // 获取数据列表
    getDataList () {
      this.dataListLoading = true
      http({
        url: http.adornUrl('/ware/waresku/list'),
        method: 'get',
        params: http.adornParams({
          page: this.pageIndex,
          limit: this.pageSize,
          wareId: this.dataForm.wareId,
          key: this.dataForm.key,
          stockStatus: this.dataForm.stockStatus
        })
      }).then(({ data }) => {
        if (data && data.code === 0) {
          this.dataList = data.page.list
          this.totalPage = data.page.totalCount
        } else {
          this.dataList = []
          this.totalPage = 0
        }
        this.dataListLoading = false
      }).catch(() => {
        this.dataList = []
        this.totalPage = 0
        this.dataListLoading = false
      })
    },
    // 获取仓库列表
    getWareList () {
      http({
        url: http.adornUrl('/ware/wareinfo/list'),
        method: 'get',
        params: http.adornParams({ page: 1, limit: 1000 })
      }).then(({ data }) => {
        if (data && data.code === 0) {
          this.wareOptions = data.page.list || []
        }
      })
    },
    // 每页数
    sizeChangeHandle (val) {
      this.pageSize = val
      this.pageIndex = 1
      this.getDataList()
    },
    // 当前页
    currentChangeHandle (val) {
      this.pageIndex = val
      this.getDataList()
    },
    // 多选
    selectionChangeHandle (val) {
      this.dataListSelections = val
    },
    // 新增 / 修改
    addOrUpdateHandle (id) {
      this.addOrUpdateVisible = true
      this.dataForm.id = id || 0
      this.$nextTick(() => {
        this.$refs['dataForm'].resetFields()
        if (this.dataForm.id) {
          http({
            url: http.adornUrl(`/ware/waresku/info/${this.dataForm.id}`),
            method: 'get',
            params: http.adornParams()
          }).then(({ data }) => {
            if (data && data.code === 0) {
              this.dataForm.skuId = data.wareSku.skuId
              this.dataForm.wareId = data.wareSku.wareId
              this.dataForm.stock = data.wareSku.stock
              this.dataForm.skuName = data.wareSku.skuName
              this.dataForm.stockLocked = data.wareSku.stockLocked
            }
          })
        }
      })
    },
    // 删除
    deleteHandle (id) {
      this.$confirm(`确定对[id为${id}]进行[删除]操作?`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(() => {
        http({
          url: http.adornUrl('/ware/waresku/delete'),
          method: 'post',
          data: http.adornData([id], false)
        }).then(({ data }) => {
          if (data && data.code === 0) {
            this.$message({
              message: '操作成功',
              type: 'success',
              duration: 1500,
              onClose: () => {
                this.getDataList()
              }
            })
          } else {
            this.$message.error(data.msg)
          }
        })
      }).catch(() => {})
    },
    // 批量删除
    batchDelete () {
      if (this.dataListSelections.length === 0) return
      this.$confirm(`确定删除选中的 ${this.dataListSelections.length} 个库存记录?`, '提示', { type: 'warning' }).then(() => {
        const ids = this.dataListSelections.map(item => item.id)
        http({ url: http.adornUrl('/ware/waresku/delete'), method: 'post', data: http.adornData(ids) })
          .then(({ data }) => {
            if (data && data.code === 0) { this.$message.success('批量删除成功'); this.getDataList() } else { this.$message.error(data.msg) }
          })
      })
    },
    // 表单提交
    dataFormSubmit () {
      this.$refs['dataForm'].validate((valid) => {
        if (valid) {
          http({
            url: http.adornUrl(`/ware/waresku/${!this.dataForm.id ? 'save' : 'update'}`),
            method: 'post',
            data: http.adornData({
              'id': this.dataForm.id || undefined,
              'skuId': this.dataForm.skuId,
              'wareId': this.dataForm.wareId,
              'stock': this.dataForm.stock,
              'skuName': this.dataForm.skuName,
              'stockLocked': this.dataForm.stockLocked
            })
          }).then(({ data }) => {
            if (data && data.code === 0) {
              this.$message({
                message: '操作成功',
                type: 'success',
                duration: 1500,
                onClose: () => {
                  this.addOrUpdateVisible = false
                  this.getDataList()
                }
              })
            } else {
              this.$message.error(data.msg)
            }
          })
        }
      })
    },
    // 重置
    resetDataForm () {
      this.dataForm = {
        wareId: null,
        key: '',
        stockStatus: null
      }
      this.getDataList()
    }
  }
}
</script>

<style scoped>
.ware-sku-management { padding: 20px; }
.filter-card { margin-bottom: 20px; }
.batch-card { margin-bottom: 20px; }
.batch-actions { display: flex; align-items: center; gap: 12px; }
.table-card { margin-bottom: 20px; }
.el-pagination { margin-top: 20px; text-align: right; }
</style>
