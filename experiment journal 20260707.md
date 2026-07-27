# 实验进展日志 20260707

## 总体研究进展

- 项目目标：将校园成长平台整理到可微信小程序内测的状态，保持 H5 业务页、Express API、管理后台和微信小程序 web-view 壳的真实闭环。
- 当前方向：先保证线上可访问、真实微信登录、免费内容浏览和基础互动可用，再逐步做内容运营、后台审核和 UI 细节优化。
- 已完成基础条件：`campusgrow.top` 已部署到服务器，`/api/health` 返回 `postgres`、`s3`、`WECHAT_LOGIN_MODE=real`、`paymentsEnabled=false`。
- 当前关键结论：2026-07-07 真机预览出现默认蓝色链接和原生输入框，不是设计稿没套上，而是微信真机 `web-view` 对生产 CSS 的加载/解析兼容出现问题。

## 2026-07-07 更新

### 本次处理的问题

- 用户真机预览截图显示 H5 页面退回默认浏览器样式：导航链接为默认蓝色、输入框为原生边框、页面布局未生效。
- 判断该问题优先级高于继续 UI 美化，因为这是完整 CSS 未生效或被旧版 web-view 内核忽略导致的基础渲染故障。

### 修改内容

- 修改 `frontend/vite.config.ts`：
  - 新增 `wechat-webview-html-compat` 构建插件。
  - 生产 HTML 中移除同源 JS/CSS 标签上的 `crossorigin`，降低微信 web-view 兼容风险。
  - 样式链接追加构建版本参数，例如 `/assets/index-RTCbqwP2.css?v=20260707032000`，绕开微信和 Nginx 静态资源的旧缓存。
  - 生产 CSS 中展开 Tailwind v4 生成的 CSS cascade `@layer` 外壳，保留内部规则，兼容不支持 `@layer` 的旧 web-view 内核。
- 修改 `frontend/index.html`：
  - 增加极简首屏兜底样式，使用传统 CSS 语法，避免主 CSS 短暂失败时直接露出默认蓝链接和原生表单。

### 验证结果

- 本地验证通过：
  - `npm.cmd run build:frontend`
  - `npm.cmd run typecheck:frontend`
  - `npm.cmd run lint`
- 构建产物确认：
  - `frontend/dist/index.html` 无 `crossorigin`。
  - CSS 链接已带 `?v=20260707032000`。
  - `frontend/dist/assets/index-RTCbqwP2.css` 中未检出 `@layer`。
- 线上部署：
  - 新版本 `20260707112105` 已发布到服务器。
  - `https://campusgrow.top/api/health` 返回正常，当前 release 路径为 `/opt/campus-growth/releases/20260707112105`。
  - `https://campusgrow.top/assets/index-RTCbqwP2.css?v=20260707032000` 返回 200，`Content-Type: text/css`。
- 浏览器移动端验收：
  - 使用 Playwright MCP 以 390 宽度检查 `https://campusgrow.top/`、`/resources`、`/profile`。
  - 截图文件：
    - `output/playwright/wechat-css-fix-home-mobile-390-20260707.png`
    - `output/playwright/wechat-css-fix-resources-mobile-390-20260707.png`
    - `output/playwright/wechat-css-fix-profile-mobile-390-20260707.png`
  - 三页均恢复为正常卡片、底部导航、按钮和输入框样式。

### 微信开发者工具状态

- 微信开发者工具 CLI 已登录，端口 `63746`。
- 小程序壳项目：`D:\github\zhejiang-competiton\wechat-shell`。
- AppID：`wxda8641cd650537a4`。
- 已生成新的真机预览二维码：
  - `output/wechat-devtools/preview-qr-20260707112105.png`
  - `output/wechat-devtools/preview-info-20260707112105.json`
- 预览包体积：`2561` bytes。

### 决策和注意事项

- 暂不执行微信小程序 `upload`。必须等用户重新扫码确认真机 web-view 样式恢复后再上传，避免把坏样式提交到小程序后台。
- 如果真机仍显示默认样式，下一步继续检查：
  - 微信 web-view 是否缓存旧 HTML。
  - 是否需要在小程序壳 `webUrl` 增加 H5 版本参数。
  - 是否还有 `oklch()`、`color-mix()`、`@property` 等旧内核不支持的 CSS 特性影响颜色或阴影。
- 当前仓库工作树包含大量历史未跟踪文件和截图产物，后续操作不要随意清理或重置。

### 下一步

1. 用户用新二维码真机预览，确认首页、资源、我的页面样式是否恢复。
2. 真机通过后执行微信开发者工具上传命令，版本建议使用 `0.1.0-beta.20260707`。
3. 上传后进入微信公众平台提交体验版/审核前，继续做真实功能冒烟：登录、浏览、收藏、免费资源获取、发帖、组队申请、举报、后台审核。
4. 若真机仍异常，优先修复 web-view CSS 兼容，不继续做视觉细节优化。

## 2026-07-07 滚动问题修复

### 本次处理的问题

- 用户真机反馈：首次登录资料补全页无法上下滑动，底部内容和按钮访问困难。
- 截图表现：表单高度超过手机视口，但页面被固定容器和弹层结构锁住，触摸滚动没有传递到正确容器。

### 修改内容

