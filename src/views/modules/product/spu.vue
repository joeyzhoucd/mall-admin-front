<template>
  <div class="spu-management">
    <!-- 筛选条件 -->
    <el-card class="filter-card">
      <el-form :inline="true" :model="dataForm" @keyup.enter.native="getDataList()">
        <el-form-item label="分类">
          <el-cascader
            v-model="categoryPath"
            :options="categoryOptions"
            :props="{ checkStrictly: true, emitPath: true, expandTrigger: 'hover' }"
            filterable
            clearable
            placeholder="请选择分类"
            style="width: 200px"
            :show-all-levels="false"
            @change="handleCategoryChange"
          />
        </el-form-item>
        <el-form-item label="品牌">
          <el-select v-model="dataForm.brandId" clearable placeholder="请选择品牌" style="width: 150px">
            <el-option
              v-for="brand in brandOptions"
              :key="brand.brandId"
              :label="brand.name"
              :value="brand.brandId"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="dataForm.status" clearable placeholder="请选择状态" style="width: 120px">
            <el-option label="新建" :value="0" />
            <el-option label="上架" :value="1" />
            <el-option label="下架" :value="2" />
          </el-select>
        </el-form-item>
        <el-form-item label="检索">
          <el-input
            v-model="dataForm.key"
            placeholder="商品名称"
            clearable
            style="width: 200px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="getDataList()">查询</el-button>
          <el-button @click="resetDataForm()">重置</el-button>
        </el-form-item>
      </el-form>
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
        <el-table-column prop="spuName" header-align="center" align="center" label="名称" min-width="200" />
        <el-table-column prop="spuDescription" header-align="center" align="center" label="描述" min-width="200" show-overflow-tooltip />
        <el-table-column prop="catalogId" header-align="center" align="center" label="分类" width="100" />
        <el-table-column prop="brandId" header-align="center" align="center" label="品牌" width="100" />
        <el-table-column prop="weight" header-align="center" align="center" label="重量" width="100" />
        <el-table-column prop="publishStatus" header-align="center" align="center" label="上架状态" width="120">
          <template slot-scope="scope">
            <el-tag v-if="scope.row.publishStatus === 0" type="info">新建</el-tag>
            <el-tag v-else-if="scope.row.publishStatus === 1" type="success">上架</el-tag>
            <el-tag v-else type="warning">下架</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" header-align="center" align="center" label="创建时间" width="180" />
        <el-table-column prop="updateTime" header-align="center" align="center" label="修改时间" width="180" />
        <el-table-column fixed="right" header-align="center" align="center" width="150" label="操作">
          <template slot-scope="scope">
            <el-button v-if="scope.row.publishStatus === 0" type="text" size="small" @click="publishHandle(scope.row.id)">上架</el-button>
            <el-button v-else-if="scope.row.publishStatus === 1" type="text" size="small" @click="unpublishHandle(scope.row.id)">下架</el-button>
            <el-button type="text" size="small" @click="specHandle(scope.row.id)">规格</el-button>
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
  </div>
</template>

<script>
import http from '@/utils/httpRequest'

export default {
  name: 'SpuManagement',
  data () {
    return {
      dataForm: {
        categoryId: null,
        brandId: null,
        status: null,
        key: ''
      },
      categoryPath: [],
      dataList: [],
      pageIndex: 1,
      pageSize: 10,
      totalPage: 0,
      dataListLoading: false,
      dataListSelections: [],
      categoryOptions: [],
      brandOptions: []
    }
  },
  created () {
    this.getDataList()
    this.getCategoryList()
    this.getBrandList()
  },
  methods: {
    // 获取数据列表
    getDataList () {
      this.dataListLoading = true
      http({
        url: http.adornUrl('/product/spuinfo/list'),
        method: 'get',
        params: http.adornParams({
          page: this.pageIndex,
          limit: this.pageSize,
          categoryId: this.dataForm.categoryId,
          brandId: this.dataForm.brandId,
          status: this.dataForm.status,
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
    // 获取分类列表
    getCategoryList () {
      http({
        url: http.adornUrl('/product/category/list/tree'),
        method: 'get'
      }).then(({ data }) => {
        if (data && data.code === 0) {
          this.categoryOptions = this.buildCategoryOptions(data.data || [])
        }
      })
    },
    // 构建分类选项
    buildCategoryOptions (categories) {
      return (categories || []).map(cat => {
        const node = { value: cat.catId, label: cat.name }
        const hasChildren = Array.isArray(cat.children) && cat.children.length > 0
        if (hasChildren) node.children = this.buildCategoryOptions(cat.children)
        return node
      })
    },
    // 获取品牌列表
    getBrandList () {
      http({
        url: http.adornUrl('/product/brand/list'),
        method: 'get',
        params: http.adornParams({
          page: 1,
          limit: 1000
        })
      }).then(({ data }) => {
        if (data && data.code === 0) {
          this.brandOptions = data.data.list || []
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
    // 分类选择变化
    handleCategoryChange (path) {
      if (Array.isArray(path) && path.length > 0) {
        this.dataForm.categoryId = path[path.length - 1] // 取最后一级分类ID
      } else {
        this.dataForm.categoryId = null
      }
    },
    // 重置
    resetDataForm () {
      this.dataForm = {
        categoryId: null,
        brandId: null,
        status: null,
        key: ''
      }
      this.categoryPath = []
      this.getDataList()
    },
    // 上架
    publishHandle (id) {
      this.$confirm(`确定对上架id为${id}的商品进行上架操作?`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(() => {
        http({
          url: http.adornUrl(`/product/spuinfo/${id}/up`),
          method: 'post'
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
      })
    },
    // 下架
    unpublishHandle (id) {
      this.$confirm(`确定对下架id为${id}的商品进行下架操作?`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(() => {
        http({
          url: http.adornUrl('/product/spuinfo/unpublish'),
          method: 'post',
          data: http.adornData([id])
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
      })
    },
    // 规格
    specHandle (id) {
      this.$router.push({ name: 'spu-spec', params: { id } })
    },
    // 删除
    deleteHandle (id) {
      this.$confirm(`确定对[id=${id}]进行删除操作?`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(() => {
        http({
          url: http.adornUrl('/product/spuinfo/delete'),
          method: 'post',
          data: http.adornData([id])
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
      })
    }
  }
}
</script>

<style scoped>
.spu-management {
  padding: 20px;
}

.filter-card {
  margin-bottom: 20px;
}

.table-card {
  margin-bottom: 20px;
}

.el-pagination {
  margin-top: 20px;
  text-align: right;
}
</style>
