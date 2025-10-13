<template>
  <div class="spu-spec">
    <el-card>
      <div slot="header" class="clearfix">
        <span>SPU规格管理</span>
        <el-button style="float: right; padding: 3px 0" type="text" @click="goBack">返回</el-button>
      </div>
      <!-- SPU基本信息 -->
      <el-form :model="spuInfo" label-width="120px" style="margin-bottom: 20px;">
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="商品名称">
              <el-input v-model="spuInfo.spuName" disabled />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="商品描述">
              <el-input v-model="spuInfo.spuDescription" disabled />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="上架状态">
              <el-tag v-if="spuInfo.publishStatus === 0" type="info">新建</el-tag>
              <el-tag v-else-if="spuInfo.publishStatus === 1" type="success">上架</el-tag>
              <el-tag v-else type="warning">下架</el-tag>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>

      <!-- SKU列表 -->
      <div class="sku-section">
        <div class="section-title">SKU信息</div>
        <el-table :data="skuList" border style="width: 100%">
          <el-table-column prop="skuId" label="SKU ID" width="100" />
          <el-table-column prop="skuName" label="SKU名称" min-width="200" />
          <el-table-column prop="price" label="价格" width="120">
            <template slot-scope="scope">
              <el-input-number v-model="scope.row.price" :min="0" :precision="2" size="small" />
            </template>
          </el-table-column>
          <el-table-column prop="stock" label="库存" width="120">
            <template slot-scope="scope">
              <el-input-number v-model="scope.row.stock" :min="0" size="small" />
            </template>
          </el-table-column>
          <el-table-column prop="skuCode" label="条形码" width="150">
            <template slot-scope="scope">
              <el-input v-model="scope.row.skuCode" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="销售属性" min-width="200">
            <template slot-scope="scope">
              <el-tag v-for="attr in scope.row.attr" :key="attr.attrId" size="small" style="margin-right: 5px;">
                {{ attr.attrName }}: {{ attr.attrValue }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="120">
            <template slot-scope="scope">
              <el-button type="text" size="small" @click="editSku(scope.row)">编辑</el-button>
              <el-button type="text" size="small" @click="deleteSku(scope.row.skuId)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 操作按钮 -->
      <div class="actions">
        <el-button type="primary" @click="saveAll">保存所有</el-button>
        <el-button @click="goBack">取消</el-button>
      </div>
    </el-card>
  </div>
</template>

<script>
import http from '@/utils/httpRequest'

export default {
  name: 'SpuSpec',
  data () {
    return {
      spuId: null,
      spuInfo: {},
      skuList: []
    }
  },
  created () {
    this.spuId = this.$route.params.id
    if (this.spuId) {
      this.getSpuInfo()
      this.getSkuList()
    }
  },
  methods: {
    // 获取SPU信息
    getSpuInfo () {
      http({
        url: http.adornUrl(`/product/spuinfo/info/${this.spuId}`),
        method: 'get'
      }).then(({ data }) => {
        if (data && data.code === 0) {
          this.spuInfo = data.spuInfo
        }
      })
    },
    // 获取SKU列表
    getSkuList () {
      http({
        url: http.adornUrl('/product/skuinfo/list'),
        method: 'get',
        params: http.adornParams({
          spuId: this.spuId
        })
      }).then(({ data }) => {
        if (data && data.code === 0) {
          this.skuList = data.page.list || []
        }
      })
    },
    // 编辑SKU
    editSku (sku) {
      // 这里可以打开编辑对话框或跳转到编辑页面
      this.$message.info('编辑SKU功能待实现')
    },
    // 删除SKU
    deleteSku (skuId) {
      this.$confirm('确定删除该SKU?', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(() => {
        http({
          url: http.adornUrl('/product/skuinfo/delete'),
          method: 'post',
          data: http.adornData([skuId])
        }).then(({ data }) => {
          if (data && data.code === 0) {
            this.$message.success('删除成功')
            this.getSkuList()
          } else {
            this.$message.error(data.msg)
          }
        })
      })
    },
    // 保存所有
    saveAll () {
      // 批量保存SKU信息
      const updateData = this.skuList.map(sku => ({
        skuId: sku.skuId,
        price: sku.price,
        stock: sku.stock,
        skuCode: sku.skuCode
      }))

      http({
        url: http.adornUrl('/product/skuinfo/update'),
        method: 'post',
        data: http.adornData(updateData)
      }).then(({ data }) => {
        if (data && data.code === 0) {
          this.$message.success('保存成功')
        } else {
          this.$message.error(data.msg)
        }
      })
    },
    // 返回
    goBack () {
      this.$router.go(-1)
    }
  }
}
</script>

<style scoped>
.spu-spec {
  padding: 20px;
}

.sku-section {
  margin-top: 20px;
}

.section-title {
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 15px;
  color: #303133;
}

.actions {
  margin-top: 20px;
  text-align: center;
}
</style>