- 修改 `frontend/src/app/components/Layout.tsx`：
  - 用户端主布局从 `h-[100dvh] + overflow-hidden + 内部 overflow-y-auto` 改为页面级滚动。
  - 保留 `max-w-[430px]` 的小程序视觉宽度，但不再把业务内容锁在内部滚动容器里。
- 修改 `frontend/src/app/components/BottomNav.tsx`：
  - 底部导航改为固定定位，并加入安全区底部 padding。
  - 导航增加 `aria-label="主导航"`，方便自动化和辅助访问检查。
- 修改 `frontend/src/app/components/FloatingAI.tsx`：
  - 浮动入口改为固定定位，避免依赖旧的内部滚动容器。
- 修改 `frontend/src/app/components/profile/ProfileCompletionGate.tsx`：
  - 资料补全弹层从绝对定位改为固定定位。
  - 弹层自身增加 `overflow-y-auto` 和上下安全区 padding，长表单可以独立滚动。
- 修改 `frontend/src/app/components/admin/AdminLayout.tsx`：
  - 管理后台移动端顶部横向导航隐藏原生滚动条，避免出现明显灰色横条。

### 验证结果

- 本地验证通过：
  - `npm.cmd run typecheck:frontend`
  - `npm.cmd run build:frontend`
  - `npm.cmd run lint`
- 线上部署：
  - 最终版本 `20260707115334` 已发布。
  - `https://campusgrow.top/api/health` 正常，返回 `postgres`、`s3`、`real`、`paymentsEnabled=false`。
  - 线上 HTML 已指向 `index-DgMpdlUn.js` 和 `index-BKjbUL2U.css?v=20260707035258`。
- Playwright 移动端滚动巡检：
  - 视口：`390x844`。
  - 完整检查页面：`/`、`/competitions`、`/competitions/wl_mcm`、`/resources`、`/resources/official_resource_wl_mcm`、`/community`、`/posts/official_post_schedule_check`、`/teams`、`/profile`、`/search`、`/messages`、`/favorites`、`/my-resources`、`/publish-post`、`/publish-team`、`/resource-submissions`、`/history`、`/account-settings`、`/support`、`/ai`、`/admin/login`，以及模拟未补全资料登录态的资料补全弹层。
  - 结果：`failures: []`，控制台错误 `0`。
  - 最终轻量复验：首页、竞赛、资源、社区、管理后台、资料补全弹层均通过滚动检查，无横向溢出。
- 截图证据：
  - `output/playwright/scroll-audit-20260707/home-mobile.png`
  - `output/playwright/scroll-audit-20260707/competitions-mobile.png`
  - `output/playwright/scroll-audit-20260707/resources-mobile.png`
  - `output/playwright/scroll-audit-20260707/admin-mobile.png`
  - `output/playwright/scroll-audit-20260707/profile-gate-after-scroll.png`
  - `output/playwright/scroll-audit-20260707/console-errors.md`

### 微信预览

- 已生成新预览二维码：
  - `output/wechat-devtools/preview-qr-20260707115334.png`
  - `output/wechat-devtools/preview-info-20260707115334.json`
- 预览包体积：`2561` bytes。

### 下一步

1. 用户用新二维码真机确认资料补全弹层、首页、竞赛、资源、社区和后台是否能正常上下滑动。
2. 真机通过后再执行微信开发者工具 `upload`，不要提前上传。
3. 如果真机仍有某个页面无法滑动，优先记录具体页面和截图，按该页面的固定定位、弹层、输入框聚焦状态继续排查。

## 2026-07-07 固定操作区和管理端批量审核

### 本次处理的问题

- 用户反馈真机预览二维码已过期，需要重新生成。
- 用户希望上下滑动时像校园社区类小程序一样，有一部分顶部操作区固定，而不是整页一起滑走。
- 用户希望管理端审批效率更高，支持一键全部通过、多选批量通过，减少纯手动逐条处理。

### 设计判断

- 用户端不恢复旧的内部滚动容器，避免再次引入 web-view 滚动失效。
- 对竞赛、资源、社区三个信息流页采用更确定的 `fixed` 顶部区域：
  - 第一层：页面标题和简短说明固定。
  - 第二层：搜索、分类、筛选或频道固定。
  - 内容列表从固定区下方开始滚动。
- 详情页、发布页和资料补全弹层不强行固定顶部筛选，保留自然滚动。

### 修改内容

- 修改 `frontend/src/app/components/PageHeader.tsx`：
  - 新增 `fixed` 模式，用于信息流页固定顶部标题。
- 修改 `frontend/src/app/pages/Competitions.tsx`：
  - 顶部标题固定。
  - 搜索框、级别筛选、排序筛选合并为固定操作区。
  - 列表内容增加顶部留白，滚动时固定区不被卷走。
- 修改 `frontend/src/app/pages/Resources.tsx`：
  - 顶部标题固定。
  - 搜索、分类、投稿、我的投稿入口固定。
- 修改 `frontend/src/app/pages/Community.tsx`：
  - 顶部标题和发帖入口固定。
  - 内容分类频道固定。
- 修改 `frontend/src/app/pages/admin/AdminModeration.tsx`：
  - 增加审核任务多选。
  - 增加“全选待审”“批量通过”“批量驳回”“一键通过本页”。
  - 批量操作使用现有真实审核接口逐条执行，执行后刷新队列。
