# 浙江校园成长平台研究进展日志

## 总体研究进展

### 项目目标

本项目是面向大学生的校园成长、竞赛与资源协作平台，核心目标是围绕“竞赛信息、学习资源、组队协作、经验交流、轻量 AI 辅助”建立从机会发现到行动转化的闭环。PRD 中明确强调，产品不是重课程平台，也不是泛校园社交，而是一个任务型成长入口，帮助学生更快找到机会、资料、队友和下一步行动建议。

### 当前研究方向

当前仓库实际主线是 React + Vite H5 前端和 Express API 后端。文档中仍以微信小程序为最终上线形态，但现有代码不是完整原生微信小程序工程。最快上线策略仍是先将 H5 部署到正式 HTTPS 域名，再通过轻量微信小程序壳的 `web-view` 承载 H5，并由小程序壳负责 `wx.login` code 传递。

### 已完成工作概览

- 前端主工程位于 `frontend/`，入口为 `frontend/src/main.tsx` 和 `frontend/src/app/App.tsx`。
- 前端路由集中在 `frontend/src/app/routes.tsx`，已经覆盖用户端首页、竞赛、资源、社区、组队、搜索、消息、收藏、订单、发布、个人资料，以及网页端管理员后台。
- 前端请求封装位于 `frontend/src/app/lib/api.ts`、`frontend/src/app/lib/http.ts`、`frontend/src/app/lib/app-service.ts`。
- 后端入口为 `server/index.ts`，基于 Express 提供 `/api` 路由。
- 后端已经覆盖微信登录、首页运营配置、竞赛、资源、组队、社区、搜索、消息、收藏、资源上传、下载授权、订单、微信支付/退款回调、举报和审核后台等接口。
- 数据层在 `server/db.ts` 中抽象为 SQLite/PostgreSQL 双路径；本地默认 SQLite，生产可切换 PostgreSQL。
- 存储层在 `server/storage-service.ts` 中抽象为 local/S3 双路径；本地默认 local，生产可切换 S3 兼容对象存储。
- 部署资料位于 `deploy/`，包括 Nginx HTTP/HTTPS 模板、systemd API 模板和上线输入说明。

### 当前关键发现

1. 当前代码比早期 `frontend/docs/frontend-baseline.md` 描述更完整。早期文档说新前端只有 5 个主页面，但现在已经补齐大量详情页、用户资产页、发布页和后台页。
2. `README.md` 和 PRD 能正常按 UTF-8 读取；PowerShell 默认输出曾出现乱码，后续读取中文文档应显式使用 `-Encoding UTF8`。
3. `rg --files` 在当前 Windows 环境中被拒绝执行，后续搜索可优先改用 `Get-ChildItem` 与 `Select-String`。
4. 当前 git 工作区已有大量既有改动，主要表现为旧 Taro/根目录前端删除、新 `frontend/src/app/` 主线新增、后端服务层增强、部署资料新增。后续代理不得回退这些已有改动。
5. `.env.example` 已在本次商业化改造中改为占位密钥和商用默认值，但生产服务器 env、微信 AppSecret、管理员默认密码仍必须轮换或复核。
6. 支付链路代码保留，但当前产品策略是用户端暂不开放购买、支付、退款入口。本次已新增支付开关，默认关闭；支付关闭时不会创建待支付订单。
7. AI/规划能力当前仍不作为正式主入口，用户端浮动入口已默认隐藏，规划页保留为后续内测路由。
8. 已修复本次发现的支付/退款关键乱码写入和用户端筛选乱码值；历史兼容映射仍保留，用于兼容旧数据。

### 当前验证结果

- `node -v`：v22.15.1。
- `npm run lint`：通过，根 TypeScript 检查无错误。
- `npm run typecheck:frontend`：通过，前端 TypeScript 检查无错误。
- `npm run build:frontend`：通过，Vite 生产构建成功，输出到 `frontend/dist/`。
- 2026-05-03 商业化改造后再次验证：
  - `npm.cmd run typecheck:frontend`：通过。
  - `npm.cmd run lint`：通过。
  - `npm.cmd run build:frontend`：通过。
