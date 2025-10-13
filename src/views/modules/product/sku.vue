<template>
  <div class="sku-management">
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
        <el-form-item label="检索">
          <el-input
            v-model="dataForm.key"
            placeholder="SKU名称/ID"
            clearable
            style="width: 220px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="getDataList()">查询</el-button>
          <el-button @click="resetDataForm()">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 批量操作 -->
    <el-card class="batch-card" v-if="dataListSelections.length > 0">
      <div class="batch-actions">
        <span>已选择 {{ dataListSelections.length }} 项</span>
        <el-button type="danger" size="small" @click="batchDelete">批量删除</el-button>
        <el-button type="success" size="small" @click="batchPublish(1)">批量上架</el-button>
        <el-button type="warning" size="small" @click="batchPublish(0)">批量下架</el-button>
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
        <el-table-column prop="skuId" header-align="center" align="center" label="skuid" width="100" />
        <el-table-column prop="skuName" header-align="center" align="left" label="名称" min-width="260" show-overflow-tooltip />
        <el-table-column header-align="center" align="center" label="默认图片" width="120">
          <template slot-scope="scope">
            <img v-if="scope.row.defaultImg" :src="scope.row.defaultImg" style="width:56px;height:56px;object-fit:cover;border-radius:4px" />
          </template>
        </el-table-column>
        <el-table-column prop="categoryName" header-align="center" align="center" label="分类" width="120" />
        <el-table-column prop="brandName" header-align="center" align="center" label="品牌" width="120" />
        <el-table-column prop="price" header-align="center" align="center" label="价格" width="120" />
        <el-table-column prop="saleCount" header-align="center" align="center" label="销量" width="100" />
        <el-table-column header-align="center" align="center" label="状态" width="100">
          <template slot-scope="scope">
            <el-tag v-if="scope.row.publishStatus === 0" size="small" type="info">新建</el-tag>
            <el-tag v-else-if="scope.row.publishStatus === 1" size="small" type="success">上架</el-tag>
            <el-tag v-else-if="scope.row.publishStatus === 2" size="small" type="danger">下架</el-tag>
          </template>
        </el-table-column>
        <el-table-column fixed="right" header-align="center" align="center" width="260" label="操作">
          <template slot-scope="scope">
            <el-button type="text" size="small" @click="previewHandle(scope.row.skuId)">预览</el-button>
            <el-button type="text" size="small" @click="commentHandle(scope.row.skuId)">评论</el-button>
            <el-button type="text" size="small" @click="editHandle(scope.row)">编辑</el-button>
            <el-dropdown
              @command="handleCommand(scope.row,$event)"
              size="small"
              split-button
              type="text"
            >
              更多
              <el-dropdown-menu slot="dropdown">
                <el-dropdown-item command="uploadImages">上传图片</el-dropdown-item>
                <el-dropdown-item command="seckillSettings">参与秒杀</el-dropdown-item>
                <el-dropdown-item command="reductionSettings">满减设置</el-dropdown-item>
                <el-dropdown-item command="discountSettings">折扣设置</el-dropdown-item>
                <el-dropdown-item command="memberPriceSettings">会员价格</el-dropdown-item>
                <el-dropdown-item command="stockSettings">库存管理</el-dropdown-item>
                <el-dropdown-item command="couponSettings">优惠劵</el-dropdown-item>
              </el-dropdown-menu>
            </el-dropdown>
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
import MultiUpload from '@/components/upload/multiUpload.vue'