- 修改 `frontend/src/app/pages/admin/AdminResources.tsx`：
  - 资源审核页同步增加多选、批量通过、批量驳回、一键通过本页。

### 验证结果

- 本地验证通过：
  - `npm.cmd run typecheck:frontend`
  - `npm.cmd run build:frontend`
  - `npm.cmd run lint`
- 线上部署：
  - 最终版本 `20260707142226` 已发布。
  - `https://campusgrow.top/api/health` 正常，返回 `postgres`、`s3`、`real`、`paymentsEnabled=false`。
  - 线上 HTML 已指向 `index-tgpd4mkL.js` 和 `index-BJehqXVy.css?v=20260707062149`。
- Playwright 验证：
  - 竞赛、资源、社区三页滚动后固定栏仍停留在顶部，固定区域坐标保持 `top 0` 和 `top 90`。
  - 竞赛、资源、社区均无横向溢出。
  - 管理端审核页存在“全选待审”“批量通过”“一键通过本页”。
  - 管理端资源页存在“全选待审”“批量通过”“一键通过本页”。
  - 控制台错误为空。
- 截图证据：
  - `output/playwright/fixed-admin-batch-20260707/competitions-fixed-scrolled-final.png`
  - `output/playwright/fixed-admin-batch-20260707/resources-fixed-scrolled-final.png`
  - `output/playwright/fixed-admin-batch-20260707/community-fixed-scrolled-final.png`
  - `output/playwright/fixed-admin-batch-20260707/admin-moderation-batch-final.png`
  - `output/playwright/fixed-admin-batch-20260707/admin-resources-batch-final.png`

### 微信预览

- 已生成新预览二维码：
  - `output/wechat-devtools/preview-qr-20260707142226.png`
  - `output/wechat-devtools/preview-info-20260707142226.json`
- 预览包体积：`2561` bytes。

### 下一步

1. 用户尽快扫码真机预览，二维码会过期。
2. 真机重点检查：竞赛/资源/社区滚动时顶部固定区是否符合预期；管理端审核台和资源审核页批量操作是否清楚。
3. 真机通过后再上传小程序版本。
4. 后续如果管理端批量量级继续变大，再补服务端批量审核事务接口，减少前端逐条请求。

## 2026-07-07 微信真机横向滑动与跳转回顶修复

### 本次处理的问题

- 用户真机反馈：小程序 web-view 页面在宽度方向可以左右滑动，不符合微信手机小程序体验。
- 用户真机反馈：切换到新页面后没有自动显示顶部，需要手动上滑回到顶部。
- 用户真机反馈：顶部固定区域仍有一部分跟随页面滑动，底部菜单也必须稳定固定。

### 根因判断

- `PageHeader`、`BottomNav`、竞赛/资源/社区固定筛选区使用了 `left-1/2 + -translate-x-1/2 + w-full`。浏览器视觉上居中，但微信 web-view 可能把未 transform 前的布局盒子计入横向可滚动范围。
- 竞赛、资源、社区、消息页的分类条使用横向滚动，在真机手势上容易被用户感知为页面可以左右滑。
- React Router 路由切换后没有统一滚动复位，旧页面的滚动位置会带到新页面。

### 修改内容

- 修改 `frontend/src/styles/index.css`：
  - `html`、`body`、`#root` 增加 `width: 100%`、`max-width: 100%`、`overflow-x: hidden`。
  - 增加 `overscroll-behavior-x: none`，减少横向回弹。
  - 全局补充 `box-sizing: border-box`。
- 修改 `frontend/src/app/components/Layout.tsx`：
  - 根据 `location.pathname` 和 `location.search` 变化执行 `window.scrollTo(0, 0)`。
  - 同步重置 `documentElement` 和 `body` 的 `scrollTop`，兼容微信 web-view。
  - 主容器增加 `w-full max-w-full overflow-x-hidden`。
- 修改 `frontend/src/app/components/admin/AdminLayout.tsx`：
  - 管理后台路由切换也执行顶部复位。
- 修改 `frontend/src/app/components/PageHeader.tsx`：
  - 固定模式改为 `fixed inset-x-0 mx-auto w-full max-w-[430px]`，移除 transform 居中。
- 修改 `frontend/src/app/components/BottomNav.tsx`：
  - 底部导航同样改为 `fixed inset-x-0 mx-auto w-full max-w-[430px]`。
- 修改 `frontend/src/app/pages/Competitions.tsx`、`Resources.tsx`、`Community.tsx`：
  - 固定筛选区移除 transform 居中。
  - 筛选按钮从横向滚动改为自动换行。
  - 竞赛、资源列表顶部留白增大，避免首条内容被固定筛选区遮挡。
- 修改 `frontend/src/app/pages/Messages.tsx`：
  - 消息分类条从横向滚动改为自动换行。

### 本地验证

- 静态检查通过：
  - `npm.cmd run typecheck:frontend`
  - `npm.cmd run build:frontend`
  - `npm.cmd run lint`
- 本地 Playwright 390x844 验证：
  - 覆盖 `/`、`/competitions`、`/resources`、`/community`、`/messages`、`/admin/login`。
  - 竞赛、资源、社区滚动后固定标题、筛选区和底部导航仍保持固定。
  - 首页滚动后点击底部“资源”，新页面 `scrollY=0`。
  - 结果：`failures: []`。
