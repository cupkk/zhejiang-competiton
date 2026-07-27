# 校园成长平台进展日志 20260713

## 整体研究进展

项目当前主线仍为 `D:\github\zhejiang-competiton`。用户端采用 React + Vite H5，由 `wechat-shell` 通过微信小程序 `web-view` 承载；线上后端为 Express + PostgreSQL + S3，微信登录使用真实模式，支付入口关闭。

本阶段继续处理内测前的用户体验与视觉收敛。既有界面以灰白背景、深色正文、蓝色功能强调和克制圆角为主，目标是接近真实校园工具，而不是营销模板或生成式页面。今天重点改造用户登录页，参考 Claude 提供的登录流程原型，但只借鉴适合当前真实业务的结构和信息节奏。

## 2026-07-13 登录页参考改造与移动端预览

### 用户要求

- 主要参考：
  - `参考/登录页(1).html`
  - `参考/登录页(1).zip`
- 基于现有登录页修改，不另起一套视觉体系。
- 参考页可以大幅借鉴，但要适配当前产品风格并降低 AI 感。
- 修改后需要实际预览和检查。

### 参考页分析与取舍

- 借鉴内容：
  - 居中的产品标识、产品名和一句简短定位。
  - 三条核心内容说明。
  - 底部主登录按钮、次级跳过入口和协议提示。
  - 登录按钮触发后显示明确加载状态。
- 未照搬内容：
  - 删除紫色渐变、大面积投影、手机模型边框和过多大圆角。
  - 不加入当前尚未实现的手机号登录。
  - 不使用“截止自动提醒”“独家金奖资料”等无法稳定兑现的宣传文案。
  - 不把参考原型中的年级、专业、角色等多步假表单重新塞回登录页；这些信息仍由现有首次登录引导、学校选择和个人信息模块承接。

### 代码修改

- `frontend/src/app/pages/Login.tsx`
  - 删除进入页面后自动发起登录的行为，改为用户点击“微信一键登录”后调用现有 `startQuickLogin`。
  - 保留真实 `wx.login -> /api/auth/wechat/login -> session -> nextPath` 链路。
  - 登录成功后继续跳回 `next` 指定页面；对非法 `next` 路径做本地回退保护。
  - 新界面使用当前项目的灰白背景、深色品牌块、细分割线、8px 功能图标和微信绿色主按钮。
  - 内容只保留“竞赛动态、资料经验、校园组队”三项。
  - 增加登录中状态、失败提示、返回按钮、暂不登录和协议提示。
  - 页面宽度设置为 `w-full min-w-0 max-w-full overflow-x-hidden`，主按钮和所有点击目标不小于 44px。
- `frontend/src/app/pages/Profile.tsx`
  - 未登录状态下的“立即登录”不再绕过页面直接调用登录。
  - 改为跳转 `/login?next=%2Fprofile`，让新登录页成为真实用户路径。
- `frontend/src/app/components/Layout.tsx`
  - 登录页单独取消通用的 `pb-6` 底部留白。
  - 解决 375x667 矮屏下多出的 24px 无意义纵向滚动。

### 静态验证

- `npm run lint`：通过。
- `npm run typecheck:frontend`：通过。
- `npm run build:frontend`：通过。
- 最终构建产物：
  - `frontend/dist/assets/index-D1vfmnXy.css`
  - `frontend/dist/assets/index-lojGQW-4.js`

### Playwright 预览验证

- 375x667：
  - `docScrollWidth=375`
  - `docScrollHeight=667`
  - `visualViewport.scale=1`
  - 登录按钮完整位于首屏。
  - 无横向溢出元素。
- 390x844：
  - `docScrollWidth=390`
  - `docScrollHeight=844`
  - `visualViewport.scale=1`
  - 无横向或多余纵向滚动。
- 414x896：
  - `docScrollWidth=414`
  - `docScrollHeight=896`
  - `visualViewport.scale=1`
  - 无横向或多余纵向滚动。
