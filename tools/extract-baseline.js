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

  // ---- 变量形式：adornUrl(url)，url 在上面几行被赋值 ----
  //
  // 【为什么必须处理这一种】只认字面量的第一版漏掉了【所有的保存接口】——
  // 6 个页面都写成 const url = this.isEdit ? '/x/update' : '/x/save'，
  // 于是 brand 页的基线里有 delete、list、updateStatus，唯独没有 save 和 update。
  // 一份系统性偏低的基线比没有基线更危险：它让人以为验收清单是全的。
  //
  // 做法是精确的而不是猜的：先拿到被传进 adornUrl 的【变量名】，
  // 再只在那个变量的赋值语句里找路径字面量。不做全文件扫路径字符串，
  // 因为那会把 router 里的 path 也当成接口。
  for (const m of src.matchAll(/adornUrl\(\s*([A-Za-z_$][\w$.]*)\s*\)/g)) {
    const name = m[1];
    // this.apiUrl 这种要找两个地方：`this.apiUrl = ...` 找不到时，
    // 它多半是个 prop，值写在 `apiUrl: { default: '/x' }` 里。
    // 不回退的话，凡是把地址做成 prop 的可复用组件在基线里都是个洞。
    const candidates = name.startsWith('this.') ? [name, name.slice(5)] : [name];
    let hit = false;
    for (const cand of candidates) {
      const esc = cand.replace(/[.*+?^${}()|[\]\\]/g, (c) => '\\' + c);
      const assign = new RegExp('(?:const|let|var|this)?\\s*' + esc + '\\s*[:=]([^\\n]*)', 'g');
      for (const a of src.matchAll(assign)) {
        for (const lit of a[1].matchAll(/['"`](\/[^'"`]*)['"`]/g)) {
          found.add(lit[1].replace(/\$\{[^}]*\}/g, '{}'));
          hit = true;
        }
      }
      // prop 的 default 和属性名不在同一行：`apiUrl: {` 换行后才是 `default: '/x'`。
      if (!hit) {
        const block = new RegExp(esc + '\\s*:\\s*\\{[^}]*?default\\s*:\\s*[\'"`](/[^\'"`]*)[\'"`]', 's');
        const b = block.exec(src);
        if (b) { found.add(b[1].replace(/\$\{[^}]*\}/g, '{}')); hit = true; }
      }
      if (hit) break;
    }
    // 解析不出来的要【说出来】，不能静默当成「这里没有接口」。
    // 典型是 TreeSelector 的 this.apiUrl —— 它是父组件传进来的 prop，
    // 值不在这个文件里，本文件的基线对它确实有个洞，那就把洞标出来。
    if (!hit) found.add('(未解析的动态地址: ' + name + ')');
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
