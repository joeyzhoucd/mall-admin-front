<template>
  <div class="ware-info-management">
    <!-- 筛选条件 -->
    <el-card class="filter-card">
      <el-form :inline="true" :model="dataForm" @keyup.enter.native="getDataList()">
        <el-form-item label="检索">
          <el-input
            v-model="dataForm.key"
            placeholder="仓库名/地址/ID"
            clearable
            style="width: 220px"
          />
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
        <el-table-column prop="id" header-align="center" align="center" label="id" width="80" />
        <el-table-column prop="name" header-align="center" align="center" label="仓库名" min-width="150" />
        <el-table-column prop="address" header-align="center" align="center" label="仓库地址" min-width="200" />
        <el-table-column prop="areacode" header-align="center" align="center" label="区域编码" width="120" />
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
        <el-form-item label="仓库名" prop="name">
          <el-input v-model="dataForm.name" placeholder="仓库名"></el-input>
        </el-form-item>
        <el-form-item label="仓库地址" prop="address">
          <el-input v-model="dataForm.address" placeholder="仓库地址"></el-input>
        </el-form-item>
        <el-form-item label="区域编码" prop="areacode">
          <el-input v-model="dataForm.areacode" placeholder="区域编码"></el-input>
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
  name: 'WareInfoManagement',
  data () {
    return {
      dataForm: {
        id: 0,
        name: '',
        address: '',
        areacode: ''
      },
      dataList: [],
      pageIndex: 1,
      pageSize: 10,
      totalPage: 0,
      dataListLoading: false,
      dataListSelections: [],
      addOrUpdateVisible: false,
      dataRule: {
        name: [
          { required: true, message: '仓库名不能为空', trigger: 'blur' }
        ],
        address: [
          { required: true, message: '仓库地址不能为空', trigger: 'blur' }
        ],
        areacode: [
          { required: true, message: '区域编码不能为空', trigger: 'blur' }
        ]
      }
    }
  },
  created () {
    this.getDataList()
  },
  methods: {
    // 获取数据列表
    getDataList () {
      this.dataListLoading = true
      http({
        url: http.adornUrl('/ware/wareinfo/list'),
        method: 'get',
        params: http.adornParams({
          page: this.pageIndex,
          limit: this.pageSize,
          key: this.dataForm.key
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
            url: http.adornUrl(`/ware/wareinfo/info/${this.dataForm.id}`),
            method: 'get',
            params: http.adornParams()
          }).then(({ data }) => {
            if (data && data.code === 0) {
              this.dataForm.name = data.wareInfo.name
              this.dataForm.address = data.wareInfo.address
              this.dataForm.areacode = data.wareInfo.areacode
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
          url: http.adornUrl('/ware/wareinfo/delete'),
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
      this.$confirm(`确定删除选中的 ${this.dataListSelections.length} 个仓库?`, '提示', { type: 'warning' }).then(() => {
        const ids = this.dataListSelections.map(item => item.id)
        http({ url: http.adornUrl('/ware/wareinfo/delete'), method: 'post', data: http.adornData(ids) })
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
            url: http.adornUrl(`/ware/wareinfo/${!this.dataForm.id ? 'save' : 'update'}`),
            method: 'post',
            data: http.adornData({
              'id': this.dataForm.id || undefined,
              'name': this.dataForm.name,
              'address': this.dataForm.address,
              'areacode': this.dataForm.areacode
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
        key: ''
      }
      this.getDataList()
    }
  }
}
</script>

<style scoped>
.ware-info-management { padding: 20px; }
.filter-card { margin-bottom: 20px; }
.batch-card { margin-bottom: 20px; }
.batch-actions { display: flex; align-items: center; gap: 12px; }
.table-card { margin-bottom: 20px; }
.el-pagination { margin-top: 20px; text-align: right; }
</style>