- 点击目标检查：返回、微信登录、暂不登录均不小于 44px。
- 登录失败状态：普通浏览器模拟无微信环境时，显示“请在微信小程序内登录。”，按钮恢复可点击，页面宽度不变化。
- 登录闭环模拟：注入 `wx.login` 和登录接口响应后，成功保存 session 并跳回 `/profile`，用户信息正常显示。
- 干净浏览器只访问登录页时，控制台 0 error、0 warning。

### 预览产物

- `output/playwright/login-redesign-20260713/login-375x667-final.png`
- `output/playwright/login-redesign-20260713/login-390x844-final.png`
- `output/playwright/login-redesign-20260713/login-414x896-final.png`
- `output/playwright/login-redesign-20260713/login-error-414x896.png`

### 当前状态与下一步

- 本地预览服务运行在 `http://127.0.0.1:3000/login`。
- 本次尚未部署服务器，也未重新生成微信预览二维码。
- 下一步应由用户先确认登录页视觉；确认后再部署线上，并用微信开发者工具验证真实 `wx.login`、首次公告、头像昵称和学校选择流程。

## 2026-07-13 连续登录引导流程完整重构

### 用户二次反馈

- 上一版只借鉴了参考文件的第一个欢迎/登录界面，理解不完整。
- `参考/登录页(1).html` 实际包含连续点击下一步并填写资料的 7 步引导。
- 上一版欢迎页视觉偏硬、偏丑，需要继续降低 AI 感并提升切换顺滑度。
- 当前会话没有可调用的前端设计 skill，因此本次采用完整拆解参考稿、复用真实接口、Playwright 全流程验证的方式完成。

### 参考文件完整拆解

参考原型包含：

1. 欢迎与微信登录。
2. 学校、年级和专业。
3. 竞赛方向与参赛目标。
4. 组队角色和技能。
5. 当前组队状态。
6. 个人优势/简介。
7. 档案完成页。

当前后端真实支持头像、昵称、学校、年级、专业、个人简介和 `focusTags`。为了避免出现“页面可以填写、退出后数据丢失”的假功能，本次把竞赛方向、技能和组队状态合并为可持久化的关注标签，继续使用现有用户资料接口保存，不新增无后端承载的临时字段。

### 最终连续流程

用户真实体验顺序为：

1. 欢迎登录页。
2. 内测公告。
3. 头像与昵称。
4. 学校、年级和专业。
5. 竞赛方向，最多 3 项。
6. 组队技能，最多 3 项。
7. 当前组队状态。
8. 个人简介。
9. 完成页并进入个人主页。

### 代码修改

- `frontend/src/app/pages/Login.tsx`
  - 欢迎页品牌标识从黑色硬块调整为蓝色教育标识。
  - 文案收敛为“找竞赛、查资料、约队友”。
  - 保留微信绿色登录按钮，不加入未实现的手机号登录。
- `frontend/src/app/components/onboarding/OnboardingShell.tsx`
  - 新增全屏连续引导骨架。
  - 顶部固定返回、进度和可选跳过；中间内容独立滚动；底部下一步按钮固定。
  - 每个步骤使用独立滚动容器，切换后始终从顶部显示。
  - 增加 `role=dialog`、`aria-modal`、加载态、错误提示和不小于 44px 的点击目标。
- `frontend/src/app/components/onboarding/OnboardingGate.tsx`
  - 删除旧的公告、头像昵称、选择学校三个分散底部弹窗。
  - 改为完整连续流程，并对接真实 API：
    - `PATCH /api/users/me/identity`
    - `GET /api/schools`
    - `PATCH /api/users/me/school`
    - `PATCH /api/users/me`
  - 学校步骤支持真实学校列表、校徽、年级选择和专业输入。
  - 竞赛方向、技能和组队状态保存到 `focusTags`，最多保存 8 个去重标签。
  - 个人简介支持直接填写、常用示例和跳过。
  - 完成页展示用户学校、专业、年级和已选标签，不展示虚假的竞赛匹配数量或奖励。
  - 引导打开时同时锁定 `html` 和 `body`，防止底层个人页跟随滚动或引起宽度变化。
