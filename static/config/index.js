/**
 * 开发环境
 */
;(function () {
  window.SITE_CONFIG = {};

  // api接口请求地址：相对路径，交给同一个 Nginx 反向代理转发到 mall-gateway，
  // 不用管部署到哪个域名/IP，也不会有跨域问题。
  window.SITE_CONFIG['baseUrl'] = '/api';

  // cdn地址 = 域名 + 版本号
  window.SITE_CONFIG['domain']  = './'; // 域名
  window.SITE_CONFIG['version'] = '';   // 版本号(年月日时分)
  window.SITE_CONFIG['cdnUrl']  = window.SITE_CONFIG.domain + window.SITE_CONFIG.version;
})();
