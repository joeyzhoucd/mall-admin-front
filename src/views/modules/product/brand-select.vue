<template>
  <el-select v-model="innerBrandId" filterable clearable placeholder="请选择品牌" style="width: 300px">
    <el-option v-for="b in brands" :key="b.brandId" :label="b.name" :value="b.brandId" />
  </el-select>
  
</template>

<script>
import http from '@/utils/httpRequest'
import bus from '@/utils/eventBus'

export default {
  name: 'BrandSelect',
  data () {
    return {
      innerBrandId: null,
      categoryId: null,
      brands: []
    }
  },
  created () {
    bus.$on('category-changed', this.onCategoryChange)
  },
  beforeDestroy () {
    bus.$off('category-changed', this.onCategoryChange)
  },
  watch: {
    innerBrandId (val) {
      this.$emit('input', val)
      this.$emit('change', val)
      this.$emit('brandId', val)
    }
  },
  methods: {
    async onCategoryChange (categoryId) {
      this.categoryId = categoryId
      await this.fetchBrandsByCategory()
      // 如果当前选中品牌不在新列表中，则清空
      if (!this.brands.find(b => String(b.brandId) === String(this.innerBrandId))) {
        this.innerBrandId = null
      }
    },
    async fetchBrandsByCategory () {
      if (!this.categoryId) { this.brands = []; return }
      try {
        const { data } = await http({ url: http.adornUrl(`/product/categorybrandrelation/getRelationsByCategoryId/${this.categoryId}`), method: 'get', params: http.adornParams({}) })
        const listA = data && data.data
        const listB = data && data.page && data.page.list
        const raw = listA || listB || []
        this.brands = raw.map(it => ({ brandId: it.brandId, name: it.name || it.brandName || it.brand_name || '' }))
      } catch (e) { this.brands = [] }
    }
  }
}
</script>

<style scoped>
</style>