- `frontend/src/styles/index.css`
  - 新增 220ms 轻量进入动画。
  - 尊重 `prefers-reduced-motion`，用户关闭动画时不强制播放。

### 视觉取舍

- 保留参考稿的进度条、逐步填写、技能网格、组队单选和完成摘要结构。
- 删除紫色渐变、彩色大插画、emoji 技能图标、夸张投影和虚假推荐数字。
- 颜色继续使用当前项目的灰白背景、蓝色交互色、深色正文和微信绿色登录按钮。
- 圆角主要保持 8px，头像和品牌标识根据对象形态单独处理。
- 页面标题、说明和按钮文案均使用直接、可兑现的表达。

### 静态验证

- `npm run lint`：通过。
- `npm run typecheck:frontend`：通过。
- `npm run build:frontend`：通过。
- 最终构建产物：
  - `frontend/dist/assets/index-iXXD7kJb.css`
  - `frontend/dist/assets/index-B_bTsVhq.js`

### 完整闭环验证

- Playwright 使用 390x844 视口模拟真实接口响应并完整走通：
  - 微信登录。
  - 公告确认。
  - 昵称保存。
  - 浙江大学、大学三年级、计算机科学与技术保存。
  - 创新创业、编程算法保存。
  - 技术开发、路演答辩保存。
  - 想加入队伍保存。
  - 个人简介保存。
  - 完成页进入个人主页。
- 最终用户数据确认：
  - `name=林同学`
  - `school=浙江大学`
  - `grade=大三`
  - `major=计算机科学与技术`
  - `focusTags=创新创业、编程算法、技术开发、路演答辩、想加入队伍`
  - 完成标记已写入 localStorage。
- 滚动重置专项验证：
  - 在个人简介页手动滚动到底部后进入完成页。
  - 完成页内容区 `scrollTop=0`。
  - “资料已保存”标题位于首屏，`headingTop=196`。
  - `htmlOverflow=hidden`、`bodyOverflow=hidden`。
  - `clientWidth=390`、`scrollWidth=390`。
- 响应式专项验证：
  - 375x667 学校页：无横向溢出，无小于 44px 的点击目标。
  - 375x667 技能页：无横向溢出，无小于 44px 的点击目标。
  - 414x896 技能页：无横向溢出，无小于 44px 的点击目标。
  - 登录页 375x667、390x844、414x896 均刚好一屏，登录按钮始终可见。
  - 干净浏览器只打开登录页时控制台 0 error、0 warning。

### 最终预览产物

- `output/playwright/onboarding-flow-20260713/login-390x844-final.png`
- `output/playwright/onboarding-flow-20260713/02-notice-final.png`
- `output/playwright/onboarding-flow-20260713/03-identity-final.png`
- `output/playwright/onboarding-flow-20260713/04-school-final.png`
- `output/playwright/onboarding-flow-20260713/05-directions-final.png`
- `output/playwright/onboarding-flow-20260713/06-skills-final.png`
- `output/playwright/onboarding-flow-20260713/07-team-final.png`
- `output/playwright/onboarding-flow-20260713/08-bio-final.png`
- `output/playwright/onboarding-flow-20260713/09-complete-reset-final.png`
- `output/playwright/onboarding-flow-20260713/school-375x667-final.png`
- `output/playwright/onboarding-flow-20260713/skills-375x667-final.png`
- `output/playwright/onboarding-flow-20260713/skills-414x896-final.png`

### 当前状态

- 本地预览服务仍运行在 `http://127.0.0.1:3000/login`。
- 本次仍未部署服务器，未生成新的微信真机预览二维码。
- 下一步应先确认这套连续引导视觉，再部署线上并做微信开发者工具真实 `wx.login` 冒烟。

## 2026-07-13 连续登录引导生产发布与微信开发版本同步

### 发布前检查

- 重新执行并通过：
  - `npm run lint`
  - `npm run typecheck:frontend`
  - `CAMPUS_BUILD_VERSION=20260713163040 npm run build:frontend`
