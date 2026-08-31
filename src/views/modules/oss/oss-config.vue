<template>
  <el-dialog
    title="云存储配置"
    :close-on-click-modal="false"
    :visible.sync="visible">

    <el-alert
      type="info"
      :closable="false"
      show-icon
      title="这个页面是只读的"
      style="margin-bottom: 16px;">
      <div>
        存储凭据（AccessKey / SecretKey）不通过后台界面维护 —— 它们由 Sealed Secret
        注入成环境变量，改配置是一次部署，不是一次点击。
      </div>
      <div style="margin-top: 6px;">
        原来这里是一个能填七牛 / 阿里云 / 腾讯云 AccessKey+SecretKey 的表单、存进数据库。
        那等于任何拿到后台账号的人都能读走或替换掉存储凭据；而且密钥进了数据库就会进备份、
        进从库、进 binlog。所以对应的保存接口没有实现。
      </div>
    </el-alert>

    <div v-if="loading" style="text-align:center;padding:20px;">加载中…</div>

    <el-alert
      v-else-if="!config"
      type="warning"
      :closable="false"
      show-icon
      title="取不到存储配置">
      mall-thirdparty 可能不可用。这不影响已上传文件的浏览和删除，只是这里显示不出来。
    </el-alert>

    <table v-else class="cfg">
      <tr v-for="row in rows" :key="row.k">
        <th>{{ row.k }}</th>
        <td>{{ row.v }}</td>
      </tr>
    </table>

    <span slot="footer" class="dialog-footer">
      <el-button @click="visible = false">关闭</el-button>
    </span>
  </el-dialog>
</template>

<script>
  import http from '@/utils/httpRequest'

  export default {
    data () {
      return {
        visible: false,
        loading: false,
        config: null
      }
    },
    computed: {
      rows () {
        const c = this.config
        if (!c) return []
        const yesNo = (v) => (v ? '是' : '否')
        return [
          { k: '存储类型', v: c.provider },
          { k: '端点 endpoint', v: c.endpoint },
          { k: '区域 region', v: c.region },
          { k: '存储桶 bucket', v: c.bucket },
          // 这两项经常是排查问题的关键，所以显式列出来而不是藏起来：
          // path-style 搞错的表现是 DNS 解析不到子域名或 404，都不指向配置本身。
          { k: '路径风格访问', v: yesNo(c.pathStyleAccess) },
          { k: '对外地址前缀', v: c.publicBaseUrl || '（未设置，按 endpoint 拼）' },
          { k: '预签名有效期', v: `${c.presignExpireSeconds} 秒` },
          { k: '允许的扩展名', v: (c.allowedExtensions || []).join(', ') },
          // 只说明凭据在不在，不显示任何片段 —— 连前 4 位都不显示，
          // AccessKeyId 的前缀本身就能透露云厂商和账号族。
          { k: '凭据已注入', v: yesNo(c.credentialsConfigured) }
        ]
      }
    },
    methods: {
      init () {
        this.visible = true
        this.loading = true
        this.config = null
        http({
          url: http.adornUrl('/sys/oss/config'),
          method: 'get',
          params: http.adornParams()
        }).then(({ data }) => {
          this.config = (data && data.code === 0) ? data.config : null
          this.loading = false
        }).catch(() => {
          this.config = null
          this.loading = false
        })
      }
    }
  }
</script>

<style scoped>
  .cfg {
    width: 100%;
    border-collapse: collapse;
  }
  .cfg th, .cfg td {
    border: 1px solid #ebeef5;
    padding: 8px 12px;
    text-align: left;
    font-size: 13px;
  }
  .cfg th {
    width: 160px;
    background: #fafafa;
    font-weight: normal;
    color: #606266;
  }
  .cfg td {
    word-break: break-all;
  }
</style>
