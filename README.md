# dsh-command-shortcut

DeepSeek Harness（DSH）桌面客户端插件：在输入框工具行左侧加一个 **⚡ 快捷指令** 按钮，点开是常用提示词面板。
点一条，文字直接填进输入框，**不会自动发送**。支持新增、编辑、删除、搜索，数据只存本机。

```
dsh-command-shortcut/
├─ package.json        # dsh.bundle.patch + dsh.client（platform: web / immediately / inject）
├─ cordis.patch.yml    # - insert: 一行 {id: command-shortcut, name: dsh-command-shortcut}
├─ index.js            # host 半体：export function apply() {}，本插件只贡献浏览器 UI
├─ client.js           # 浏览器半体：Chip → conversation.input.left，Panel → conversation.input.overlay
├─ icon.svg            # 插件图标（深蓝底 + 黄橙闪电）
├─ locale/zh.json      # display metadata（中文）
└─ locale/en.json      # display metadata（英文）
```

## 实现要点

- **按钮**注册在 `conversation.input.left`（输入框工具行左侧的紧凑控件），外观对齐宿主原生胶囊：28px 高、`--dsw-radius-sm` 圆角、13px/500、hover 用 `--dsw-alias-interactive-bg-hover`。
- **面板**注册在 `conversation.input.overlay`，但该槽位在宿主里是 `height:0; position:absolute` 的零高度锚点，直接渲染会被压在输入框上。因此面板通过 `react-dom` 的 `createPortal` 挂到 `document.body`，用 `position: fixed` 定位，坐标由按钮的 `getBoundingClientRect()` 计算（贴按钮上方 6px、左右夹紧视口）。
- 宿主缺 `react-dom` 时自动回落到锚点内 `position: absolute`。
- **列表条目单行**：名称（`max-width:45%`）+ 内容（单行省略）同排，高 30px；编辑/删除按钮绝对定位在右侧、hover 才出现。
- **填充**：`props.inputActions.setDraft(text)`；取不到时退回 `insertText(text, captureInsertion())`。
- **样式**只用宿主 CSS token（`--dsw-specific-menu` / `--dsw-menu-backdrop-filter` / `--dsw-elevation-prominent` / `--dsw-alias-border-l1..l4` / `--dsw-alias-label-primary|secondary|tertiary` / `--dsw-alias-interactive-bg-hover(-solid)` / `--dsw-alias-button-info-fill(-hover)` / `--dsw-radius-sm|lg` / `--dsw-specific-input-major`），跟随明暗主题，无硬编码配色。
- 交互：Esc 关闭（编辑态先退出编辑）、点面板外关闭、窗口 resize/scroll 收起、打开时搜索框自动聚焦。

## 安装

推荐：在 DSH 里 **插件（Plugins）→ 添加插件（Add plugin）**，填仓库地址：

```
https://github.com/konomo1010/dsh-command-shortcut/archive/refs/heads/main.tar.gz
```

用 tarball 地址而不是 `github:konomo1010/dsh-command-shortcut`，原因是后者要本机有 `git`（pnpm 靠 `git ls-remote` 解析），而 tarball 只走 HTTPS。两种方式装完都要把包名加进 profile `dsh.profile.bundles`，否则 patch 不生效。

装完**重启 DSH 桌面端**（host 半体与 client bundle 都只在启动时加载）；之后只改 `client.js` 的话，`Ctrl+R` 重载窗口即可重新拉取模块。

### 必须装成「拷贝」，不要装成「链接」

从上面的 GitHub 地址装完，`node_modules/dsh-command-shortcut` 是包自身的**拷贝**，加载路径由包名相对 profile 解析，跟源码目录、盘符、机器都无关。

反过来，用 `file:<本地绝对路径>` 装、或者手工建 junction/symlink，加载器会按 realpath 顺着链接走到那个绝对路径去读 `index.js`：那个目录一旦被清空，或者在别的机器上本来就不存在，就会报 `ENOENT ... open 'D:\...\index.js'`。