export default {
  name: 'SkuManagement',
  components: { MultiUpload },
  data () {
    return {
      dataForm: {
        categoryId: null,
        brandId: null,
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
      brandOptions: [],
      // dialogs
      dlg: {
        uploadImages: false,
        memberPrice: false,
        discount: false,
        reduction: false,
        seckill: false,
        stock: false,
        coupon: false,
        edit: false
      },
      // context row
      currentRow: null,
      // upload images
      uploadImagesModel: {
        list: []
      },
      // member price
      memberLevels: [],
      memberPriceModel: [],
      // discount (ladder)
      discountModel: { fullCount: 0, discount: 0, countStatus: 0 },
      // reduction (full reduction)
      reductionModel: { fullPrice: 0, reducePrice: 0, priceStatus: 0 },
      // seckill
      seckillModel: { startTime: '', endTime: '', seckillPrice: 0, seckillCount: 0, seckillLimit: 1 },
      // stock
      stockModel: { stock: 0, stockLocked: 0 },
      // coupon ids
      couponModel: { couponIds: [] },
      couponOptions: [],
      // edit
      editModel: { skuName: '', skuTitle: '', skuSubtitle: '', price: 0 }
    }
  },
  created () {
    this.getDataList()
    this.getCategoryList()
    this.getBrandList()
    this.fetchMemberLevels()
  },
  methods: {
    // 获取数据列表
    getDataList () {
      this.dataListLoading = true
      http({
        url: http.adornUrl('/product/skuinfo/list'),
        method: 'get',
        params: http.adornParams({
          page: this.pageIndex,
          limit: this.pageSize,
          categoryId: this.dataForm.categoryId,
          brandId: this.dataForm.brandId,
          key: this.dataForm.key
        })
      }).then(({ data }) => {
        if (data && data.code === 0) {
          const list = (data.page && data.page.list) || (data.data && data.data.list) || []
          // 补齐默认图字段（如果后端没直接返回）
          this.dataList = list.map(item => {
            const imgs = Array.isArray(item.images) ? item.images : []
            const def = imgs.find(i => String(i.defaultImg) === '1' || i.defaultImg === 1)
            const fallback = def && def.imgUrl ? def.imgUrl : ''
            return {
              ...item,
              defaultImg: item.defaultImg || item.skuDefaultImg || fallback
            }
          })
          this.totalPage = (data.page && data.page.totalCount) || (data.data && data.data.totalCount) || 0
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
      http({ url: http.adornUrl('/product/category/list/tree'), method: 'get' })
        .then(({ data }) => {
          if (data && data.code === 0) this.categoryOptions = this.buildCategoryOptions(data.data || [])
        })
    },
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
        params: http.adornParams({ page: 1, limit: 1000 })
      }).then(({ data }) => {
        if (data && data.code === 0) this.brandOptions = (data.data && data.data.list) || []
      })
    },
    // 交互与分页
    handleCategoryChange (path) {
      if (Array.isArray(path) && path.length > 0) this.dataForm.categoryId = path[path.length - 1]
      else this.dataForm.categoryId = null
    },
    sizeChangeHandle (val) {
      this.pageSize = val
      this.pageIndex = 1
      this.getDataList()
    },
    currentChangeHandle (val) {
      this.pageIndex = val
      this.getDataList()
    },
    selectionChangeHandle (val) { this.dataListSelections = val },
    resetDataForm () {
      this.dataForm = { categoryId: null, brandId: null, key: '' }
      this.categoryPath = []
      this.getDataList()
    },
    // 操作
    previewHandle (skuId) {
      // 跳转到商品详情页或新窗口预览
      const url = `/product/detail/${skuId}`
      window.open(url, '_blank')
    },
    commentHandle (skuId) {
      // 跳转到评论管理页面
      this.$router.push({ name: 'product-comment', query: { skuId } })
    },
    editHandle (row) {
      this.currentRow = row
      this.editModel = {
        skuName: row.skuName || '',
        skuTitle: row.skuTitle || '',
        skuSubtitle: row.skuSubtitle || '',
        price: row.price || 0
      }
      this.dlg.edit = true
    },
    deleteHandle (skuId) {
      this.$confirm(`确定删除SKU[${skuId}]?`, '提示', { type: 'warning' }).then(() => {
        http({ url: http.adornUrl('/product/skuinfo/delete'), method: 'post', data: http.adornData([skuId]) })
          .then(({ data }) => {
            if (data && data.code === 0) { this.$message.success('删除成功'); this.getDataList() } else { this.$message.error(data.msg) }
          })
      })
    },
    async fetchMemberLevels () {
      try {
        const { data } = await http({ url: http.adornUrl('/member/memberlevel/list'), method: 'get', params: http.adornParams({ page: 1, limit: 500 }) })
        const listA = data && data.page && data.page.list
        const listB = data && data.data && data.data.list
        this.memberLevels = listA || listB || []
      } catch (e) { /* ignore */ }
    },
    handleCommand (row, command) {
      switch (command) {
        case 'uploadImages':
          this.openUploadImages(row)
          break
        case 'seckillSettings':
          this.openSeckill(row)
          break
        case 'reductionSettings':
          this.openReduction(row)
          break
        case 'discountSettings':
          this.openDiscount(row)
          break
        case 'memberPriceSettings':
          this.openMemberPrice(row)
          break
        case 'stockSettings':
          this.openStock(row)
          break
        case 'couponSettings':
          this.openCoupon(row)
          break
        default:
          this.$message.info(`未知操作：${command}`)
      }
    },
    // ========== 秒杀 ==========
    openSeckill (row) {
      this.currentRow = row
      this.seckillModel = { startTime: '', endTime: '', seckillPrice: 0, seckillCount: 0, seckillLimit: 1 }
      this.dlg.seckill = true
    },
    async submitSeckill () {
      if (!this.currentRow) return
      const skuId = this.currentRow.skuId
      try {
        await http({
          url: http.adornUrl('/seckill/scheduler/save'),
          method: 'post',
          data: http.adornData({
            skuId: String(skuId),
            startTime: this.seckillModel.startTime,
            endTime: this.seckillModel.endTime,
            seckillPrice: String(this.seckillModel.seckillPrice || 0),
            seckillCount: String(this.seckillModel.seckillCount || 0),
            seckillLimit: String(this.seckillModel.seckillLimit || 1)
          })
        })
        this.$message.success('秒杀设置已保存')
        this.dlg.seckill = false
      } catch (e) {
        this.$message.error('秒杀设置保存失败')
      }
    },
    // ========== 库存 ==========
    openStock (row) {
      this.currentRow = row
      this.stockModel = { stock: 0, stockLocked: 0 }
      this.dlg.stock = true
    },
    async submitStock () {
      if (!this.currentRow) return
      const skuId = this.currentRow.skuId
      try {
        await http({
          url: http.adornUrl('/ware/waresku/updateStock'),
          method: 'post',
          data: http.adornData({ skuId: String(skuId), stock: String(this.stockModel.stock || 0) })
        })
        this.$message.success('库存已更新')
        this.dlg.stock = false
      } catch (e) {
        this.$message.error('库存更新失败')
      }
    },
    // ========== 优惠券 ==========
    async openCoupon (row) {
      this.currentRow = row
      this.couponModel = { couponIds: [] }
      try {
        const { data } = await http({ url: http.adornUrl('/coupon/coupon/list'), method: 'get', params: http.adornParams({ page: 1, limit: 1000 }) })
        const list = (data && data.page && data.page.list) || (data && data.data && data.data.list) || []
        this.couponOptions = list.map(i => ({ label: i.couponName || i.name || `优惠券${i.id}`, value: i.id }))
      } catch (e) { /* ignore */ }
      this.dlg.coupon = true
    },
    async submitCoupon () {
      if (!this.currentRow) return
      const skuId = this.currentRow.skuId
      try {
        await http({
          url: http.adornUrl('/coupon/couponspurelation/bind'),
          method: 'post',
          data: http.adornData({ skuId: String(skuId), couponIds: (this.couponModel.couponIds || []).map(String) })
        })
        this.$message.success('优惠券已绑定')
        this.dlg.coupon = false
      } catch (e) {
        this.$message.error('优惠券绑定失败')
      }
    },
    // ========== 编辑 ==========
    async submitEdit () {
      if (!this.currentRow) return
      const skuId = this.currentRow.skuId
      try {
        await http({
          url: http.adornUrl('/product/skuinfo/update'),
          method: 'post',
          data: http.adornData({
            skuId: String(skuId),
            skuName: this.editModel.skuName,
            skuTitle: this.editModel.skuTitle,
            skuSubtitle: this.editModel.skuSubtitle,
            price: String(this.editModel.price)
          })
        })
        this.$message.success('SKU信息已更新')
        this.dlg.edit = false
        this.getDataList()
      } catch (e) {
        this.$message.error('SKU信息更新失败')
      }
    },
    // ========== 批量操作 ==========
    batchDelete () {
      if (this.dataListSelections.length === 0) return
      this.$confirm(`确定删除选中的 ${this.dataListSelections.length} 个SKU?`, '提示', { type: 'warning' }).then(() => {
        const skuIds = this.dataListSelections.map(item => item.skuId)
        http({ url: http.adornUrl('/product/skuinfo/delete'), method: 'post', data: http.adornData(skuIds) })
          .then(({ data }) => {
            if (data && data.code === 0) { this.$message.success('批量删除成功'); this.getDataList() } else { this.$message.error(data.msg) }
          })
      })
    },
    batchPublish (status) {
      if (this.dataListSelections.length === 0) return
      const action = status === 1 ? '上架' : '下架'
      this.$confirm(`确定${action}选中的 ${this.dataListSelections.length} 个SKU?`, '提示', { type: 'warning' }).then(() => {
        const skuIds = this.dataListSelections.map(item => item.skuId)
        http({ url: http.adornUrl('/product/skuinfo/batchPublish'), method: 'post', data: http.adornData({ skuIds, publishStatus: status }) })
          .then(({ data }) => {
            if (data && data.code === 0) { this.$message.success(`批量${action}成功`); this.getDataList() } else { this.$message.error(data.msg) }
          })
      })
    },
    // ========== 上传图片 ==========
    async openUploadImages (row) {
      this.currentRow = row
      this.uploadImagesModel.list = []
      try {
        const { data } = await http({ url: http.adornUrl('/product/skuimages/list'), method: 'get', params: http.adornParams({ skuId: row.skuId, page: 1, limit: 500 }) })
        const list = (data && data.page && data.page.list) || (data && data.data && data.data.list) || []
        // 填充已有图片URL
        this.uploadImagesModel.list = list.map(i => i.imgUrl).filter(Boolean)
      } catch (e) { /* ignore */ }
      this.dlg.uploadImages = true
    },
    async submitUploadImages () {
      if (!this.currentRow) return
      const skuId = this.currentRow.skuId
      try {
        // 查询现有，计算差异：简单起见，先全部删除再全部新增
        const { data } = await http({ url: http.adornUrl('/product/skuimages/list'), method: 'get', params: http.adornParams({ skuId, page: 1, limit: 500 }) })
        const origin = ((data && data.page && data.page.list) || []).map(i => i.id)
        if (origin.length) {
          await http({ url: http.adornUrl('/product/skuimages/delete'), method: 'post', data: http.adornData(origin, false) })
        }
        const payloads = (this.uploadImagesModel.list || []).map((url, idx) => ({ skuId, imgUrl: url, imgSort: idx, defaultImg: idx === 0 ? 1 : 0 }))
        for (const p of payloads) {
          await http({ url: http.adornUrl('/product/skuimages/save'), method: 'post', data: http.adornData(p) })
        }
        this.$message.success('图片已更新')
        this.dlg.uploadImages = false
        this.getDataList()
      } catch (e) {
        this.$message.error('图片更新失败')
      }
    },
    // ========== 会员价格 ==========
    openMemberPrice (row) {
      this.currentRow = row
      // 初始化每个可设置会员价的等级
      this.memberPriceModel = (this.memberLevels || []).map(l => ({ id: l.id, name: l.name, price: 0 }))
      this.dlg.memberPrice = true
    },
    async submitMemberPrice () {
      if (!this.currentRow) return
      const skuId = this.currentRow.skuId
      try {
        const list = (this.memberPriceModel || []).filter(i => Number(i.price) > 0)
        for (const mp of list) {
          await http({
            url: http.adornUrl('/coupon/memberprice/save'),
            method: 'post',
            data: http.adornData({
              skuId: String(skuId),
              memberLevelId: String(mp.id),
              memberLevelName: mp.name,
              memberPrice: String(mp.price),
              addOther: '1'
            })
          })
        }
        this.$message.success('会员价格已保存')
        this.dlg.memberPrice = false
      } catch (e) {
        this.$message.error('会员价格保存失败')
      }
    },
    // ========== 折扣（阶梯） ==========
    openDiscount (row) {
      this.currentRow = row
      this.discountModel = { fullCount: 0, discount: 0, countStatus: 0 }
      this.dlg.discount = true
    },
    async submitDiscount () {
      if (!this.currentRow) return
      const skuId = this.currentRow.skuId
      try {
        await http({
          url: http.adornUrl('/coupon/skuladder/save'),
          method: 'post',
          data: http.adornData({
            skuId: String(skuId),
            fullCount: String(this.discountModel.fullCount || 0),
            discount: String(this.discountModel.discount || 0),
            addOther: String(this.discountModel.countStatus || 0)
          })
        })
        this.$message.success('折扣设置已保存')
        this.dlg.discount = false
      } catch (e) {
        this.$message.error('折扣设置保存失败')
      }
    },
    // ========== 满减 ==========
    openReduction (row) {
      this.currentRow = row
      this.reductionModel = { fullPrice: 0, reducePrice: 0, priceStatus: 0 }
      this.dlg.reduction = true
    },
    async submitReduction () {
      if (!this.currentRow) return
      const skuId = this.currentRow.skuId
      try {
        await http({
          url: http.adornUrl('/coupon/skufullreduction/save'),
          method: 'post',
          data: http.adornData({
            skuId: String(skuId),
            fullPrice: String(this.reductionModel.fullPrice || 0),
            reducePrice: String(this.reductionModel.reducePrice || 0),
            addOther: String(this.reductionModel.priceStatus || 0)
          })
        })
        this.$message.success('满减设置已保存')
        this.dlg.reduction = false
      } catch (e) {
        this.$message.error('满减设置保存失败')
      }
    }
  }
}
</script>

<style scoped>
.sku-management { padding: 20px; }
.filter-card { margin-bottom: 20px; }
.batch-card { margin-bottom: 20px; }
.batch-actions { display: flex; align-items: center; gap: 12px; }
.table-card { margin-bottom: 20px; }
.el-pagination { margin-top: 20px; text-align: right; }
</style>

<!-- dialogs: 上传图片 / 会员价格 / 折扣 / 满减 -->
    <el-dialog title="上传图片" :visible.sync="dlg.uploadImages" width="720px">
      <MultiUpload v-model="uploadImagesModel.list" />
      <span slot="footer" class="dialog-footer">
        <el-button @click="dlg.uploadImages=false">取 消</el-button>
        <el-button type="primary" @click="submitUploadImages">保 存</el-button>
      </span>
    </el-dialog>

    <el-dialog title="会员价格" :visible.sync="dlg.memberPrice" width="560px">
      <el-form label-width="90px">
        <el-form-item v-for="mp in memberPriceModel" :key="mp.id" :label="mp.name">
          <el-input-number v-model="mp.price" :precision="2" :min="0" :step="1" />
        </el-form-item>
      </el-form>
      <span slot="footer" class="dialog-footer">
        <el-button @click="dlg.memberPrice=false">取 消</el-button>
        <el-button type="primary" @click="submitMemberPrice">保 存</el-button>
      </span>
    </el-dialog>

    <el-dialog title="折扣设置（阶梯价）" :visible.sync="dlg.discount" width="560px">
      <el-form label-width="120px">
        <el-form-item label="满几件">
          <el-input-number v-model="discountModel.fullCount" :min="0" />
        </el-form-item>
        <el-form-item label="折扣(0-1)">
          <el-input-number v-model="discountModel.discount" :min="0" :max="1" :step="0.01" :precision="2" />
        </el-form-item>
        <el-form-item>
          <el-checkbox v-model="discountModel.countStatus" :true-label="1" :false-label="0">可叠加优惠</el-checkbox>
        </el-form-item>
      </el-form>
      <span slot="footer" class="dialog-footer">
        <el-button @click="dlg.discount=false">取 消</el-button>
        <el-button type="primary" @click="submitDiscount">保 存</el-button>
      </span>
    </el-dialog>

    <el-dialog title="满减设置" :visible.sync="dlg.reduction" width="560px">
      <el-form label-width="120px">
        <el-form-item label="满多少元">
          <el-input-number v-model="reductionModel.fullPrice" :min="0" :step="10" />
        </el-form-item>
        <el-form-item label="减多少元">
          <el-input-number v-model="reductionModel.reducePrice" :min="0" :step="1" />
        </el-form-item>
        <el-form-item>
          <el-checkbox v-model="reductionModel.priceStatus" :true-label="1" :false-label="0">可叠加优惠</el-checkbox>
        </el-form-item>
      </el-form>
      <span slot="footer" class="dialog-footer">
        <el-button @click="dlg.reduction=false">取 消</el-button>
        <el-button type="primary" @click="submitReduction">保 存</el-button>
      </span>
    </el-dialog>

    <el-dialog title="参与秒杀" :visible.sync="dlg.seckill" width="560px">
      <el-form label-width="100px">
        <el-form-item label="开始时间">
          <el-date-picker v-model="seckillModel.startTime" type="datetime" placeholder="选择日期时间" style="width: 100%" />
        </el-form-item>
        <el-form-item label="结束时间">
          <el-date-picker v-model="seckillModel.endTime" type="datetime" placeholder="选择日期时间" style="width: 100%" />
        </el-form-item>
        <el-form-item label="秒杀价">
          <el-input-number v-model="seckillModel.seckillPrice" :min="0" :precision="2" :step="1" />
        </el-form-item>
        <el-form-item label="库存">
          <el-input-number v-model="seckillModel.seckillCount" :min="0" :step="1" />
        </el-form-item>
        <el-form-item label="限购">
          <el-input-number v-model="seckillModel.seckillLimit" :min="1" :step="1" />
        </el-form-item>
      </el-form>
      <span slot="footer" class="dialog-footer">
        <el-button @click="dlg.seckill=false">取 消</el-button>
        <el-button type="primary" @click="submitSeckill">保 存</el-button>
      </span>
    </el-dialog>

    <el-dialog title="库存管理" :visible.sync="dlg.stock" width="480px">
      <el-form label-width="90px">
        <el-form-item label="可用库存">
          <el-input-number v-model="stockModel.stock" :min="0" :step="1" />
        </el-form-item>
      </el-form>
      <span slot="footer" class="dialog-footer">
        <el-button @click="dlg.stock=false">取 消</el-button>
        <el-button type="primary" @click="submitStock">保 存</el-button>
      </span>
    </el-dialog>

    <el-dialog title="绑定优惠券" :visible.sync="dlg.coupon" width="560px">
      <el-form label-width="90px">
        <el-form-item label="选择优惠券">
          <el-select v-model="couponModel.couponIds" multiple filterable placeholder="请选择优惠券" style="width:100%">
            <el-option v-for="opt in couponOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
      </el-form>
      <span slot="footer" class="dialog-footer">
        <el-button @click="dlg.coupon=false">取 消</el-button>
        <el-button type="primary" @click="submitCoupon">绑 定</el-button>
      </span>
    </el-dialog>

    <el-dialog title="编辑SKU" :visible.sync="dlg.edit" width="560px">
      <el-form label-width="100px">
        <el-form-item label="SKU名称">
          <el-input v-model="editModel.skuName" />
        </el-form-item>
        <el-form-item label="标题">
          <el-input v-model="editModel.skuTitle" />
        </el-form-item>
        <el-form-item label="副标题">
          <el-input v-model="editModel.skuSubtitle" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="价格">
          <el-input-number v-model="editModel.price" :min="0" :precision="2" :step="1" />
        </el-form-item>
      </el-form>
      <span slot="footer" class="dialog-footer">
        <el-button @click="dlg.edit=false">取 消</el-button>
        <el-button type="primary" @click="submitEdit">保 存</el-button>
      </span>
    </el-dialog>