- 本地 Playwright 414x896 验证：
  - 覆盖 `/`、`/competitions`、`/resources`、`/community`。
  - 结果：`failures: []`。

### 线上部署

- 生成并上传 release 包：
  - `.deploy/campus-growth-20260707151502.tar.gz`
- 首次精简包没有包含 `frontend/src/data/mock.ts`，导致服务启动时报错：
  - `Cannot find module '/opt/campus-growth/releases/20260707151502/frontend/src/data/mock.ts' imported from server/db.ts`
- 处理方式：
  - 重新打包同一 release，补齐 `frontend/src`。
  - 排除本地日志、本地 SQLite DB 和本地临时存储文件。
  - 因 `/opt/campus-growth/current` 已指向同一 release，直接覆盖解压该 release 并重启服务。
- 最终线上状态：
  - `/opt/campus-growth/current -> /opt/campus-growth/releases/20260707151502`
  - `https://campusgrow.top/api/health` 返回正常。
  - 返回内容包含 `databaseProvider=postgres`、`storageProvider=s3`、`wechatLoginMode=real`、`paymentsEnabled=false`。
  - 线上 HTML 指向 `index-DzoLi6K3.js` 和 `index-dDKqHPl_.css?v=20260707070839`。

### 线上 Playwright 验证

- 线上 390x844：
  - 覆盖 `/`、`/competitions`、`/resources`、`/community`、`/profile`。
  - 滚动后固定栏不越界，页面没有横向溢出。
  - 首页滚动后点击底部“资源”，新页面 `scrollY=0`。
  - 结果：`failures: []`。
- 线上 414x896：
  - 同样覆盖核心入口，结果：`failures: []`。
- 截图证据：
  - `output/playwright/wechat-layout-fix-20260707/production-home-mobile-final.png`
  - `output/playwright/wechat-layout-fix-20260707/production-competitions-scrolled-final.png`
  - `output/playwright/wechat-layout-fix-20260707/production-resources-scrolled-final.png`
  - `output/playwright/wechat-layout-fix-20260707/production-community-scrolled-final.png`

### 微信预览

- 微信开发者工具 CLI 仍可用：
  - 路径：`D:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat`
  - 端口：`63746`
  - `islogin` 返回 `{"login":true}`
- 已重新生成真机预览二维码：
  - `output/wechat-devtools/preview-qr-20260707151502.png`
  - `output/wechat-devtools/preview-info-20260707151502.json`
- 预览包体积：`2561` bytes。

### 下一步

1. 用户用新二维码真机预览，重点检查：是否还能左右滑动；竞赛/资源/社区顶部固定区是否稳定；底部菜单是否始终固定；切换底部 tab 后是否自动到顶部。
2. 若真机确认通过，再执行微信开发者工具 `upload`，不要在真机确认前上传。
3. 后续应把后端对 `frontend/src/data/mock.ts` 的运行时依赖从 `server/db.ts` 中拆掉，避免生产包必须携带前端源文件。

## 2026-07-07 16:05 用户端文案与“AI 感”收敛

### 本次目标

- 根据真机截图，删除主入口里“社区广场 / 校园成长 / 竞赛 / 资源”等说明式大标题和副标题。
- 继续检查用户端是否还有开发态、内部态、审核态或“AI 生成感”文案。
- 保持移动端小程序宽度，不允许横向滑动；底部导航和主列表筛选区保持固定；路由切换自动回到顶部。

### 修改内容

- 已确认并保留上一轮对主 tab 页面标题的删除：
  - `frontend/src/app/pages/Home.tsx`
  - `frontend/src/app/pages/Competitions.tsx`
  - `frontend/src/app/pages/Resources.tsx`
  - `frontend/src/app/pages/Community.tsx`
- 继续收敛本轮发现的文案：
  - `frontend/src/app/lib/home-config.ts`
    - 首页默认 banner 从长句压缩为 `竞赛、资料、队友`、`近期报名赛事。`、`找队友，开项目。`
  - `server/catalog-service.ts`
    - 同步压缩服务端默认首页 banner，避免无运营配置时回退到长文案。
  - `frontend/src/app/pages/ResourceDetail.tsx`
    - 将“官方来源索引”说明卡压缩为一行：`官方来源 / 以官网为准`。
  - `frontend/src/app/pages/Profile.tsx`
    - 未登录个人页从两张说明卡合并为一张操作卡，删除“登录后开启个人主页”等重复说明。
  - `frontend/src/app/components/ResourceCard.tsx`
    - 将资源列表中的 `来源索引` 展示改为 `官网入口`。
  - `frontend/src/app/lib/format.ts`
    - 增加展示层兜底替换：`官方索引 -> 官方入口`、`来源索引 -> 官网入口`、`公开来源整理 -> 公开资料`。
  - `scripts/sync-beta-content.ts`
    - 修改同步脚本源头文案，避免未来内容同步重新写入 `官方索引`、`公开来源整理`。
  - `scripts/approve-beta-content.ts`
    - 将后台审核备注里的“官方来源索引”改成“官方来源”。
  - `server/index.ts`
    - 官方来源类资源的获取错误改为 `该内容来自官网，请打开原文查看。`

