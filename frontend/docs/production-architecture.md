# 生产架构方案

## 最终确定

### 生产数据库

生产环境数据库方案确定为：

- `PostgreSQL 16`

选择原因：

1. 比 SQLite 更适合并发读写。
2. 适合后续扩展管理员日志、支付流水、审核历史和统计报表。
3. 适合云服务器或托管数据库环境。

当前仓库里的 SQLite 保留为：

- 本地开发
- 功能联调
- 小范围演示

### 生产对象存储

生产环境对象存储方案确定为：

- `S3` 兼容对象存储
- 国内优先推荐 `腾讯云 COS`

选择原因：

1. 资源文件、运营图片、用户上传都适合对象存储。
2. 使用统一的 S3 兼容接口后，后续可以切换 COS、OSS 或 MinIO。
3. 便于接 CDN、签名下载、生命周期管理和备份。

## 当前代码状态

当前代码仍运行在：

- `DB_PROVIDER=sqlite`
- `STORAGE_PROVIDER=local`

这适合开发和联调，但不适合作为正式公网生产形态。

## 生产环境建议配置

### 数据库

```bash
DB_PROVIDER=postgres
POSTGRES_URL=postgres://user:password@host:5432/dbname
```

### 对象存储

```bash
STORAGE_PROVIDER=s3
S3_ENDPOINT=
S3_REGION=
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_PUBLIC_BASE_URL=
S3_FORCE_PATH_STYLE=false
```

## 迁移顺序

1. 保持当前管理员登录与权限体系先稳定。
2. 迁移数据库到 PostgreSQL。
3. 迁移文件存储到 S3 兼容对象存储。
4. 最后补齐部署、监控、备份和回滚。
