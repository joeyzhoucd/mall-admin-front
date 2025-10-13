<template>
  <div class="spu-add">
    <el-steps :active="step" finish-status="success" simple style="margin-bottom: 16px;">
      <el-step title="基本信息" />
      <el-step title="规格参数" />
      <el-step title="销售属性" />
      <el-step title="SKU信息" />
      <el-step title="保存发布" />
    </el-steps>

    <!-- 1. 基本信息 -->
    <section v-show="step===0">
      <el-form ref="baseForm" :model="spu" :rules="rules" label-width="110px" class="form-section">
        <el-form-item label="商品名称" prop="spuName">
          <el-input v-model="spu.spuName" />
        </el-form-item>
        <el-form-item label="商品描述" prop="spuDescription">
          <el-input v-model="spu.spuDescription" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="选择分类" prop="categoryId">
          <el-cascader
            v-model="categoryPath"
            :options="categoryOptions"
            :props="{ checkStrictly: true, emitPath: true, expandTrigger: 'hover' }"
            filterable
            clearable
            :show-all-levels="false"
            style="width: 320px"
            placeholder="请选择分类"
            @change="handleCategoryChange" />
          <div v-if="categoryPathText" class="path-tip">{{ categoryPathText }}</div>
        </el-form-item>
        <el-form-item label="选择品牌" prop="brandId">
          <BrandSelect v-model="spu.brandId" />
        </el-form-item>
        <el-form-item label="商品重量(kg)" prop="weight">
          <el-input-number v-model="spu.weight" :min="0" :step="0.01" />
        </el-form-item>
        <el-form-item label="设置积分" prop="bounds">
          <label>金币</label>
          <el-input-number
            style="width:130px"
            placeholder="金币"
            v-model="spu.bounds.buyBounds"
            :min="0"
            controls-position="right"
          />
          <label style="margin-left:15px">成长值</label>
          <el-input-number
            style="width:130px"
            placeholder="成长值"
            v-model="spu.bounds.growBounds"
            :min="0"
            controls-position="right"
          />
        </el-form-item>
        <el-form-item label="商品介绍" prop="decript">
          <MultiUpload v-model="spu.decript" />
        </el-form-item>
        <el-form-item label="商品图集" prop="images">
          <MultiUpload v-model="spu.images" />
        </el-form-item>
      </el-form>
    </section>

    <!-- 2. 规格参数（基础属性） -->
    <section v-show="step===1">
      <div class="section-title">规格参数</div>
      <el-alert v-if="!spu.categoryId" title="请先在“基本信息”选择分类" type="warning" show-icon :closable="false" />
      <el-card v-else class="attr-card">
        <el-tabs tab-position="left" style="width:98%">
          <el-tab-pane :label="group.attrGroupName" v-for="(group,gidx) in dataResp.attrGroups" :key="group.attrGroupId">
            <el-form :model="spu">
              <el-form-item :label="attr.attrName" v-for="(attr,aidx) in group.attrs" :key="attr.attrId">
                <el-input v-model="dataResp.baseAttrs[gidx][aidx].attrId" type="hidden" v-show="false" />
                <el-select v-model="dataResp.baseAttrs[gidx][aidx].attrValues" :multiple="attr.valueType == 1" filterable allow-create default-first-option placeholder="请选择或输入值">
                  <el-option v-for="(val,vidx) in (attr.valueSelect || '').split(',')" :key="vidx" :label="val" :value="val" />
                </el-select>
                <el-checkbox v-model="dataResp.baseAttrs[gidx][aidx].showDesc" :true-label="1" :false-label="0">快速展示</el-checkbox>
              </el-form-item>
            </el-form>
          </el-tab-pane>
        </el-tabs>
      </el-card>
    </section>

    <!-- 3. 销售属性（组合生成SKU） -->
    <section v-show="step===2">
      <div class="section-title">销售属性</div>
      <el-card v-for="(s, sidx) in dataResp.saleAttrs" :key="s.attrId" class="attr-card">
        <div slot="header" class="clearfix">
          <span>{{ s.attrName }}</span>
        </div>
        <el-checkbox-group v-model="dataResp.tempSaleAttrs[sidx].attrValues">
          <template v-if="(dataResp.saleAttrs[sidx].valueSelect || '') !== ''">
            <el-checkbox v-for="val in dataResp.saleAttrs[sidx].valueSelect.split(',')" :key="val" :label="val">{{ val }}</el-checkbox>
          </template>
        </el-checkbox-group>
        <div style="margin-top:8px;">
          <el-button v-if="!inputVisible[sidx] || inputVisible[sidx].view === false" size="mini" @click="showInput(sidx)">+自定义</el-button>
          <el-input
            v-if="inputVisible[sidx] && inputVisible[sidx].view === true && inputValue[sidx]"
            v-model="inputValue[sidx].val"
            size="mini"
            style="width:220px"
            @keyup.enter.native="handleInputConfirm(sidx)"
            @blur="handleInputConfirm(sidx)"
          />
        </div>
      </el-card>
      
    </section>

    <!-- 4. SKU信息 -->
    <section v-show="step===3">
      <div class="section-title">SKU信息</div>
      <el-table :data="skus" size="small" style="width:100%" header-cell-style="background-color:#f5f7fa" cell-style="padding:8px">
        <el-table-column label="属性组合" width="180">
          <template slot-scope="scope">
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
              <el-tag v-for="attr in scope.row.attr" :key="attr.attrId" size="small">
                {{ attr.attrName }}: {{ attr.attrValue }}
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="商品名称" width="220">
          <template slot-scope="scope">
            <el-input v-model="scope.row.skuName" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="标题" width="200">
          <template slot-scope="scope">
            <el-input v-model="scope.row.skuTitle" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="副标题" width="200">
          <template slot-scope="scope">
            <el-input v-model="scope.row.skuSubtitle" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="价格" width="150">
          <template slot-scope="scope">
            <el-input-number v-model="scope.row.price" :min="0" :step="1" size="small" style="width:120px" />
          </template>
        </el-table-column>
        <el-table-column type="expand">
          <template slot-scope="scope">
            <el-row>
              <el-col :span="24">
                <label style="display:block;float:left">选择图集 或</label>
                <MultiUpload style="float:left;margin-left:10px;" :showFile="false" :listType="'text'" v-model="uploadImages" />
              </el-col>
              <el-col :span="24"><el-divider /></el-col>
              <el-col :span="24">
                <el-card
                  style="width:170px;float:left;margin-left:15px;margin-top:15px;"
                  :body-style="{ padding: '0px' }"
                  v-for="(img,index) in spu.images"
                  :key="index"
                >
                  <img :src="img" style="width:160px;height:120px" />
                  <div style="padding: 14px;">
                    <el-row>
                      <el-col :span="12">
                        <el-checkbox v-model="scope.row.images[index].imgUrl" :true-label="img" :false-label="''" />
                      </el-col>
                      <el-col :span="12">
                        <el-tag v-if="scope.row.images[index].defaultImg == 1">
                          <input type="radio" checked :name="scope.row.skuName" @change="checkDefaultImg(scope.row,index,img)" />设为默认
                        </el-tag>
                        <el-tag v-else>
                          <input type="radio" :name="scope.row.skuName" @change="checkDefaultImg(scope.row,index,img)" />设为默认
                        </el-tag>
                      </el-col>
                    </el-row>
                  </div>
                </el-card>
              </el-col>
            </el-row>
            <el-form :model="scope.row" label-width="90px" style="margin-top:12px">
              <el-row>
                <el-col :span="24">
                  <el-form-item label="设置折扣">
                    <label>满</label>
                    <el-input-number style="width:160px" :min="0" controls-position="right" v-model="scope.row.fullCount" />
                    <label>件</label>
                    <label style="margin-left:15px;">打</label>
                    <el-input-number style="width:160px" v-model="scope.row.discount" :precision="2" :max="1" :min="0" :step="0.01" controls-position="right" />
                    <label>折</label>
                    <el-checkbox v-model="scope.row.countStatus" :true-label="1" :false-label="0">可叠加优惠</el-checkbox>
                  </el-form-item>
                </el-col>
                <el-col :span="24">
                  <el-form-item label="设置满减">
                    <label>满</label>
                    <el-input-number style="width:160px" v-model="scope.row.fullPrice" :step="100" :min="0" controls-position="right" />
                    <label>元</label>
                    <label style="margin-left:15px;">减</label>
                    <el-input-number style="width:160px" v-model="scope.row.reducePrice" :step="10" :min="0" controls-position="right" />
                    <label>元</label>
                    <el-checkbox v-model="scope.row.priceStatus" :true-label="1" :false-label="0">可叠加优惠</el-checkbox>
                  </el-form-item>
                </el-col>
                <el-col :span="24" v-if="scope.row.memberPrice && scope.row.memberPrice.length>0">
                  <el-form-item label="设置会员价">
                    <el-form-item v-for="(mp,mpidx) in scope.row.memberPrice" :key="mp.id">
                      {{ mp.name }}
                      <el-input-number style="width:160px" v-model="scope.row.memberPrice[mpidx].price" :precision="2" :min="0" controls-position="right" />
                    </el-form-item>
                  </el-form-item>
                </el-col>
              </el-row>
            </el-form>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <div class="actions">
      <el-button :disabled="step===0" @click="prev">上一步</el-button>
      <el-button type="primary" @click="next">{{ step<4 ? '下一步' : '完成' }}</el-button>
    </div>
  </div>
