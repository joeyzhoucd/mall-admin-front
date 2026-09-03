#!/usr/bin/env node
/**
 * 从旧 Vue 后台的源码里提取每个页面的「行为契约」，作为 React 重写的验收基线。
 *
 * 【为什么用源码提取而不是截图】
 * 截图只能记住界面长什么样，记不住「这个按钮调了哪个接口、带了什么参数」。
 * 而重写时最容易出的错恰恰是后者：页面看起来一样，点下去调错了接口或漏了参数，
 * 而且不报错。所以基线要记的是接口和动作，不是像素。
 *
 * 提取三类东西：
 *   1. 调用的后端接口（adornUrl）—— 重写后必须一个不少、一个不多
 *   2. 动作（按钮文案 + 它绑的方法）—— 界面能力清单
 *   3. 对话框标题 —— 弹层能力清单
 *
 * 用法：node extract-baseline.js <mall-frontend 根目录> > BASELINE.md
 */
const fs = require('fs');
const path = require('path');

const root = process.argv[2];
if (!root) {
  console.error('用法: node extract-baseline.js <mall-frontend 根目录>');
  process.exit(1);
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'dist') continue;
      walk(p, out);
    } else if (e.name.endsWith('.vue') || e.name.endsWith('.js')) {
      // 必须包含 .js：动态菜单接口 /sys/menu/nav 在 router/index.js 里、
      // 预签名上传 /thirdparty/oss/presign 在 utils/objectStorage.js 里。
      // 只扫 .vue 的第一版基线漏了这两个 —— 而它们恰好是外壳和上传的核心，
      // 漏在基线里就等于重写时漏掉这两项能力。
      out.push(p);
    }
  }
  return out;
}

/**
 * adornUrl('/x') 和 adornUrl(`/x/${y}`) 两种写法都要覆盖。
 *
 * 【为什么按引号类型分开写三条正则，而不是一条 (['"`])...\1】
 * 因为模板串内部可以再出现别的引号：
 *     adornUrl(`/sys/user/${!this.f.id ? 'save' : 'update'}`)
 * 用一条笼统的 [^'"`]+ 去捕获，会在模板串内部那个单引号处【截断】，
 * 于是这个接口就从基线里消失了。第一版就是这么写的，比 mall-deploy 的
 * audit-endpoints.js 少认出 7 个接口 —— 而那个脚本的注释里恰好警告过这个坑。
 * 每种定界符只排除自己，才能让内部的其它引号安全通过。
 */
function endpoints(src) {
  const found = new Set();
  const patterns = [
    /adornUrl\(\s*`([^`]+)`/g,
    /adornUrl\(\s*'([^']+)'/g,
    /adornUrl\(\s*"([^"]+)"/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(src)) !== null) {
      // 模板串里的 ${...} 归一成 {}，和后端的 {id} 对得上。
      // 注意 ${...} 内部可能有 ? : 三元表达式，所以用非贪婪到第一个 }
      // 会截错 —— 这里用 [^}]* 是安全的，因为 adornUrl 里的插值都是简单表达式。
      found.add(m[1].replace(/\$\{[^}]*\}/g, '{}'));
    }
  }
  return [...found].sort();
}

/** <el-button ...>文案</el-button>，同时抓它的 @click。 */
function actions(src) {
  const found = new Set();
  const re = /<el-button([^>]*)>([\s\S]*?)<\/el-button>/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const attrs = m[1];
    const label = m[2].replace(/<[^>]*>/g, '').replace(/\{\{[^}]*\}\}/g, '…').replace(/\s+/g, '').trim();
    const click = (attrs.match(/@click(?:\.\w+)*="([^"]*)"/) || [])[1];
    if (!label && !click) continue;
    found.add((label || '(无文案)') + (click ? ' → ' + click : ''));
  }
  return [...found].sort();
}

function dialogs(src) {
  const found = new Set();
  const re = /<el-dialog[^>]*title="([^"]*)"/g;
  let m;
  while ((m = re.exec(src)) !== null) found.add(m[1]);
  return [...found].sort();
}

/** 用到的 Element 组件种类 —— 决定 MUI 侧要准备什么等价物。 */
function elComponents(src) {
  const found = new Set();
  const re = /<(el-[a-z-]+)/g;
  let m;
  while ((m = re.exec(src)) !== null) found.add(m[1]);
  return [...found].sort();
}

const files = walk(path.join(root, 'src')).sort();
const pages = [];
const allEndpoints = new Set();
const allComponents = new Set();

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const rel = path.relative(root, f).replace(/\\/g, '/');
  const eps = endpoints(src);
  const comps = elComponents(src);
  eps.forEach((e) => allEndpoints.add(e));
  comps.forEach((c) => allComponents.add(c));
  pages.push({ rel, eps, acts: actions(src), dlgs: dialogs(src), comps, lines: src.split('\n').length });
}

// ---------------------------------------------------------------- 输出 Markdown
const L = [];
L.push('# 旧 Vue 后台的行为基线（React 重写的验收清单）');
L.push('');
L.push('> 由 `tools/extract-baseline.js` 从源码自动提取，不是手写的。');
L.push('> 重写每一页之后，对照这里的「接口」和「动作」逐条验收 ——');
L.push('> 界面长得像不代表行为一样，最容易出的错是「点下去调错了接口或漏了参数」，而且不报错。');
L.push('');
L.push('## 总量');
L.push('');
L.push('| 项 | 数 |');
L.push('|---|---|');
L.push(`| 页面/组件文件 | ${pages.length} |`);
L.push(`| 去重后的后端接口 | ${allEndpoints.size} |`);
L.push(`| 用到的 Element 组件种类 | ${allComponents.size} |`);
L.push(`| 源码行数 | ${pages.reduce((s, p) => s + p.lines, 0)} |`);
L.push('');
L.push('## Element 组件 → 需要的 MUI/TanStack 等价物');
L.push('');
L.push('这一列是 P0 就要决定的：缺哪个等价物，对应的页面在 P3–P6 就会卡住。');
L.push('');
L.push('```');
L.push([...allComponents].join('  '));
L.push('```');
L.push('');
L.push('## 逐页清单');
L.push('');

for (const p of pages) {
  if (!p.eps.length && !p.acts.length && !p.dlgs.length) continue;   // 纯展示型组件跳过
  L.push(`### \`${p.rel}\``);
  L.push('');
  if (p.eps.length) {
    L.push('**接口**（重写后必须一个不少、一个不多）：');
    L.push('');
    p.eps.forEach((e) => L.push(`- \`${e}\``));
    L.push('');
  }
  if (p.acts.length) {
    L.push('**动作**：');
    L.push('');
    p.acts.forEach((a) => L.push(`- ${a}`));
    L.push('');
  }
  if (p.dlgs.length) {
    L.push('**对话框**：' + p.dlgs.map((d) => `「${d}」`).join('、'));
    L.push('');
  }
}

console.log(L.join('\n'));