- 本地临时启动 `npm run start:api` 后，`http://127.0.0.1:8080/api/health` 返回成功：
  - `databaseProvider=sqlite`
  - `storageProvider=local`
  - `wechatLoginMode=hybrid`
- 冒烟验证后已停止本次临时 API 进程。

### 当前阻塞与风险

- 线上 HTTPS、`API_PUBLIC_ORIGIN=https://campusgrow.top`、`WECHAT_LOGIN_MODE=real`、`PAYMENTS_ENABLED=false` 已完成并通过健康检查。
- 微信后台 request 合法域名和 web-view 业务域名仍需在微信公众平台配置为 `https://campusgrow.top`。
- 如果微信后台要求业务域名校验文件，需要上传到站点根目录并验证 HTTPS 可访问。
- 前端已移除用户端 demo 登录入口，但小程序壳必须负责 `wx.login` 并传递 code，仍需真机联调。
- 支付能力当前默认关闭；二期开启前必须补齐微信支付真机、退款、发票、客服和合规流程。
- 生产凭据仍需定期轮换和复核：微信 AppSecret、管理员密码、S3 凭据、数据库密码。

### 下一步建议

1. 在微信公众平台配置 request 合法域名和 web-view 业务域名为 `https://campusgrow.top`。
2. 如被要求，上传微信业务域名校验文件到站点根目录。
3. 完成小程序壳真实登录：`wx.login` 获取 code 后传给 `/api/auth/wechat/login`。
4. 做灰度冒烟：游客浏览、首登资料补全、收藏、资源免费领取/下载、组队申请与审核、发帖评论举报、后台审核、首页运营配置。
5. 轮换和复核生产凭据：微信 AppSecret、管理员密码、S3 凭据、数据库密码。

## 2026-05-03 更新

### 本次操作

- 阅读项目根目录文档：`README.md`、`prd.txt`、`task_plan.md`、`progress.md`、`findings.md`。
- 阅读前端文档：`frontend/README.md`、`frontend/docs/frontend-baseline.md`、`frontend/docs/production-architecture.md`、`frontend/docs/launch-plan.md`。
- 阅读部署文档：`deploy/README.md`、`deploy/go-live-inputs.md`、`deploy/launch-after-dns-checklist.md`。
- 梳理前端入口、路由、布局、请求层和典型页面。
- 梳理后端入口、配置、数据库适配、数据模型、微信登录、存储、目录服务、社区服务和支付服务。
- 运行类型检查、前端构建和 API 健康检查。

### 涉及文件与目录

- `frontend/src/app/routes.tsx`：前端路由总表。
- `frontend/src/app/lib/api.ts`：前端 API 函数封装。
- `frontend/src/app/lib/http.ts`：统一请求、鉴权和错误处理。
- `frontend/src/app/lib/app-service.ts`：前端业务服务聚合。
- `server/index.ts`：Express API 入口和路由注册。
- `server/config.ts`：端口、数据库、存储、管理员、微信登录和微信支付配置。
- `server/db.ts`：SQLite/PostgreSQL 适配、建表和种子数据逻辑。
- `server/catalog-service.ts`：用户、首页、竞赛、资源、组队、订单、消息、搜索等业务逻辑。
- `server/community-service.ts`：帖子、评论、点赞、举报、审核任务和 AI 占位回复。
- `server/payment-service.ts`：资源下载授权、订单支付、退款和微信支付/退款回调。
- `server/storage-service.ts`：资源文件和首页运营图的 local/S3 存储逻辑。
- `.env.example`：当前仍有上线前需要处理的密钥风险。

### 得到的结果

- 确认项目目前是可继续开发的 TypeScript 基线，根类型检查、前端类型检查和前端生产构建均通过。
- 确认本地 API 默认配置可启动，健康检查可返回成功。
- 确认当前默认本地配置仍是 SQLite/local/hybrid，不是生产 PostgreSQL/S3/real 微信登录。
- 确认前端已经具备较完整的用户端和后台页面结构，不应再按“只有 5 个主页面”的旧认知继续判断。

### 发现的问题