### 本地验证

- 静态检查通过：
  - `npm.cmd run typecheck:frontend`
  - `npm.cmd run lint`
  - `npm.cmd run build:frontend`
- 最终前端构建产物：
  - `frontend/dist/assets/index-CJ9nuVRv.js`
  - `frontend/dist/assets/index-BTJww7fY.css`
- 本地 production preview 390x844 检查：
  - 覆盖 `/`、`/competitions`、`/resources`、`/community`、`/profile`。
  - `scrollWidth <= innerWidth`，无横向溢出。
  - 底部导航为 fixed。
  - 禁用文案未出现。
- 本地截图：
  - `output/playwright/ui-copy-cleanup-20260707-local/home-390-final.png`

### 线上部署

- 生成并上传最终 release 包：
  - `.deploy/campus-growth-20260707160312.tar.gz`
- 服务器切换结果：
  - `/opt/campus-growth/current -> /opt/campus-growth/releases/20260707160312`
  - `systemctl` 返回 `active`
  - `https://campusgrow.top/api/health` 正常。
- 健康检查关键字段：
  - `databaseProvider=postgres`
  - `storageProvider=s3`
  - `wechatLoginMode=real`
  - `paymentsEnabled=false`

### 线上 Playwright 验证

- 线上 390x844 覆盖：
  - `/`
  - `/competitions`
  - `/resources`
  - `/community`
  - `/profile`
  - `/resources/official_resource_wl_mcm`
- 验证结果：
  - 禁用词为空：未出现 `社区广场`、`适合人群`、`资源亮点`、`内测`、`演示链路`、`来源索引`、`官方索引` 等。
  - 主入口页不再展示截图里那类大标题和副标题。
  - `scrollX=0`，`maxScrollWidth` 未超过视口宽度。
  - 首页、竞赛、资源、社区、我的底部导航 fixed。
  - 竞赛、资源、社区顶部筛选区 fixed。
  - 从竞赛页滚动到 `scrollY=620` 后切换“资源”，新页面 `scrollY=0`；再切“社区”，`scrollY=0`。
- 线上截图证据：
  - `output/playwright/ui-copy-cleanup-20260707-production-final/home-390.png`
  - `output/playwright/ui-copy-cleanup-20260707-production-final/resources-390.png`
  - `output/playwright/ui-copy-cleanup-20260707-production-final/community-390.png`
  - `output/playwright/ui-copy-cleanup-20260707-production-final/profile-390.png`
  - `output/playwright/ui-copy-cleanup-20260707-production-final/resources-official_resource_wl_mcm-390.png`

### 当前结论

- 用户端主要“AI 感”来源已经收敛：说明式页头、彩色装饰图标、内部词和长解释文案已减少。
- 已生成新的微信开发者工具真机预览二维码：
  - `output/wechat-devtools/preview-qr-20260707160312.png`
  - `output/wechat-devtools/preview-info-20260707160312.json`
- 当前线上可继续做真机小程序预览；若真机确认无横向滑动和固定层异常，再进入微信上传。
- 后续如果继续优化，建议优先处理真实数据质量和管理后台批量审核效率，不要再增加装饰型卡片和说明文案。

## 2026-07-07 16:35 滚动记忆、组队大厅与社区交互优化

### 本次目标

- 用户从列表进入详情后点击返回，应回到原列表位置，并保留筛选和搜索状态。
- 新打开或主动切换到未访问页面时，仍应从顶部展示。
- 组队大厅升级为底部主入口，和竞赛、资源一样作为主页面。
- 组队详情改成公开招募帖模式：队长发布正文和联系方式，平台不做站内私聊。
- 社区增加搜索框，发帖改为右下悬浮加号。
- 详情页恢复“适合人群”文字标题，但不恢复彩色装饰图标。
- 继续检查微信手机宽度下不能横向滑动。

### 修改内容

- `frontend/src/app/components/Layout.tsx`
  - 新增滚动位置记忆。
  - 同时按 `location.key` 和完整 URL 保存滚动位置。
  - 点击链接和浏览器返回前先捕获保存滚动。
  - 返回 `POP` 时恢复旧位置；新页面 `PUSH/REPLACE` 时置顶。
- `frontend/src/app/components/BottomNav.tsx`
  - 底部导航从 `首页 / 竞赛 / 资源 / 社区 / 我的` 改为 `首页 / 竞赛 / 资源 / 组队 / 我的`。
  - 保持 5 个主入口，符合小程序 tab 数量习惯。
- `frontend/src/app/pages/Competitions.tsx`
  - 搜索、级别、排序写入 URL，返回详情后保留筛选状态。
  - 修正固定筛选区对应的顶部留白。
- `frontend/src/app/pages/Resources.tsx`
  - 搜索和分类写入 URL，返回详情后保留筛选状态。
- `frontend/src/app/pages/Community.tsx`
  - 增加搜索框。
  - 分类和关键词写入 URL。
  - 发帖入口改为右下角悬浮加号。
  - 修正固定筛选区对应的顶部留白。
- `frontend/src/types/api.ts`、`server/community-service.ts`
  - `PostQuery` 新增 `keyword`。
  - 后端帖子列表支持按标题、摘要、正文和标签搜索。
