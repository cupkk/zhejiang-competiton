# 校园成长小程序

当前仓库已经切到“小程序前端 + 正式后端骨架”的开发阶段：

- `frontend/`：Taro React 微信小程序前端
- `server/`：Express + TypeScript + SQLite 后端
- `src/`：旧版 Web 原型，仅保留作界面参考

## 后端现状

后端已经不是内存演示态，当前具备：

- SQLite 持久化
- 微信登录服务入口
- 服务端会话表
- 竞赛 / 资源 / 组队主链路读写
- 评论 / 点赞 / 举报
- 审核任务队列
- 资源下载授权
- 支付回调入口

说明：

- `WECHAT_LOGIN_MODE=hybrid` 时，已配置 `WECHAT_APP_ID` 和 `WECHAT_APP_SECRET` 会优先走真实 `code2Session`
- 未配置时会回退到本地 mock openid，方便本地联调
- 支付回调当前已接订单状态机、资源到账和通知链路，但还没有接微信支付 v3 证书验签

## 本地启动

安装依赖：

```bash
npm install
cd frontend
npm install
cd ..
```

启动后端：

```bash
npm run start:api
```

默认地址：

```text
http://127.0.0.1:8080/api
```

启动小程序前端：

```bash
cd frontend
npm run dev:weapp
```

然后用微信开发者工具导入：

```text
D:\github\zhejiang-competiton\frontend
```

## 环境变量

见 [.env.example](/d:/github/zhejiang-competiton/.env.example)。

核心配置：

```text
API_PORT=8080
API_BASE_PATH=/api
DB_PATH=server/data/campus-growth.db
SESSION_TTL_DAYS=7
ADMIN_API_KEY=dev-admin-key

WECHAT_LOGIN_MODE=hybrid
WECHAT_APP_ID=
WECHAT_APP_SECRET=
WECHAT_PAY_NOTIFY_SECRET=
```

## 已接通接口

主链路：

- `POST /auth/wechat/login`
- `GET /users/me`
- `GET /feeds/home`
- `GET /competitions`
- `GET /competitions/:id`
- `GET /competitions/:id/resources`
- `GET /competitions/:id/teams`
- `PATCH /competitions/:id/favorite`
- `POST /competitions/:id/enrollments`
- `GET /resources`
- `GET /resources/:id`
- `PATCH /resources/:id/favorite`
- `POST /resources/:id/acquisitions`
- `POST /resources/:id/downloads`
- `GET /downloads/:grantId`
- `GET /users/resources`
- `GET /orders`
- `GET /teams`
- `GET /teams/:id`
- `POST /teams`
- `POST /teams/:id/applications`

社区与审核：

- `GET /posts`
- `GET /posts/:id`
- `POST /posts`
- `GET /posts/:id/comments`
- `POST /posts/:id/comments`
- `PATCH /posts/:id/like`
- `PATCH /comments/:id/like`
- `POST /reports`
- `GET /reports`
- `GET /moderation/tasks`
- `PATCH /moderation/tasks/:id`

辅助能力：

- `GET /notifications`
- `GET /search/suggestions`
- `GET /search`
- `GET /ai/bootstrap`
- `POST /ai/reply`
- `POST /payments/wechat/notify`

## 当前验证

已实际验证通过：

- 登录与会话读取
- 首页聚合读取
- 竞赛收藏 / 报名
- 资源下单 / 支付回调 / 下载授权
- 发帖 / 评论 / 点赞 / 举报
- 审核任务查询与处理
- `401` 未登录返回
- 根目录 `npm run lint`
- 小程序前端 `npm run typecheck`
- 小程序前端 `npm run build:weapp`

## 下一步

继续往正式后端推进时，优先级建议是：

1. 把微信登录从 `hybrid` 切到真实生产模式
2. 接微信支付 v3 签名验签和下单接口
3. 给审核后台补操作页面和管理员用户体系
4. 给资源下载接真实对象存储 / CDN
5. 增加测试、CI 和部署脚本
