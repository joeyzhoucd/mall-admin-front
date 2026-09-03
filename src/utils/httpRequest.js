import Vue from 'vue'
import axios from 'axios'
import router from '@/router'
import qs from 'qs'
import merge from 'lodash/merge'
import { clearLoginInfo } from '@/utils'

const http = axios.create({
  timeout: 1000 * 30,
  headers: {
    'Content-Type': 'application/json; charset=utf-8'
  }
})

/**
 * 请求拦截
 */
http.interceptors.request.use(config => {
  config.headers['token'] = Vue.cookie.get('token') // 请求头带上token
  return config
}, error => {
  return Promise.reject(error)
})

/**
 * 响应拦截
 */
http.interceptors.response.use(response => {
  if (response.data && response.data.code === 401) { // 401, token失效
    clearLoginInfo()
    router.push({ name: 'login' })
  }
  return response
}, error => {
  // 网关的 AdminAuthFilter 对 /api/** 校验管理端令牌，失败时返回【真正的 HTTP 401】。
  // 那种响应走的是这个 error 分支，上面那段只看 response.data.code 的逻辑够不着 ——
  // 不在这里处理的话，令牌过期的表现会从「跳回登录页」退化成「页面上什么都没发生」。
  //
  // 网关刻意不用「HTTP 200 + code:401」那套老约定：用 200 表示鉴权失败会让它在
  // 监控里完全隐形（http_server_requests 里全是 200）。响应体里仍然带 code:401，
  // 所以两条路径都能触发跳转。
  if (error.response && error.response.status === 401) {
    clearLoginInfo()
    router.push({ name: 'login' })
  }
  return Promise.reject(error)
})

/**
 * 请求地址处理
 * @param {*} actionName action方法名称
 */
http.adornUrl = (actionName) => {
  // 后端已配置CORS，直接使用baseUrl
  return window.SITE_CONFIG.baseUrl + actionName
}

/**
 * get请求参数处理
 * @param {*} params 参数对象
 * @param {*} openDefaultParams 是否开启默认参数?
 */
http.adornParams = (params = {}, openDefaultParams = true) => {
  var defaults = {
    't': new Date().getTime()
  }
  return openDefaultParams ? merge(defaults, params) : params
}

/**
 * post请求数据处理
 * @param {*} data 数据对象
 * @param {*} openDefaultData 是否开启默认数据?
 * @param {*} contentType 数据格式
 *  json: 'application/json; charset=utf-8'
 *  form: 'application/x-www-form-urlencoded; charset=utf-8'
 */
http.adornData = (data = {}, openDefaultData = true, contentType = 'json') => {
  var defaults = {
    't': new Date().getTime()
  }
  data = openDefaultData ? merge(defaults, data) : data
  return contentType === 'json' ? JSON.stringify(data) : qs.stringify(data)
}

export default http