- `frontend/src/app/pages/Teams.tsx`
  - 改为主 tab 页面，不再显示返回头。
  - 增加固定搜索区、`全部 / 我的发布` 筛选和右下悬浮发布按钮。
- `frontend/src/app/components/TeamCard.tsx`
  - 列表卡片增加 `查看联系方式` 提示。
- `frontend/src/app/pages/TeamDetail.tsx`
  - 重写为公开招募详情：展示标题、竞赛、缺口角色、正文、发起人、联系方式。
  - 主操作改为复制联系方式 / 联系队长。
  - 删除普通用户主路径中的申请加入表单。
  - 增加说明：平台只展示公开招募信息，不提供站内私聊。
- `frontend/src/app/pages/PublishTeam.tsx`
  - 发布页改成招募帖模型：标题、关联竞赛、招募角色、一整段招募正文、联系方式、截止日期。
  - 提交后仍进入后台审核，审核通过后公开展示。
- `frontend/src/app/pages/CompetitionDetail.tsx`、`frontend/src/app/pages/ResourceDetail.tsx`
  - 恢复 `适合人群` 文字标题。
  - 竞赛详情同时恢复 `行动建议` 文字标题。
  - 不恢复任何彩色装饰图标。
- `frontend/src/styles/index.css`
  - 全局增加 `overflow-wrap: anywhere`。
  - 图片、SVG、视频、Canvas 设置 `max-width: 100%`，降低子页面横向溢出风险。

### 本地验证

- 静态检查通过：
  - `npm.cmd run typecheck:frontend`
  - `npm.cmd run lint`
  - `npm.cmd run build:frontend`
- 最终构建产物：
  - `frontend/dist/assets/index-CgFGd7HS.js`
  - `frontend/dist/assets/index-Bu9dV5Ks.css`

### 线上部署

- 最终 release：
  - `.deploy/campus-growth-20260707163404.tar.gz`
  - `/opt/campus-growth/current -> /opt/campus-growth/releases/20260707163404`
- 健康检查：
  - `databaseProvider=postgres`
  - `storageProvider=s3`
  - `wechatLoginMode=real`
  - `paymentsEnabled=false`

### 线上 Playwright 验证

- 390x844 覆盖页面：
  - `/competitions`
  - `/resources`
  - `/teams`
  - `/community`
  - `/competitions/wl_mcm`
  - `/resources/official_resource_wl_mcm`
- 结果：
  - 上述页面 `scrollX=0`，无横向溢出。
  - 底部导航固定，并显示 `首页 / 竞赛 / 资源 / 组队 / 我的`。
  - 社区搜索框可见，发帖按钮为右下悬浮加号。
  - 组队大厅可见，当前线上真实数据为空，显示空状态和悬浮发布按钮。
  - 竞赛和资源详情均显示 `适合人群`。
- 返回滚动专项：
  - 打开 `/competitions?keyword=数学`，滚动到 `scrollY=96`。
  - 点击进入 `/competitions/wl_mcm`，详情页从顶部展示。
  - 浏览器返回后回到 `/competitions?keyword=数学`，`scrollY=96`，关键词仍为 `数学`。
  - 再主动切换到 `/resources`，新页面 `scrollY=0`。
- 截图证据：
  - `output/playwright/wechat-ux-fixes-20260707-final/competitions-final-390.png`
  - `output/playwright/wechat-ux-fixes-20260707-final/community-final-390.png`
  - `output/playwright/wechat-ux-fixes-20260707-final/teams-final-390.png`
  - `output/playwright/wechat-ux-fixes-20260707-final/competitions-wl_mcm-390.png`
  - `output/playwright/wechat-ux-fixes-20260707-final/resources-official_resource_wl_mcm-390.png`

### 当前注意事项

- 线上 `/api/teams` 当前返回空数组，说明没有已审核公开组队内容；前端入口和发布流程已准备好，需要真实用户发布或管理员导入/审核后才会展示。
- 社区仍保留页面和搜索能力，但底部主导航优先给组队；社区仍可从首页 `看攻略` 进入。
- 已生成最终版微信真机预览二维码：
  - `output/wechat-devtools/preview-qr-20260707163404.png`
  - `output/wechat-devtools/preview-info-20260707163404.json`

## 2026-07-07 17:17 组队发布页真机排版与返回滚动修复

### 本次问题

- 用户真机截图显示 `发布组队` 页中 `仅限本校成员` 被挤到右侧竖排，说明 checkbox 行在微信 WebView 下存在横向撑宽风险。
- 用户反馈从列表进入详情再返回后，列表仍回到顶部；之前仅用浏览器内存 Map 记录滚动位置，对微信 `web-view` 场景不够稳。

### 代码改动

- `frontend/src/app/pages/PublishTeam.tsx`
  - 发布组队表单改为更紧凑的白底低圆角布局。
  - 缩短 placeholder 文案，减少输入框内长句。
  - checkbox 改为自绘 20px 方框，原生 input 用 `absolute h-px w-px opacity-0` 隐藏，避免参与布局导致中文竖排。
  - 原大块提示卡改为一行轻提示：仅公开展示，不提供站内私聊，勿填写敏感信息。
- `frontend/src/app/components/ui.tsx`
  - 通用输入框增加 `block min-w-0 max-w-full appearance-none placeholder:text-slate-400`，降低表单横向溢出风险。
