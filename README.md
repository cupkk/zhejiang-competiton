# Campus Growth

校园竞赛与资源协作平台仓库，当前由两部分组成：

- `frontend/`: 新的前端基线，来自 Figma Make 导出的 React + Vite 移动端界面。
- `server/`: Express + SQLite 后端，承载登录、竞赛、资源、组队、社区、订单与支付链路。

## 当前约定

- 以后新的界面基线以 `frontend/` 为准。
- `frontend/src/types` 与 `frontend/src/data/mock.ts` 同时作为后端共享类型和种子数据来源。
- 旧的根目录 Web 界面已经移除，不再作为前端主工程。

## 运行方式

### 推荐：本地一键启动

```bash
npm run dev:local
```

该命令使用独立的 `server/data/campus-growth-local-preview.db`，自动准备浙江大学和复旦大学的用户、帖子、问答、组队及学校管理员测试数据，然后启动：

- 用户端：`http://127.0.0.1:3001/`
- API 健康检查：`http://127.0.0.1:8080/api/health`

本地学校管理员账号为 `local_zju_admin`、`local_fdu_admin`，密码均为 `LocalTest123!`。种子脚本会拒绝 PostgreSQL 和非本地预览数据库路径。

服务启动后可执行核心闭环测试：

```bash
npm run test:local-core
```

上线前本地固定检查（需先保持 `npm run dev:local` 运行）：

```bash
npm run verify:local-release
```

该命令依次执行服务端类型检查、前端类型检查、双学校权限与审核矩阵、生产构建。

### 1. 安装根依赖

```bash
npm install
```

### 2. 安装前端依赖

```bash
cd frontend
npm install
```

### 3. 启动前端

```bash
npm run dev:frontend
```

### 4. 启动后端

```bash
npm run dev:api
```

默认后端地址为 `http://127.0.0.1:8080/api`。

## 目录说明

- `frontend/docs/frontend-baseline.md`: 新前端结构审计、问题和后续任务。
- `frontend/src/app`: Figma Make 导出的页面、布局和导航。
- `frontend/src/types`: 与后端共享的业务实体与接口类型。
- `frontend/src/data/mock.ts`: 种子数据与演示数据。
- `server/`: API、数据库、审核、上传、支付与下载逻辑。
