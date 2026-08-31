<template>
  <el-dialog
    title="上传文件"
    :close-on-click-modal="false"
    @close="closeHandle"
    :visible.sync="visible">
    <el-upload
      drag
      action="#"
      :http-request="doUpload"
      :before-upload="beforeUploadHandle"
      multiple
      :file-list="fileList"
      style="text-align: center;">
      <i class="el-icon-upload"></i>
      <div class="el-upload__text">将文件拖到此处，或<em>点击上传</em></div>
      <div class="el-upload__tip" slot="tip">
        只支持 jpg、png、gif 格式的图片。文件直接传到对象存储，不经过后端。
      </div>
    </el-upload>
  </el-dialog>
</template>

<script>
  import http from '@/utils/httpRequest'
  import { presignAndPut } from '@/utils/objectStorage'

  export default {
    data () {
      return {
        visible: false,
        num: 0,
        successNum: 0,
        fileList: []
      }
    },
    methods: {
      init (id) {
        this.num = 0
        this.successNum = 0
        this.visible = true
      },

      beforeUploadHandle (file) {
        const ok = ['image/jpg', 'image/jpeg', 'image/png', 'image/gif'].includes(file.type)
        if (!ok) {
          this.$message.error('只支持jpg、png、gif格式的图片！')
          return false
        }
        this.num++
        return true
      },

      // 直传对象存储，再回调后端登记。
      //
      // 原来这里是 :action="/sys/oss/upload?token=..."，也就是让 el-upload 把文件
      // multipart POST 给后端，后端再转存到对象存储。那个接口现在【不存在了】，
      // 本项目统一走预签名直传（见 src/utils/objectStorage.js 的说明）：
      //   1) 向 /thirdparty/oss/presign 要一个预签名 PUT 地址（key 由服务端生成）
      //   2) 浏览器直接 PUT 到对象存储，字节不经过后端
      //   3) 成功后调 /sys/oss/confirm 登记，文件才会出现在列表里
      //
      // 顺带去掉了 token 挂在 query string 上那个写法 —— 令牌进 URL 会被写进
      // 网关和 ingress 的 access log。现在走 http 实例的标准请求头。
      //
      // 第 3 步漏掉的话文件在桶里但列表里看不到。这是这套设计已知的代价：
      // 后端不参与传输，就无法自己知道某次上传成没成功。
      async doUpload ({ file, onProgress }) {
        try {
          const { url, key } = await presignAndPut(file, { onProgress })
          const { data } = await http({
            url: http.adornUrl('/sys/oss/confirm'),
            method: 'post',
            data: http.adornData({
              url: url,
              objectKey: key,
              fileSize: file.size,
              contentType: file.type
            })
          })
          if (!data || data.code !== 0) {
            throw new Error((data && data.msg) || '登记失败')
          }
          this.successNum++
          if (this.num === this.successNum) {
            this.$confirm('操作成功, 是否继续操作?', '提示', {
              confirmButtonText: '确定',
              cancelButtonText: '取消',
              type: 'warning'
            }).catch(() => {
              this.visible = false
            })
          }
        } catch (e) {
          // 把真实原因带出来。直传的失败（签名不匹配 / CORS / 权限 / 登记失败）
          // 只看一句「上传失败」是分不开的，而它们要改的地方完全不同。
          console.error('上传失败:', e)
          this.$message.error(e.message || '上传失败')
        }
      },

      closeHandle () {
        this.fileList = []
        this.$emit('refreshDataList')
      }
    }
  }
</script>
