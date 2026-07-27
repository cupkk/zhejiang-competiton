# 校园成长平台研究进展日志

## 总体研究进展

- 项目目标：面向全国高校学生提供按学校隔离的竞赛、资料、社区和组队服务，由平台管理员和学校管理员分级运营。
- 当前阶段：服务器已过期，本阶段只使用本地 SQLite、真实本地 API 和微信 mock 登录进行上线前体验打磨；未连接服务器、未部署、未上传微信版本。
- 本轮目标：逐页检查用户端、认证流程、发布页、个人中心和管理后台，修复响应式、触控、加载、错误、空状态、视觉层级及真实闭环问题。
- 当前结果：98 个“路由 × 身份 × 尺寸”组合最终异常为 0；用户发布、学校管理员审核、前台可见和举报处理闭环通过；发布检查和生产构建通过。
- 当前阻塞：本地功能无阻塞。正式上线仍需恢复生产服务器、接入真实邮件和短信服务，并在微信真机环境复核真实登录、网络域名和 web-view 行为。
- 下一步：体验确认后执行微信真机回归；生产环境恢复后重新验证 HTTPS、PostgreSQL、S3、微信真实登录和备份，不得直接复用已过期服务器结论。

## 2026-07-23 逐页体验审计

### 审计范围

- 新增审计脚本：`output/playwright/ux-audit-20260723/audit.js`。
- 覆盖 98 个组合：匿名用户、浙江大学已认证用户、未认证用户、组队发布者、平台管理员、学校管理员；视口包含 390x844、414x896 和 1440x900。
- 自动检查：页面及元素横向溢出、44px 触控目标、返回按钮、固定底部导航、残留加载态、错误状态、控制台异常和 4xx/5xx 请求。
- 最终结果：`routeCount=98`、`anomalyCount=0`。身份准备改为在同源静态校徽页读写存储，消除了 React 页面初始化造成的测试会话竞态。

### 用户端修复

- `frontend/src/app/pages/Search.tsx`：搜索结果 key 包含范围、内容 ID、标签和索引，消除重复 key 警告。
- `frontend/src/app/pages/SchoolSelect.tsx`、`SchoolVerify.tsx`、`Favorites.tsx`：操作按钮最小高度统一为 44px。
- `frontend/src/app/pages/Favorites.tsx`：全部收藏为空时只显示一个空状态；“全部”模式只展示有内容的分类；取消收藏按钮补足 44px。
- `frontend/src/app/pages/NotFound.tsx`、`routes.tsx`：无效链接使用明确的“页面不存在”和应用内返回，不再暴露技术错误文案。
- `server/catalog-service.ts`：已截止竞赛显示“报名已结束”，不再出现负数剩余天数。

### 校徽加载

- `server/school-service.ts` 新增按学校 ID 读取数据库校徽源的函数。
- `server/index.ts` 新增 `/api/schools/:id/logo` 同源代理，只允许数据库已有 URL、HTTPS 和 `static-data.gaokao.cn`，限制 PNG/JPEG/WebP、5 秒超时和 1MB 文件，并设置缓存及 `nosniff`。
- `frontend/src/app/components/SchoolLogo.tsx`：远程校徽走同源代理，本地 `/school-logos/` 文件继续直接加载。
- 真实样本验证：中国矿业大学 89,370 字节、天津音乐学院 613,714 字节，均返回 `200 image/png`；浏览器 CORS/PNA 错误消失。

### 管理后台修复

- `frontend/src/app/pages/admin/AdminResources.tsx`：学校管理员不再请求或显示平台首页资源配置，避免越权 403。
- `frontend/src/app/pages/admin/AdminHomeConfig.tsx`：轮播编辑器补齐 `min-w-0/max-w-full`，长图片地址不再撑开移动端网格；日期字段在手机端纵向排列，完整显示日期和时间。
- 390px 管理后台页面宽度保持 390px，轮播输入、图片地址和删除操作均可见；1440px 桌面布局保持原有双栏。

## 真实业务闭环

- 新增一次性界面流程：`output/playwright/ux-audit-20260723/flow.js`。
- 通过真实页面完成：列表滚动记忆、竞赛收藏、免费资源领取、发帖、结构化组队发布、帖子举报、学校管理员批量通过、举报确认成立、前台回查。
- 滚动记忆验证：从竞赛列表进入详情并点击应用内返回后，恢复到进入前位置，误差控制在 80px 内。
- 批量审核真实提示为“已处理 2 条。”；审核后的帖子和组队均可由浙江大学用户打开。
- 临时数据使用“闭环测试”唯一前缀；`cleanup-flow.ts` 精确删除临时帖子、组队、举报、审核任务、通知、领取和收藏。最终二次清理结果：帖子 0、组队 0、举报 0、任务 0。
- 证据截图：
  - `output/playwright/ux-audit-20260723/flow-team-approved.png`
  - `output/playwright/ux-audit-20260723/flow-admin-report-approved.png`
  - `output/playwright/ux-audit-20260723/verified-favorites-final-390x844.png`
  - `output/playwright/ux-audit-20260723/platform-admin-mobile-home-final-390x844.png`

## 性能与发布检查

