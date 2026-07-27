# Campus Growth Frontend

当前前端基线是网页端 React + Vite 工程，包含：

- 用户侧校园应用界面
- 网页端管理员工作台

## 本地运行

```bash
npm install
npm run dev
```

默认地址：`http://127.0.0.1:3000`

## 环境变量

如需覆盖本地配置，将 `frontend/.env.example` 复制为 `frontend/.env.local`。

```bash
VITE_API_BASE_URL=http://127.0.0.1:8080/api
```

管理员后台不再依赖前端静态密钥，改为独立登录态和服务端会话。

后台入口：

- `/admin`
- `/admin/home`
- `/admin/resources`
- `/admin/moderation`
- `/admin/reports`

## 目录结构

- `src/app`: 路由、页面、布局和共享 UI
- `src/app/lib`: API 客户端、会话与业务服务封装
- `src/styles`: 全局主题和样式
- `src/types`: 共享实体与接口类型
- `src/data/mock.ts`: 本地演示数据
- `docs/frontend-baseline.md`: 当前前端基线说明
- `docs/production-architecture.md`: 生产数据库与对象存储方案