</template>

<script>
import http from '@/utils/httpRequest'
import OssUpload from '@/components/OssUpload.vue'
import MultiUpload from '@/components/upload/multiUpload.vue'
import BrandSelect from '@/views/modules/product/brand-select.vue'
import bus from '@/utils/eventBus'

export default {
  name: 'SpuAdd',
  components: { OssUpload, BrandSelect, MultiUpload },
  data () {
    return {
      step: 0,
      spu: {
        spuName: '',
        spuDescription: '',
        categoryId: null,
        brandId: null,
        weight: 0,
        bounds: { buyBounds: 0, growBounds: 0 },
        decript: [],
        images: []
      },
      uploadImages: [],
      categoryPath: [],
      categoryOptions: [],
      categoryPathText: '',
      brandOptions: [],
      // 对齐示例的数据承载
      dataResp: {
        attrGroups: [],
        baseAttrs: [],
        saleAttrs: [],
        tempSaleAttrs: [],
        tableAttrColumn: [],
        memberLevels: [],
        steped: [false, false, false, false, false]
      },
      skus: [],
      memberLevels: [],
      inputVisible: [],
      inputValue: [],
      rules: {
        spuName: [{ required: true, message: '请输入商品名称', trigger: 'blur' }],
        categoryId: [{ required: true, message: '请选择分类', trigger: 'change' }],
        brandId: [{ required: true, message: '请选择品牌', trigger: 'change' }]
      }
    }
  },
  watch: {
    uploadImages (val) {
      // 合并到 spu.images 并去重
      const current = Array.isArray(this.spu.images) ? this.spu.images.slice() : []
      const incoming = Array.isArray(val) ? val.slice() : []
      const merged = Array.from(new Set(current.concat(incoming)))
      // 同步 sku images 长度
      const newLen = merged.length
      this.spu.images = merged
      if (Array.isArray(this.skus)) {
        this.skus.forEach((sku) => {
          if (!Array.isArray(sku.images)) sku.images = []
          // 扩展或裁剪到新长度
          if (sku.images.length < newLen) {
            const add = newLen - sku.images.length
            for (let i = 0; i < add; i++) sku.images.push({ imgUrl: '', defaultImg: 0 })
          } else if (sku.images.length > newLen) {
            sku.images.splice(newLen)
          }
          // 若默认图位不存在，设置第一个为默认
          if (!sku.images.some(i => String(i.defaultImg) === '1' || i.defaultImg === 1)) {
            if (sku.images[0]) sku.images[0].defaultImg = 1
          }
        })
      }
    }
  },
  created () {
    this.fetchCategories()
    this.fetchMemberLevels()
  },
  methods: {
    async fetchCategories () {
      try {
        const { data } = await http({ url: http.adornUrl('/product/category/list/tree'), method: 'get', params: http.adornParams({}) })
        if (data && data.code === 0) {
          const toOptions = (nodes = []) => nodes.map(n => {
            const o = { value: n.catId, label: n.name }
            if (n.children && n.children.length) {
              o.children = toOptions(n.children)
            }
            return o
          })
          this.categoryOptions = toOptions((data.data && data.data) || [])
        }
      } catch (e) {}
    },
    async fetchMemberLevels () {
      try {
        const { data } = await http({ url: http.adornUrl('/member/memberlevel/list'), method: 'get', params: http.adornParams({ page: 1, limit: 500 }) })
        const listA = data && data.page && data.page.list
        const listB = data && data.data && data.data.list
        if (data && (listA || listB)) {
          this.memberLevels = listA || listB || []
        }
      } catch (e) {}
    },
    // 品牌通过 BrandSelect + 事件总线过滤，移除这里的全量拉取
    handleCategoryChange (path) {
      if (Array.isArray(path) && path.length) {
        this.spu.categoryId = path[path.length - 1]
        // 通知品牌选择器过滤
        bus.$emit('category-changed', this.spu.categoryId)
        // 计算路径名称
        const findLabelPath = (opts, ids, acc = []) => {
          if (!ids.length) return acc
          const id = ids[0]
          const node = (opts || []).find(o => String(o.value) === String(id))
          if (!node) return acc
          acc.push(node.label)
          return findLabelPath(node.children, ids.slice(1), acc)
        }
        const labels = findLabelPath(this.categoryOptions, path, [])
        this.categoryPathText = labels.join(' / ')
      } else {
        this.spu.categoryId = null
        this.categoryPathText = ''
      }
    },
    // 分组基础属性与销售属性加载
    showBaseAttrs () {
      if (!this.dataResp.steped[0]) {
        http({ url: http.adornUrl(`/product/attrgroup/withattr/${this.spu.categoryId}`), method: 'get', params: http.adornParams({}) })
          .then(({ data }) => {
            const groups = (data && data.data) || []
            // 初始化 baseAttrs 结构
            this.dataResp.baseAttrs = []
            groups.forEach(group => {
              const arr = []
              ;(group.attrs || []).forEach(attr => {
                arr.push({ attrId: attr.attrId, attrValues: '', showDesc: attr.showDesc })
              })
              this.dataResp.baseAttrs.push(arr)
            })
            this.dataResp.attrGroups = groups
            this.dataResp.steped[0] = true
          })
      }
    },
    generateSaleAttrs () {
      // 将 baseAttrs 组装到 spu.baseAttrs
      this.spu.baseAttrs = []
      this.dataResp.baseAttrs.forEach(item => {
        item.forEach(attr => {
          let { attrId, attrValues, showDesc } = attr
          if (attrValues !== '') {
            if (Array.isArray(attrValues)) attrValues = attrValues.join(',')
            this.spu.baseAttrs.push({ attrId, attrValues, showDesc })
          }
        })
      })
      // 加载销售属性
      if (!this.dataResp.steped[1]) {
        http({ url: http.adornUrl(`/product/attr/sale/list/${this.spu.categoryId}`), method: 'get', params: http.adornParams({ page: 1, limit: 500 }) })
          .then(({ data }) => {
            const list = (data && data.data && data.data.list) || []
            this.dataResp.saleAttrs = list
            this.dataResp.tempSaleAttrs = list.map(i => ({ attrId: i.attrId, attrValues: [], attrName: i.attrName }))
            this.inputVisible = list.map(() => ({ view: false }))
            this.inputValue = list.map(() => ({ val: '' }))
            this.dataResp.steped[1] = true
            this.step = 2
          })
      } else {
        this.step = 2
      }
    },
    showInput (idx) {
      if (!this.inputVisible[idx]) this.$set(this.inputVisible, idx, { view: false })
      if (!this.inputValue[idx]) this.$set(this.inputValue, idx, { val: '' })
      this.inputVisible[idx].view = true
    },
    handleInputConfirm (idx) {
      const val = ((this.inputValue[idx] && this.inputValue[idx].val) || '').trim()
      if (val) {
        if (!this.saleAttrs[idx].values.includes(val)) this.saleAttrs[idx].values.push(val)
        if (!this.saleAttrs[idx].selectedValues.includes(val)) this.saleAttrs[idx].selectedValues.push(val)
      }
      this.inputVisible[idx].view = false
      this.inputValue[idx].val = ''
    },
    generateSkus () {
      // 取已选择的销售属性值做笛卡尔积
      const selectedGroups = this.dataResp.tempSaleAttrs
        .map(a => a.attrValues.filter(Boolean).map(v => ({ key: a.attrName, value: v, attrId: a.attrId })))
        .filter(arr => arr.length > 0)
      if (selectedGroups.length === 0) { this.$message.info('请选择销售属性'); return }

      const product = (arrs) => arrs.reduce((acc, cur) => acc.flatMap(a => cur.map(b => [].concat(a, b))), [[]])
      const combo = product(selectedGroups)
      const buildMemberPrices = () => {
        const arr = []
        this.memberLevels.forEach(l => {
          if (String(l.priviledgeMemberPrice) === '1' || l.priviledgeMemberPrice === 1) {
            arr.push({ id: l.id, name: l.name, price: 0 })
          }
        })
        return arr
      }
      this.skus = combo.map((pairs, i) => ({
        attr: pairs.map(p => ({ attrId: p.attrId, attrName: p.key, attrValue: p.value })),
        skuName: [this.spu.spuName].concat(pairs.map(p => `${p.key} ${p.value}`)).join(' '),
        skuTitle: this.spu.spuName,
        skuSubtitle: '',
        price: 0,
        stock: 0,
        skuCode: '',
        images: (this.spu.images || []).map(() => ({ imgUrl: '', defaultImg: 0 })),
        fullCount: 0,
        discount: 0,
        countStatus: 0,
        fullPrice: 0,
        reducePrice: 0,
        priceStatus: 0,
        memberPrice: buildMemberPrices()
      }))
    },
    checkDefaultImg (row, index, img) {
      // 设置当前为默认并选中复选框
      row.images[index].imgUrl = img
      row.images[index].defaultImg = 1
      // 取消其他项的默认与选中
      row.images.forEach((item, idx) => {
        if (idx !== index) {
          row.images[idx].defaultImg = 0
          row.images[idx].imgUrl = ''
        }
      })
    },
    prev () { if (this.step > 0) this.step-- },
    next () {
      if (this.step === 0) {
        this.$refs.baseForm.validate(valid => {
          if (valid) {
            this.step++
            this.showBaseAttrs()
          } else {
            this.$message.error('请完善基本信息')
          }
        })
      } else if (this.step === 1) {
        // 从规格参数到销售属性
        this.generateSaleAttrs()
      } else if (this.step === 2) {
        // 从销售属性到SKU信息
        this.generateSkus()
        this.step++
      } else if (this.step === 3) {
        // 从SKU信息到保存发布
        this.step++
      } else if (this.step === 4) {
        // 保存发布
        this.saveSpu()
      }
    },
    async saveSpu () {
      try {
        // 提交前校验：商品介绍、图集、SKU图片必须是OSS地址，禁止 blob 本地预览地址
        const isBlob = (u) => typeof u === 'string' && u.indexOf('blob:') === 0
        if ((this.spu.decript || []).some(isBlob)) {
          this.$message.error('商品介绍图片仍为本地预览地址，请等待上传成功后再保存')
          return
        }
        if ((this.spu.images || []).some(isBlob)) {
          this.$message.error('商品图集仍为本地预览地址，请等待上传成功后再保存')
          return
        }
        for (let i = 0; i < (this.skus || []).length; i++) {
          const imgs = this.skus[i].images || []
          if (imgs.some(it => isBlob(it && it.imgUrl))) {
            this.$message.error('SKU 图片仍为本地预览地址，请等待上传成功后再保存')
            return
          }
        }

        // 构建保存数据
        const saveData = {
          spuName: this.spu.spuName,
          spuDescription: this.spu.spuDescription,
          categoryId: String(this.spu.categoryId), // 转换为字符串避免Long精度丢失
          brandId: String(this.spu.brandId), // 转换为字符串避免Long精度丢失
          weight: this.spu.weight,
          publishStatus: 0, // 默认下架状态
          decript: this.spu.decript,
          images: this.spu.images,
          bounds: this.spu.bounds,
          // 使用在 generateSaleAttrs 中已扁平化整理好的基础属性
          baseAttrs: this.spu.baseAttrs.map(attr => ({
            ...attr,
            attrId: String(attr.attrId) // 转换为字符串避免Long精度丢失
          })),
          skus: this.skus.map(sku => ({
            ...sku,
            price: String(sku.price), // 转换为字符串给BigDecimal
            discount: String(sku.discount), // 转换为字符串给BigDecimal
            fullPrice: String(sku.fullPrice), // 转换为字符串给BigDecimal
            reducePrice: String(sku.reducePrice), // 转换为字符串给BigDecimal
            attr: sku.attr.map(a => ({
              ...a,
              attrId: String(a.attrId) // 转换为字符串避免Long精度丢失
            })),
            memberPrice: sku.memberPrice.map(mp => ({
              ...mp,
              id: String(mp.id), // 转换为字符串避免Long精度丢失
              price: String(mp.price) // 转换为字符串给BigDecimal
            }))
          }))
        }

        console.log('保存数据:', saveData)

        const { data } = await http({
          url: http.adornUrl('/product/spuinfo/save'),
          method: 'post',
          data: http.adornData(saveData)
        })

        if (data && data.code === 0) {
          this.$message.success('保存成功')
          // 跳转到SPU管理页面
          this.$router.push('/spu')
        } else {
          this.$message.error(data.msg || '保存失败')
        }
      } catch (error) {
        console.error('保存失败:', error)
        this.$message.error('保存失败')
      }
    }
  }
}
</script>

<style scoped>
.spu-add { padding: 16px; }
.form-section { max-width: 860px; }
.actions { margin-top: 16px; }
.path-tip { margin-top: 6px; color: #909399; font-size: 12px; }
.placeholder { padding: 24px; color: #909399; }
</style>