- `rg` 在当前环境不可用，后续使用 PowerShell 原生命令替代。
- `server/.run-api.pid` 中的旧进程号不代表当前 API 正在运行。
- 使用 `Start-Process npm` 会因为 Windows shim 报“not a valid Win32 application”，应改用 `npm.cmd`。
- 使用 `Start-Process npm.cmd` 启动后，npm 父进程可能退出但 Node 子进程继续监听端口，冒烟后需要按端口或子进程号清理。
- `server/payment-service.ts` 仍有退款相关乱码文案和乱码订单状态写入风险。

### 后续代理接手提示

下一位代理应先读本日志，再读 `deploy/launch-after-dns-checklist.md` 和 `frontend/docs/launch-plan.md`。如果目标是上线或小程序审核，优先处理安全密钥、真实微信登录、HTTPS 域名、小程序壳、用户端支付入口隐藏和中文乱码清理。不要回退当前大量未提交改动，除非用户明确要求。

## 2026-05-03 商业化改造更新

### 本次操作

- 按用户给定计划创建内部商业计划文档：`commercialization plan 20260503.md`。
- 新增服务端支付开关 `PAYMENTS_ENABLED`，默认关闭。
- 新增前端商业化配置 `VITE_PAYMENTS_ENABLED`，默认关闭。
- `/api/health` 增加 `paymentsEnabled` 字段，便于本地和线上验收。
- 支付关闭时，`POST /resources/:id/acquisitions` 对付费资源返回 `payments_disabled`，不会创建待支付订单。
- 支付关闭时，`POST /orders/:id/pay` 和 `POST /orders/:id/refunds` 返回 `payments_disabled`。
- 后端在支付关闭时过滤公开付费资源：资源列表、首页资源推荐、搜索资源结果均默认只展示免费资源；付费资源直链对非作者返回不可访问。
- 清理 `.env.example` 中真实密钥样式值，改为占位符，并加入 `API_PUBLIC_ORIGIN=https://campusgrow.top`、`WECHAT_LOGIN_MODE=real`、`PAYMENTS_ENABLED=false`。
- 新增 `frontend/.env.example` 中的 `VITE_PAYMENTS_ENABLED=false`。
- 移除用户端 `demo-code` 快速登录入口，`startQuickLogin` 改为只通过微信小程序 `wx.login` 获取 code。
- 隐藏用户端浮动 AI 快捷入口，规划页保留为内测路由。
- 新增领域常量 `frontend/src/app/lib/domain-options.ts`，统一竞赛、资源和社区筛选项的用户可见中文标签与后端值。
- 更新用户端核心页面视觉和文案：首页、竞赛、资源、社区、资源详情、账号设置、客服反馈、浏览历史、搜索、规划页、资源投稿、发帖页。
- 清理用户端开发态文案：“演示链路”“备案通过后”“后续会”“暂未开放购买”等。

### 涉及文件

- `commercialization plan 20260503.md`
- `experiment journal 20260503.md`
- `.env.example`
- `frontend/.env.example`
- `server/config.ts`
- `server/index.ts`
- `server/catalog-service.ts`
- `server/payment-service.ts`
- `frontend/src/app/lib/commercial-config.ts`
- `frontend/src/app/lib/domain-options.ts`
- `frontend/src/app/lib/quick-login.ts`
- `frontend/src/app/lib/app-service.ts`
- `frontend/src/app/components/PageHeader.tsx`
- `frontend/src/app/components/ui.tsx`
- `frontend/src/app/components/BottomNav.tsx`
- `frontend/src/app/components/ResourceCard.tsx`
- `frontend/src/app/components/CompetitionCard.tsx`
- `frontend/src/app/components/Layout.tsx`
- `frontend/src/app/pages/Home.tsx`
- `frontend/src/app/pages/Competitions.tsx`
- `frontend/src/app/pages/Resources.tsx`
- `frontend/src/app/pages/ResourceDetail.tsx`
- `frontend/src/app/pages/Community.tsx`
- `frontend/src/app/pages/PublishPost.tsx`
- `frontend/src/app/pages/PublishResource.tsx`
- `frontend/src/app/pages/AccountSettings.tsx`
- `frontend/src/app/pages/Support.tsx`
- `frontend/src/app/pages/History.tsx`
- `frontend/src/app/pages/Search.tsx`
- `frontend/src/app/pages/Ai.tsx`

