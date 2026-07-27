# 上线发现记录

日期：2026-04-24

## 项目结构

- 当前主线前端位于 `frontend/src/app`，技术栈是 React + Vite H5。
- 当前仓库不是完整原生微信小程序工程；旧 Taro/小程序相关文件大量处于删除状态。
- 后端入口是 `server/index.ts`，已有用户、首页、竞赛、资源、组队、社区、消息、收藏、审核、后台和支付骨架接口。
- 部署资料位于 `deploy/`，已有 Nginx HTTP/HTTPS 模板和 systemd 服务模板。

## 生产环境

- 现有线上服务器是 `121.43.58.9`。
- 项目文档显示线上已接 PostgreSQL 和阿里云 OSS 路径。
- `deploy/go-live-inputs.md` 仍保留从 IP + HTTP 切到正式域名 + HTTPS 的待办说明。
- `http://121.43.58.9/` 当前可返回 H5 页面。
- `http://121.43.58.9/api/health` 当前返回 `databaseProvider=postgres`、`storageProvider=s3`、`wechatLoginMode=hybrid`。
- 如果正式域名使用 `campusgrow.top`，当前本机 DNS 查询未返回 A/AAAA 记录，需要先补解析。

## 关键风险

- `.env.example` 当前包含真实微信 AppID/AppSecret 示例，必须清理并轮换真实密钥。
- 用户曾在对话中提供 OSS AccessKey/Secret，正式上线前必须轮换。
- `frontend/src/app/lib/quick-login.ts` 仍使用 `demo-code` 登录。
- `server/auth-service.ts`、`frontend/src/app/lib/http.ts` 等文件仍存在中文乱码，会影响真实用户体验和审核观感。
- 支付相关后端骨架仍存在，但当前产品策略是支付暂缓，用户端必须继续隐藏购买、退款、支付动作。
- 线上微信登录仍是 `hybrid`，正式小程序上线前必须切到 `real` 并完成真机登录联调。

## 微信上线约束

- 小程序 request 合法域名必须使用 HTTPS 域名，不能使用 IP 或裸 HTTP。
- 如果用 `web-view` 承载 H5，需要在小程序后台配置业务域名并完成域名校验。
- 当前 H5 不能直接等价于小程序，最快方式是新增小程序壳，由壳负责微信能力，H5 负责业务 UI。