- 构建产物：
  - `frontend/dist/assets/index-iXXD7kJb.css`
  - `frontend/dist/assets/index-B_bTsVhq.js`
- 发布包改为最小运行包，只包含 API 源码、共享类型和种子模块、依赖清单、TypeScript 配置及 `frontend/dist`。
- 发布包不包含 `.env`、SSH 密钥、数据库、上传目录、`node_modules`、截图、测试结果和参考稿。

### 一次失败发布与恢复

- 首次最小包 release：`20260713162739`。
- API 启动失败，日志明确为 `server/db.ts` 无法加载 `frontend/src/data/mock.ts`。
- 线上短暂出现 502 后立即将 `current` 回滚到 `20260708193736`，API 健康检查恢复。
- 随后扫描 API 跨目录依赖，将以下运行依赖补入发布包：
  - `frontend/src/data/mock.ts`
  - `frontend/src/types/api.ts`
  - `frontend/src/types/entities.ts`
- `scripts/deploy-commercial-release.sh` 已增加最长 30 秒健康等待；新 release 检查失败时自动恢复旧 `current` 并重启验证，避免以后留下不可用版本。

### 最终线上发布

- 最终 release：`20260713163040`。
- 发布包：`.deploy/campus-growth-20260713163040.tar.gz`。
- SHA-256：`F3459F36847F3ACFF12FC08E189E311445844977EA24A5B69156C9715B58CE27`。
- 当前线上：`/opt/campus-growth/current -> /opt/campus-growth/releases/20260713163040`。
- systemd：`campus-growth-api=active`。
- `https://campusgrow.top/api/health`：
  - `databaseProvider=postgres`
  - `storageProvider=s3`
  - `wechatLoginMode=real`
  - `paymentsEnabled=false`
- HTTP 已 301 跳转 HTTPS，HTTPS 首页返回 200。
- 线上 HTML 的 CSS 查询版本为 `20260713163040`；线上 JS 与本地构建 SHA-256 一致。

### 生产移动端验收

- Playwright 使用 iPhone 13 设备配置访问 `https://campusgrow.top/login?v=20260713163040`。
- 结果：
  - `innerWidth=390`
  - `document.scrollWidth=390`
  - `body.scrollWidth=390`
  - `root.scrollWidth=390`
  - `visualViewport.scale=1`
  - 横向溢出为 0
  - 返回按钮 44x44
  - 微信登录按钮 350x52
  - 暂不登录按钮 350x44
  - 控制台 0 error、0 warning
- 截图：`output/playwright/production-onboarding-login-20260713163040.png`。

### 微信开发版本

- 微信开发者工具 CLI 登录状态正常，AppID 为 `wxda8641cd650537a4`。
- 真机预览生成成功：
  - `output/wechat-preview/campus-growth-preview-20260713163040.png`
  - `output/wechat-preview/campus-growth-preview-20260713163040.json`
- 上传开发版本成功：
  - 版本：`0.1.9`
  - 描述：`内测版：连续登录引导与体验优化 20260713`
  - 信息：`output/wechat-preview/upload-20260713163040.json`
- 微信 CLI 只能上传开发版本，不能自动执行公众平台中的“选为体验版”。下一步需要在微信公众平台版本管理中将 `0.1.9` 选为体验版，然后由体验成员完成真实 `wx.login` 和完整引导真机验收。
- 已检查微信开发者工具 CLI 全部命令，只有 `preview`、`auto-preview` 和 `upload` 等命令，没有设置体验版的命令。
- 尝试使用微信官方版本信息接口确认体验版状态：普通小程序 App access token 可正常调用基础接口，但 `wxa/getversioninfo` 返回 `40014 invalid access_token`。该接口不能用当前普通小程序凭据替代公众平台管理员操作，因此不继续尝试绕过后台权限。
- 本次生产验收完成后已关闭 Playwright 会话，并停止本地 `3000` 端口登录预览服务；线上服务和微信开发者工具保持运行。