验证（在 profile 目录里执行，输出应落在 profile 内）：

```
node -e "const{createRequire}=require('node:module');const r=createRequire(process.cwd()+'/x.js');console.log(r.resolve('dsh-command-shortcut'))"
```

预期是 `.../.dsh/profiles/<profile 名>/node_modules/dsh-command-shortcut/index.js`。若打印出 `D:\project\...` 之类的源码路径，说明装成了链接，删掉该条目重装即可。

手工安装（**仅本机调试用，不要用于分发**）：

- profile 的 `package.json`：`dependencies` 加 `"dsh-command-shortcut": "<上面的 tarball 地址>"`，`dsh.profile.bundles` 追加 `"dsh-command-shortcut"`
- 想改代码时，改源码 → 重新装一次（或把改动拷进 profile 里那份拷贝），别用 `file:` 把 profile 指回源码目录

卸载：删掉上面的依赖行、bundles 项和 `node_modules` 里的那个条目，重启即可。**数据不会被删**（见下）。

## 故障排查

**启用失败：`failed to import: Error: ENOENT ... open 'D:\...\dsh-command-shortcut\index.js'`**

说明 profile 里那条依赖被解析成了本地目录，但那个目录里已经没有 `index.js`。常见成因是「先用本地目录装过，再用 GitHub 地址重装」：本地目录装出来的 `node_modules/dsh-command-shortcut` 是指向源码目录的链接（junction），插件管理器在**清理旧安装条目**时会按该条目路径逐项删除，链接被穿透，**源码目录里的文件被一起清掉**，只剩一个空目录；下一次加载按链接 realpath 去源码路径找 `index.js`，于是报 ENOENT。（实测 pnpm 自己换依赖来源时不会删源码，这一步是管理器做的。）恢复办法：重新从仓库拉一份源码覆盖回原目录，然后清掉 `node_modules` 里残留的链接（用 `rmdir` 删链接本身，别用递归删除），再重装。根治办法是**只用拷贝式安装**（见上面「必须装成拷贝」一节），让加载路径永远落在 profile 内。

**`ERR_PNPM_GIT_RESOLVE_FAILED ... git ls-remote failed: 'git' 不是内部或外部命令`**

本机没装 git。装 Git for Windows（或改用 tarball 地址，不需要 git）。

**`[ERROR] fetch failed` / `ECONNRESET`（访问 github.com、raw.githubusercontent.com 失败）**

github.com 在这个网络下直连不通。pnpm 不认系统代理，要在装之前给进程带上代理环境变量（`npm_config_https_proxy` / `npm_config_proxy` / `HTTPS_PROXY`，例如 `http://127.0.0.1:10808`）；只开浏览器的代理、或只在 IE 设置里填代理都不够。`codeload.github.com` 通常能直连，所以下载源码包优先用它。

**包里改了代码但界面没变**

`client.js` 属于浏览器半体：`Ctrl+R` 重载窗口即可；`index.js`、`cordis.patch.yml` 改了必须重启客户端。

## 数据

存在浏览器 `localStorage`，键 `dsh:command-shortcut:v1`，值形如 `[{ "id", "title", "text" }]`。

- origin 是 `dsh-app://app`，物理位置在 Electron 的：
  `%APPDATA%\@deepseek-ai\dsh-desktop\Local Storage\leveldb\`
- 默认两条示例（「总结要点」「写周报」）不落盘，首次修改后才写入。
- 卸载插件不会清数据；清站点数据即丢失。

## 已知范围

- 只做本机持久化，没有导入导出与云同步。
- UI 文案目前是中文硬编码；`locale/*.json` 只提供插件页的 display metadata。
- 不提供全局热键（要的话得走 `shell.overlay` + 宿主热键注册，是另一条实现路径）。