### 当前验证结果

- `npm.cmd run typecheck:frontend`：通过。
- `npm.cmd run lint`：通过。
- `npm.cmd run build:frontend`：通过。

### 线上执行结果

- 已生成本地部署包：`campus-growth-20260503133215.tar.gz`。
- 已上传并发布服务器新 release：`/opt/campus-growth/releases/20260503133215`。
- `/opt/campus-growth/current` 已切换到新 release。
- API 服务 `campus-growth-api.service` 已重启成功。
- 线上 `/api/health` 已包含 `paymentsEnabled=false`。
- 线上 `/etc/campus-growth/api.env` 已更新：
  - `API_PUBLIC_ORIGIN=https://campusgrow.top`
  - `PAYMENTS_ENABLED=false`
  - `DB_PROVIDER=postgres`
  - `STORAGE_PROVIDER=s3`
- 后续收到正式微信 AppID/AppSecret 后，已将其只写入服务器 `/etc/campus-growth/api.env`，并切换 `WECHAT_LOGIN_MODE=real`。
- 已安装 `certbot` 和 `python3-certbot-nginx`。
- 已签发 Let’s Encrypt 证书：
  - 域名：`campusgrow.top`、`www.campusgrow.top`
  - 证书路径：`/etc/letsencrypt/live/campusgrow.top/fullchain.pem`
  - 私钥路径：`/etc/letsencrypt/live/campusgrow.top/privkey.pem`
  - 到期日：2026-08-01
- 已部署 HTTPS Nginx 配置，443 已监听。
- 已启用 `certbot-renew.timer`，`certbot renew --dry-run` 通过。
- 线上验收：
  - `curl -I http://campusgrow.top/`：301 到 `https://campusgrow.top/`。
  - `curl -I https://campusgrow.top/`：200。
  - `curl -I https://www.campusgrow.top/`：200。
  - `curl https://campusgrow.top/api/health`：已更新为返回 `postgres`、`s3`、`real`、`paymentsEnabled=false`。

### 新增部署辅助脚本

- 新增 `scripts/deploy-commercial-release.sh`，用于服务器按 release 目录发布代码、复用旧 `node_modules`、切换 current symlink、重启 API 并健康检查。
- 注意：脚本依赖已经上传好的 `/tmp/campus-growth-<release>.tar.gz`，执行示例：

```bash
/tmp/deploy-commercial-release.sh 20260503133215
```

### 当前决策

- 第一阶段不启用在线支付，只做免费资源和校园合作转化。
- 资源列表默认只展示免费资源，减少支付审核、退款和售后风险。
- 真实微信登录是正式路径；H5 不再保留用户可触达的 demo 登录。
- AI/规划页不作为主入口，避免用户误认为已经接入正式模型能力。
- 前端风格收敛到 iOS 式浅灰背景、白色轻毛玻璃、Apple 蓝强调、低阴影和 44px 触控目标。
- 生产已切 `WECHAT_LOGIN_MODE=real`；微信密钥只保存在服务器环境变量，不写入仓库和文档。

### 后续必须继续

- 轮换生产微信 AppSecret、管理员密码、S3 凭据和数据库密码。
- 完成小程序壳 `wx.login` 真机联调。
- 做移动端 390x844、414x896 视觉截图检查，确认无拥挤、无按钮文字溢出、无开发态文案。

## 2026-05-03 真实微信登录与线上收尾更新

### 本次操作

- 使用用户提供的小程序 AppID/AppSecret 更新服务器 `/etc/campus-growth/api.env`，密钥未写入仓库、示例配置或本文档。
- 服务器切换 `WECHAT_LOGIN_MODE=real` 并重启 `campus-growth-api.service`。
- 复核线上 HTTPS、健康检查和密钥落库风险。
- 更新 `commercialization plan 20260503.md`，把微信真实模式从待办改为已完成。

### 当前线上验收结果

- `curl.exe -I http://campusgrow.top/`：301 到 `https://campusgrow.top/`。
- `curl.exe -I https://campusgrow.top/`：200，响应包含 HSTS、X-Content-Type-Options、X-Frame-Options、Referrer-Policy。
- `curl.exe https://campusgrow.top/api/health`：返回 `databaseProvider=postgres`、`storageProvider=s3`、`wechatLoginMode=real`、`paymentsEnabled=false`。
- 本地仓库文档、示例配置、前后端源码和部署脚本范围内未发现微信 AppSecret 明文。

