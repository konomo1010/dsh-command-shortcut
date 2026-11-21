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

在 DSH 里 **插件（Plugins）→ 添加插件（Add plugin）**，选本目录。本地目录安装会把目录 link 进 profile，改代码即时生效。

装完**重启 DSH 桌面端**（客户端 bundle 只在启动时加载）；之后只改 `client.js` 的话，`Ctrl+R` 重载窗口即可重新拉取模块。

手工安装（等价做法，供参考）：

- profile 的 `package.json`：`dependencies` 加 `"dsh-command-shortcut": "file:<本目录绝对路径>"`，`dsh.profile.bundles` 追加 `"dsh-command-shortcut"`
- `node_modules/dsh-command-shortcut` 指向本目录（跨盘符请用 junction，`pnpm link:` 会产生坏 symlink）

卸载：删掉上面的依赖行、bundles 项和 `node_modules` 里的那个链接，重启即可。**数据不会被删**（见下）。

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