- `frontend/src/styles/index.css`
  - 表单控件和按钮统一 `max-width: 100%`。
  - `body` 增加 `touch-action: pan-y`，降低横向手势误触。
  - `textarea` 增加 `overflow-wrap: break-word`。
- `frontend/src/app/components/Layout.tsx`
  - 滚动恢复从单纯内存 Map 升级为三层记录：
    - 当前历史条目 `history.state.__campusScroll`
    - 内存 Map
    - `sessionStorage` 短期备份
  - 返回时仅在 `POP` 导航中恢复原列表位置；主动进入新页面仍滚动到顶部。
  - 恢复动作延长到 2600ms，并监听 body resize，避免列表数据异步渲染慢时恢复失败。
  - 点击普通链接、`pagehide`、页面隐藏时主动保存当前滚动位置。

### 本地验证

- `npm.cmd run typecheck:frontend` 通过。
- `npm.cmd run lint` 通过。
- `npm.cmd run build:frontend` 通过。
- 本地启动 API：`http://127.0.0.1:8080/api`。
- 本地启动前端：`http://127.0.0.1:3011`。
- Playwright 390x844：
  - `发布组队` 页无横向溢出，checkbox 不再撑宽。
  - 竞赛列表滚动到 `scrollY=1420`，进入 `/competitions/wl_nuedc` 后详情页 `scrollY=0`。
  - 浏览器返回后 `/competitions` 恢复到 `scrollY=1420`。
  - 再次进入详情，点击应用内左上返回，仍恢复到 `scrollY=1420`。
  - 主动切换到 `/resources` 后 `scrollY=0`，说明新页面不继承旧滚动。
- Playwright 414x896：
  - `发布组队` 页无横向溢出。
- 截图证据：
  - `wechat-publish-team-fixed-390.png`
  - `wechat-publish-team-fixed-414.png`

### 线上部署

- 构建产物：
  - `frontend/dist/assets/index-CzPTbud3.js`
  - `frontend/dist/assets/index-DRYvQY7x.css`
- 发布包：
  - `.deploy/campus-growth-20260707171401.tar.gz`
- 服务器 release：
  - `/opt/campus-growth/releases/20260707171401`
  - `/opt/campus-growth/current -> /opt/campus-growth/releases/20260707171401`
- 线上健康检查：
  - `databaseProvider=postgres`
  - `storageProvider=s3`
  - `wechatLoginMode=real`
  - `paymentsEnabled=false`
- 线上 HTML 已引用新资源：
  - `/assets/index-CzPTbud3.js`
  - `/assets/index-DRYvQY7x.css?v=20260707091255`
- 线上 Playwright 390x844：
  - `/competitions` 宽度无溢出。
  - 进入 `/competitions/wl_nuedc` 后详情页 `scrollY=0`。
  - 返回 `/competitions` 恢复到 `scrollY=1420`。

### 微信预览

- 使用微信开发者工具 CLI 重新生成真机预览二维码：
  - `output/wechat-devtools/preview-qr-20260707171401.png`
  - `output/wechat-devtools/preview-info-20260707171401.json`
- 小程序壳仍指向 `https://campusgrow.top`，因此扫码后应加载本次已部署的线上修复。

### 下一步

- 请用最新二维码真机复测：
  - 发布组队页 checkbox 行是否仍有竖排或横向拖动。
  - 从竞赛/资源/组队列表进入详情，再点应用内返回，列表是否保持原位置。
  - 底部导航切换到新页面时是否从顶部开始。
- 若真机仍有某个页面返回失效，需要记录具体路径、点击的入口和返回方式；目前浏览器历史返回与应用内返回均已通过。

## 2026-07-07 21:25 登录引导与学校选择前三项改造

### 本次目标

- 先完成登录/入站体验前三项：
  1. 移除首次登录强制补全年级、专业、简介、关注方向的完整资料表单。
  2. 改成公告 + 昵称 + 系统头像预览的轻量引导。
  3. 增加参考朵朵校友圈结构的学校选择页。
- 当前阶段先用 `users.school` 保存学校名称；后续再拆 `school_id`、学校管理员和平台总后台。

### 代码改动

- 后端：
  - `server/catalog-service.ts`
    - 新增 `updateCurrentUserIdentity`，只更新昵称、头像和 `mark`。
    - 新增 `selectCurrentUserSchool`，只更新学校。
  - `server/index.ts`
    - 新增 `PATCH /api/users/me/identity`。
    - 新增 `PATCH /api/users/me/school`。
    - 新增 `user_identity_required`、`user_school_required` 错误映射。
  - `server/payment-service.ts`
    - 补齐 `avatar_url` 查询字段，避免新增头像字段后 `UserRow` 不完整。
- 前端：
  - `frontend/src/app/components/Layout.tsx`
    - 停用完整资料强制弹层，改为轻量 `OnboardingGate`。
  - `frontend/src/app/components/onboarding/OnboardingGate.tsx`
    - 新增公告、昵称设置、学校选择入口三段引导。
  - `frontend/src/app/pages/SchoolSelect.tsx`
    - 新增学校选择页：搜索、热门院校、当前选择、已开通院校列表。
  - `frontend/src/app/lib/schools.ts`
    - 新增首批已开通学校列表。
  - `frontend/src/app/lib/avatar.ts`
    - 新增系统头像文字兜底。
  - `frontend/src/app/pages/Profile.tsx`
    - 个人页头像改用用户头像/系统头像。
    - 增加“切换学校”入口。
    - 删除“资料状态”用户可见卡片。
  - `frontend/src/styles/index.css`
    - 增加局部按钮 reset class，避免 `index.html` 兜底按钮蓝底压过学校页和返回按钮样式。

