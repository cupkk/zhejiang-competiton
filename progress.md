# 上线规划进度

## 2026-04-24

- 检查项目根目录，没有发现既有 `task_plan.md`、`findings.md`、`progress.md`。
- 读取 `prd.txt`、`.env.example`、`package.json`、`deploy/`、`server/config.ts`、微信登录相关代码、前端路由。
- 确认当前项目主线是 H5，不是完整原生微信小程序工程。
- 建立备案通过后的上线执行计划。
- 探测 `http://121.43.58.9/` 和 `/api/health`，确认线上 API 可用但微信登录仍是 `hybrid`。
- 查询 `campusgrow.top`，当前环境未解析到 A/AAAA 记录。

## 2026-04-30

- 用户确认备案已通过，并决定暂不轮换密钥与管理员密码。
- 本机沙箱内查询 `campusgrow.top` 出现 DNS 超时，HTTP 请求未连通；已记录为需要在正常网络或服务器侧复查。
- 新增 `deploy/launch-after-dns-checklist.md`，整理备案通过后的上线执行清单。
- 用户确认正式域名为 `campusgrow.top`，且 DNS 已生效。
- 已将 HTTPS Nginx 模板从示例域名改为 `campusgrow.top` / `www.campusgrow.top`。
- 已从 systemd API 模板移除旧 MinIO 依赖。
