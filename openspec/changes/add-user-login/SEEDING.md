# 首账号种子说明

本变更**不实现注册**，因此首个登录账号需由部署方手动写入 `users` 表。
用户密码以 scrypt 哈希存储（格式 `saltHex:hashHex`），由
`src/app/server/lib/password.ts` 的 `hashPassword` 生成。

## 1. 生成密码哈希

在项目根目录执行（替换 `YOUR_PASSWORD` 为实际密码）：

```bash
node -e "const {hashPassword}=require('./src/app/server/lib/password.ts'); " \
  # 上面的 require 无法直接加载 .ts，请改用下方 tsx 方式
```

由于该文件为 TypeScript，推荐用 `npx tsx` 执行一次性脚本：

```bash
npx tsx -e "import { hashPassword } from './src/app/server/lib/password'; console.log(hashPassword('YOUR_PASSWORD'))"
```

输出的字符串（形如 `a1b2…:c3d4…`）即为 `password_hash` 列的值。

## 2. 写入首个管理员账号

将上一步得到的哈希替换 `<HASH>` 后执行：

### MySQL

```sql
INSERT INTO users (username, password_hash, display_name, email, status)
VALUES ('admin', '<HASH>', 'Administrator', 'admin@example.com', 'active');
```

### SQLite

```sql
INSERT INTO users (username, password_hash, display_name, email, status)
VALUES ('admin', '<HASH>', 'Administrator', 'admin@example.com', 'active');
```

> SQLite 的 `created_at` / `updated_at` 默认取 `unixepoch()`，无需手填；
> MySQL 同样默认 `now()`。

## 3. 环境变量

确保 `.env`（或部署环境）设置了：

```
AUTH_JWT_SECRET=<至少 32 字符的随机串>
```

生成：

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

完成上述步骤后，访问 `/login` 即可用 `admin` / `YOUR_PASSWORD` 登录。

## 后续

- 用户注册、改密、用户管理后台均不在本次范围，留给后续变更。
- 建议在后续变更中为 `/api/auth/login` 增加登录限流以防暴力破解。