### 设计与产品决策

- H5 在微信 `web-view` 里无法直接使用小程序原生 `chooseAvatar` 能力；本轮不伪造“已获取微信头像”，先用系统头像预览和昵称输入。
- 后续如果要使用微信头像/昵称，需要把 `wechat-shell` 扩成原生登录资料页，再把头像昵称通过参数或接口传给 H5。
- 学校选择目前是“选择学校”，不是“学校认证”。学校认证后续应单独做教育邮箱验证码 + 手机验证码，并引入学校维度的数据隔离。
- 后续多学校运营模型：
  - 平台总后台负责学校开通、全局配置、平台风控和超级管理员。
  - 学校后台负责本校内容运营、帖子/组队/资源审核、举报处理。
  - 同校用户只能看到同校帖子、组队、学校运营内容；全国竞赛/公开资源可按学校推荐但不应被硬切断。

### 本地验证

- 静态检查通过：
  - `npm.cmd run typecheck:frontend`
  - `npm.cmd run lint`
  - `npm.cmd run build:frontend`
- 本地 API：
  - `http://127.0.0.1:8080/api/health` 返回正常，测试库为 `server/data/campus-growth-local-onboarding.db`。
- Playwright 390x844、414x896 完整流转：
  - 新用户登录态注入。
  - 公告显示并点击进入。
  - 昵称保存。
  - 跳转学校选择页。
  - 选择浙江大学。
  - 返回个人页显示浙江大学。
  - 检查无横向溢出、无控制台错误。
  - 检查未出现旧文案：`先补全资料`、`资料状态`、`学校、年级和关注方向会用于组队申请`、`完成后返回`。
- 本地截图证据：
  - `output/playwright/onboarding-school-20260707-final/announcement-390.png`
  - `output/playwright/onboarding-school-20260707-final/identity-390.png`
  - `output/playwright/onboarding-school-20260707-final/school-select-390.png`
  - `output/playwright/onboarding-school-20260707-final/profile-after-school-390.png`
  - 同目录包含 414 宽度截图和 `report.json`。

### 线上部署

- 发布 release：
  - `.deploy/campus-growth-20260707212456.tar.gz`
  - `/opt/campus-growth/current -> /opt/campus-growth/releases/20260707212456`
- 线上健康检查：
  - `https://campusgrow.top/api/health` 正常。
  - `databaseProvider=postgres`
  - `storageProvider=s3`
  - `wechatLoginMode=real`
  - `paymentsEnabled=false`
- 线上 HTML：
  - JS：`/assets/index-szxVRgci.js`
  - CSS：`/assets/index-DWq05HjP.css?v=20260707132321`
- 线上 390 宽度静态检查：
  - `https://campusgrow.top/schools`
  - 无横向溢出。
  - 返回按钮背景为透明，不再受兜底蓝底影响。
  - 截图：`output/playwright/onboarding-school-20260707-production/schools-unauth-390.png`

### 微信预览

- 微信开发者工具已登录。
- 已生成新真机预览二维码：
  - `output/wechat-devtools/preview-qr-20260707212456.png`
  - `output/wechat-devtools/preview-info-20260707212456.json`
- 预览包体积：`2561` bytes。

### 下一步

1. 用户扫码真机预览，重点检查首次进入后的公告、昵称设置、学校选择页、个人页学校显示。
2. 若真机通过，再考虑上传小程序体验版。
3. 下一阶段再做学校认证和多学校隔离：
   - 数据表增加 `schools`、`school_admins`、用户 `school_id`。
   - 内容表增加 `school_id` / `visibility_scope`。
   - 管理后台拆分平台总后台和学校后台权限。
   - 教育邮箱验证码、手机号验证码和认证状态流转。

## 2026-07-08 09:10 微信真机预览二维码重生成

### 本次操作

- 用户反馈上一版微信真机预览二维码已失效。
- 使用微信开发者工具 CLI 为 `D:\github\zhejiang-competiton\wechat-shell` 重新生成预览二维码。
- 微信开发者工具登录状态正常，AppID 仍为 `wxda8641cd650537a4`。

### 验证结果

- 线上 API 健康检查正常：
  - `https://campusgrow.top/api/health`
  - `databaseProvider=postgres`
  - `storageProvider=s3`
  - `wechatLoginMode=real`
  - `paymentsEnabled=false`
  - 当前 release：`/opt/campus-growth/releases/20260707212456/server/data/campus-growth.db`
- 新预览包体积：`2561` bytes。

### 新二维码文件

- `output/wechat-devtools/preview-qr-20260708091011.png`
- `output/wechat-devtools/preview-info-20260708091011.json`

### 下一步

- 用户尽快扫码真机预览，二维码会过期。
- 真机重点检查首次进入公告、昵称设置、学校选择页、个人页学校显示。