- `frontend/src/app/routes.tsx`：管理端登录、布局和各后台页面改为 React Router 原生懒加载；增加无文字 `HydrateFallback`，后台初次直达无控制台警告。
- 用户主包从 539.08kB、gzip 149.34kB 降至 473.49kB、gzip 135.90kB；管理端拆分为 0.33kB 至 17.78kB 的独立页面包；大于 500kB 的构建警告消失。
- `npm run verify:local-release` 通过：根类型检查、前端类型检查、双学校与后台核心冒烟、前端生产构建全部成功。
- 路由拆分后再次执行 98 路由审计，结果仍为异常 0；新浏览器直达 `/admin/home` 返回 200，控制台 0 error、0 warning。

## 本地交接

- 前端预览：[http://127.0.0.1:3001/](http://127.0.0.1:3001/)
- API 健康检查：[http://127.0.0.1:8080/api/health](http://127.0.0.1:8080/api/health)
- 本地数据库：`server/data/campus-growth-local-preview.db`
- 当前模式：SQLite、local storage、mock 微信登录、支付关闭。
- 本地服务保持运行。多轮压测曾触发管理员登录内存限流，已通过重启 API 清空；接手时管理员账号可立即使用。
- 生产上线前必须重新执行真实微信登录和微信开发者工具真机回归；本日志中的通过结论只证明当前本地 H5/API 环境。

## 2026-07-23 登录页点击无反应修复

### 现象与原因

- 用户在本地 H5 打开 `/login?next=/resources/r1`，点击“微信一键登录”后看起来没有反应。
- 根因在 `frontend/src/app/lib/quick-login.ts`：普通浏览器加载微信 JSSDK 后也可能存在 `wx.miniProgram` 对象，旧逻辑据此误判为微信小程序 `web-view`，尝试调用小程序跳转后直接返回，没有进入本地 mock 登录。
- 错误提示原本出现在页面底部区域，视觉上也不明显。

### 修复内容

- `frontend/src/app/lib/quick-login.ts`
  - 本地 Vite 开发模式且没有 `wx.login` 时，直接使用稳定的 `local-browser-preview` code 调用本地 mock 登录，方便浏览器预览。
  - 生产环境不使用本地 mock 分支；只有通过 `wx.miniProgram.getEnv` 或 `__wxjs_environment` 确认在小程序内，才触发小程序壳重启登录。
  - `getEnv` 增加超时和异常保护，避免 JSSDK 环境不完整时卡住。
- `frontend/src/app/pages/Login.tsx`
  - 删除三条功能卖点列表和大面积模板化图标说明。
  - 登录页改成单任务界面：返回、品牌、根据 `next` 生成的一句上下文提示、微信登录、暂不登录、底部补充说明。
  - 错误信息改为按钮下方就近展示；按钮高度 52px，返回和次按钮不小于 44px。

### 验证结果

- Playwright 390x844：点击“微信一键登录”后成功从 `/login?next=/resources/r1` 跳转到 `/resources/r1`，`localStorage` 写入 `campus-growth-session`，页面宽度为 390，无横向溢出。
- Playwright 414x896：登录页宽度为 414，控件尺寸分别为返回 44x44、主按钮 374x52、次按钮 374x44。
- 浏览器控制台：0 error、0 warning。
- 生产构建产物中未出现 `local-browser-preview`，确认本地 mock code 被 Vite 的生产分支消除。
- `npm run verify:local-release` 通过：`lint`、前端类型检查、本地核心冒烟和前端生产构建全部成功。

## 2026-07-23 登录页视觉二次打磨

### 设计方向

- 登录页确定为“iOS photo sheet”风格：上半屏使用真实校园照片建立场景，下半屏使用白色 sheet 承载登录动作。
- 保持和当前小程序一致的轻量 iOS/微信风格：白底、细分割线、Apple 蓝局部点缀、微信绿色主按钮、低阴影、8-18px 以内圆角规则。
- 删除说明书式功能列表，不再展示三条卖点卡片；首屏只保留品牌、场景短语、当前登录目的、主按钮、次按钮和一句底部说明。
- 当前资源详情回登录时展示“登录后继续领取资料”；其他入口按路由给出不同的短提示。

### 实现内容

- `frontend/src/app/pages/Login.tsx`
  - 引入首页真实校园图作为登录页首屏图。
  - 返回按钮改为照片上的白色半透明圆形按钮，避免深色照片上看不清。
  - 白色操作区使用顶部圆角并轻微覆盖照片，形成小程序常见 sheet 层级。
  - 文案收敛为：“本校竞赛、资料和组队”“登录后继续领取资料”“按学校展示，记录自动同步。”
  - 主按钮保持微信绿色，52px 高；次按钮 44px 高；全部符合触控要求。

### 验证结果

- Playwright 390x844：页面宽度 390，scrollHeight 844，控件为返回 44x44、主按钮 350x52、次按钮 350x44。
- Playwright 414x896：页面宽度 414，scrollHeight 896，控件为返回 44x44、主按钮 374x52、次按钮 374x44。
- 点击“微信一键登录”后成功跳转 `/resources/r1`，本地 session 写入成功。
- 控制台 0 error、0 warning。
- 生产构建仍不包含 `local-browser-preview`。
- `npm run verify:local-release` 再次通过；构建后用户主包 473.77 kB、gzip 136.02 kB，无大包警告。
- 截图：
  - `output/playwright/login-sheet-style-390x844.png`
  - `output/playwright/login-sheet-style-414x896.png`