### 当前决策

- 商业化第一阶段保持支付关闭，只开放免费资源领取和校园合作转化。
- 真实微信登录已作为生产路径启用；H5 端不恢复 demo 登录。
- 密钥类信息只允许进入服务器环境变量或云平台密钥系统，不进入仓库。

### 后续接手步骤

- 在微信公众平台配置 request 合法域名和 web-view 业务域名：`https://campusgrow.top`。
- 如微信后台要求，上传业务域名校验文件到站点根目录。
- 用真机小程序壳验证：`wx.login`、H5 web-view、登录态保持、浏览、收藏、免费资源获取/下载、组队申请、发帖、消息、后台审核。
- 准备灰度内容：真实校园首图、20 个竞赛条目、30 份免费资源和首页运营位。

## 2026-05-03 前端静态补丁与最终验收

### 本次操作

- 清理资源页第一阶段不需要的“获取方式”空筛选块，资源列表继续隐式请求 `priceType=免费`。
- 将订单记录页和退款状态页中的“当前版本”等开发态表达改成正式业务文案。
- 重新执行本地前端类型检查、根类型检查和前端生产构建。
- 将本地 `frontend/dist` 静态资源同步到服务器 `/opt/campus-growth/current/frontend/dist`。
- 同步前在服务器备份旧静态目录：`/opt/campus-growth/backups/frontend-dist-20260503215353`。

### 当前验证结果

- `npm.cmd run typecheck:frontend`：通过。
- `npm.cmd run lint`：通过。
- `npm.cmd run build:frontend`：通过。
- 线上首页已引用新静态资源：
  - `/assets/index-DH2QZ3q7.js`
  - `/assets/index-f5LcscNb.css`
- `curl.exe https://campusgrow.top/api/health`：仍返回 `postgres`、`s3`、`real`、`paymentsEnabled=false`。
- Playwright 移动端 390x844 访问 `https://campusgrow.top/resources?fresh=...`：
  - 未出现“获取方式”。
  - 未出现“当前版本”。
  - 未出现购买、支付或暂未开放购买入口。
  - 截图已保存为 `campusgrow-resources-mobile-20260503.png`。

### 后续接手提示

- 如果继续做视觉优化，优先补真实校园图片和真实运营内容，而不是再增加说明文字。
- 如果继续做上线验收，下一步应进入微信公众平台配置域名和真机小程序壳联调。

## 2026-05-04 微信业务域名校验文件上传

### 本次操作

- 用户已从微信公众平台下载业务域名校验文件：`C:\Users\18103\Downloads\djVGWes8Fi.txt`。
- 文件内容为 32 字节校验串，已上传到服务器临时目录后安装到站点根目录：
  - `/opt/campus-growth/current/frontend/dist/djVGWes8Fi.txt`
- 文件权限设置为 `0644`，属主属组为 `campus:campus`。

### 当前验证结果

- `https://campusgrow.top/djVGWes8Fi.txt`：HTTP 200，返回校验文件内容。
- `https://www.campusgrow.top/djVGWes8Fi.txt`：HTTP 200，返回校验文件内容。
- `http://campusgrow.top/djVGWes8Fi.txt`：301 跳转到 HTTPS。

### 后续接手步骤

- 回到微信公众平台“配置业务域名”弹窗，点击“保存”。
- 如果保存成功，继续配置 request 合法域名为 `https://campusgrow.top`。
- 保存后用真机小程序壳验证 `web-view` 能打开 `https://campusgrow.top` 并完成 `wx.login` 登录。

## 2026-05-04 小程序壳与 H5 登录桥接

### 本次操作

- 新增小程序壳工程：`wechat-shell/`。
- 小程序壳使用 AppID：`wxda8641cd650537a4`。
- 小程序壳启动页为 `pages/webview/index`，负责：
  - 调用 `wx.login` 获取一次性 code。
  - 拼接 `https://campusgrow.top/?mp_login_code=...&mp_entry=...&mp_login_ts=...`。
  - 用 `web-view` 打开 H5。
