import http from '@/utils/httpRequest'

/**
 * 浏览器直传对象存储：先向后端要一个预签名 PUT 地址，再把文件直接 PUT 上去。
 *
 * ---------------------------------------------------------------------------
 * 为什么改成这样（原来是阿里云 OSS 的 PostObject 表单直传）
 * ---------------------------------------------------------------------------
 * 后端已经把 aliyun-sdk-oss 换成了 S3 API（去阿里化的最后一个依赖），
 * 对应的上传方式也从「POST 表单 + policy 签名」变成「PUT 预签名 URL」。
 * 这是 S3 的通行做法，同一套前端代码能打 AWS S3 / MinIO / R2 /
 * 阿里云 OSS 的 S3 兼容端点。
 *
 * ---------------------------------------------------------------------------
 * 三个必须注意的点
 * ---------------------------------------------------------------------------
 * 1) PUT 请求【不能】走项目的 http 实例（axios）。
 *    那个实例会自动加上 baseURL 和 Authorization 头。对象存储收到一个
 *    不属于签名的 Authorization 头会直接拒绝（签名不匹配），而报错信息
 *    只会说签名有问题，完全不提示是多了一个头。所以这里用裸 XMLHttpRequest。
 *
 * 2) Content-Type 必须和后端签进签名里的那个【逐字一致】。
 *    后端把前端传过去的 contentType 签进 URL，浏览器上传时少一个头或者值不同，
 *    都会签名不匹配。所以后端在响应里把 requiredHeaders 回给前端，
 *    照着设，而不是让前端自己猜。
 *
 * 3) 对象名（key）由【后端】生成，前端不参与。
 *    老实现让前端拼 key，服务端只用 policy 约束了「必须在今天的日期目录下」——
 *    也就是任何人都能覆盖别人刚传的对象。现在前端只能用后端给的那一个 key。
 *
 * 已知缺口：预签名 PUT 【无法】在签名里限制文件大小（PostObject 的
 * content-length-range 没有对应物）。这里的前端大小校验只是体验优化，
 * 绕过它很容易。真正的限制要放在 bucket policy 或网关上，目前还没做。
 */
export function presignAndPut (file, { onProgress } = {}) {
  return new Promise((resolve, reject) => {
    http({
      url: http.adornUrl('/thirdparty/oss/presign'),
      method: 'get',
      params: http.adornParams({
        filename: file.name,
        contentType: file.type || 'application/octet-stream'
      })
    }).then(({ data }) => {
      if (!data || data.code !== 0 || !data.data) {
        reject(new Error((data && data.msg) || '获取上传地址失败'))
        return
      }
      const { uploadUrl, publicUrl, key, requiredHeaders } = data.data

      const xhr = new XMLHttpRequest()
      xhr.open('PUT', uploadUrl, true)
      // 只设后端要求的头。多设一个都可能让签名不匹配（见文件头第 1、2 点）。
      Object.keys(requiredHeaders || {}).forEach((h) => {
        xhr.setRequestHeader(h, requiredHeaders[h])
      })
      if (onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            onProgress({ percent: Math.round((e.loaded / e.total) * 100) })
          }
        }
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({ url: publicUrl, key })
        } else {
          // 把响应体带上：S3 兼容服务的报错是 XML，里面的 <Code> 才说明白是什么问题
          // （SignatureDoesNotMatch / AccessDenied / EntityTooLarge …）。
          // 只报一个状态码的话，签名问题和权限问题看起来一模一样。
          reject(new Error(`上传失败 HTTP ${xhr.status}: ${(xhr.responseText || '').slice(0, 300)}`))
        }
      }
      xhr.onerror = () => reject(new Error('上传失败：网络错误或跨域被拒绝（检查 bucket 的 CORS 是否允许 PUT）'))
      xhr.send(file)
    }).catch(reject)
  })
}