- H5 新增登录桥组件：`frontend/src/app/components/WechatMiniProgramLoginBridge.tsx`。
- `Layout` 已挂载该桥接组件，H5 会读取 `mp_login_code` 或 `wechat_code`，调用 `/api/auth/wechat/login` 换取 session，并从地址栏清除一次性 code。
- 新增 `wechat-shell/README.md`，记录微信开发者工具导入、预览和上传步骤。

### 线上同步

- 重新构建 H5 前端并同步 `frontend/dist` 到服务器：
  - 新 bundle：`/assets/index-BP8pJmpe.js`
  - 备份目录：`/opt/campus-growth/backups/frontend-dist-20260504132718`
- 同步静态资源后发现微信业务域名校验文件被覆盖为 H5 fallback，已立即恢复：
  - `/opt/campus-growth/current/frontend/dist/djVGWes8Fi.txt`

### 当前验证结果

- `npm.cmd run typecheck:frontend`：通过。
- `npm.cmd run lint`：通过。
- `npm.cmd run build:frontend`：通过。
- `https://campusgrow.top/` 已引用新 H5 bundle `index-BP8pJmpe.js`。
- `https://campusgrow.top/api/health` 返回 `postgres`、`s3`、`real`、`paymentsEnabled=false`。
- `https://campusgrow.top/djVGWes8Fi.txt` 返回微信校验文件内容，HTTP 200。
- Playwright 用假 `mp_login_code` 验证桥接容错：
  - 页面正常显示。
  - 地址栏中的 `mp_login_code` 已被清除。
  - 控制台只有假 code 导致的 `/api/auth/wechat/login` 400，属于预期。

### 当前阻塞

- 本机未找到微信开发者工具 CLI，无法由命令行直接上传小程序版本。
- 下一步需要在微信开发者工具中导入 `D:\github\zhejiang-competiton\wechat-shell`，完成真机预览和上传。

### 后续接手步骤

- 打开微信开发者工具，导入 `wechat-shell/`。
- 确认开发者工具右上角详情中“不校验合法域名”保持关闭，用正式域名校验。
- 真机预览测试：进入首页、自动登录、个人页显示微信用户、收藏、免费资源获取/下载、组队申请、发帖、消息。
- 预览通过后上传版本，并在微信公众平台提交审核。
- 以后每次同步 `frontend/dist` 后，都要确认 `djVGWes8Fi.txt` 仍在站点根目录。

## 2026-05-03 微信小程序信息填写建议

### 本次操作

- 根据用户提供的微信后台截图，梳理需要填写的小程序名称、简称、头像和简介。
- 重新核对 `README.md`、`prd.txt`、`commercialization plan 20260503.md` 和本日志中的产品定位，确认当前项目应按“面向大学生的校园成长、竞赛资源与组队协作入口”填写，而不是按重课程平台或泛校园社交平台填写。

### 推荐填写内容

- 小程序名称建议填写：`校园成长助手`。该名称短、清楚，能覆盖竞赛、资源、组队和经验交流，不会把产品限制成单一竞赛工具。
- 小程序简称建议填写：`成长助手`。该简称满足微信后台 4-10 字符限制，也适合任务栏展示。
- 小程序简介建议填写：`面向大学生的校园成长服务小程序，聚合竞赛信息、学习资源、组队协作和经验交流，帮助用户更快发现机会、获取资料、找到队友并推进下一步行动。`
- 小程序头像建议使用简洁安全的 144x144 PNG：浅蓝或蓝绿色背景，中心为书页、上升箭头或星标路径图形，避免政治、宗教、色情、夸张营销和复杂小字。

### 当前决策

- 不建议在名称中加入“浙江”，因为当前产品定位面向校园成长场景，正式推广可覆盖更广泛高校用户；除非比赛或备案主体强制强调浙江。
- 不建议使用“平台”“商城”“AI”等词作为主名称，避免微信审核、用户预期和当前第一阶段功能边界不一致。
- 如果 `校园成长助手` 已被占用，备用名可考虑 `竞赛成长助手`，简称仍可用 `成长助手`。
