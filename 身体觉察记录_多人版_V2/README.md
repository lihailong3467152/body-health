# 身体觉察记录 · 多人独立账号版 V2.0

适用：同一个 GitHub Pages 网站，10人、几十人或更多人用各自邮箱登录；手机和电脑登录同一账号可同步。用户 A **无权**查看用户 B 的记录（RLS 在数据库层面生效）。

## 这版做了哪些修改

1. 新增 `config.js`：站长只填一次 Supabase Project URL 和公开的 `sb_publishable_...` key，其他使用者无需配置。
2. `index.html` 自动加载 `config.js`，并在登录页说明多人独立账号机制。
3. `app.js` 在 `requireLogin: true` 模式下强制先登录，未登录不能进入记录、历史和趋势页面。
4. 每个人的历史读操作除了依靠 RLS，也明确按登录 `user_id` 筛选；读、写、改、删的隔离关键仍然是 `supabase.sql` 中的 RLS。
5. `sw.js` 增加 `config.js` 缓存及版本升级。
6. 保留原版的记录、人体部位选择、历史查询、趋势统计、导出 JSON/CSV、离线缓存队列。

## 0. 文件结构

```
index.html         网页页面
app.js             记录、登录与同步逻辑
styles.css         手机/电脑样式
config.js          ★ 站长仅配置这一个文件即可
supabase.sql       ★ 在 Supabase SQL Editor 执行
sw.js              离线静态资源缓存
manifest.webmanifest
assets/icon.svg
```

## 1. 在 Supabase 创建云数据库

1. 登录 https://supabase.com/dashboard ，New project。
2. 在 SQL Editor 中粘贴并运行 `supabase.sql`。**请执行完整 SQL，包括 `enable row level security` 和四条 policy。**
3. Authentication → Sign In / Providers：确认 Email 登录可用。
4. Settings / Connect 或 API Keys：复制 `Project URL`、`Publishable key (sb_publishable_...)`。旧版 `anon` 公开 key 也能兼容，但优先选择新版 key。
5. 在 `config.js` 中填入：

```js
window.BODY_AWARENESS_CONFIG = Object.freeze({
  supabaseUrl: 'https://真实项目ID.supabase.co',
  supabasePublishableKey: 'sb_publishable_真实的公开密钥',
  requireLogin: true,
  allowSignup: true
});
```

6. **重要：多人通过邮箱登录，需要自定义 SMTP。** Supabase 自带试用邮件服务目前只允许给项目团队的预授权邮箱发送，且通常限制 **2 封/小时**，并不适合直接让多个人正常注册/登录。请到 Authentication → SMTP 配置你自己的合规邮件发送服务（如 Resend/Brevo 等），并留意其额度、域名验证和可能费用。
7. 如果只让指定人员使用：`allowSignup: false`，并在 Supabase 后台关闭公开注册，由管理员通过受信任渠道预先创建/邀请账号。**前端开关本身不能防止绕过，必须同时在服务端禁用公开注册。** 邀请/登录邮件也需要 SMTP。

## 2. GitHub Pages 部署

1. 新建 GitHub 公开仓库，例如 `body-awareness`。
2. 将文件夹内的 `index.html`、`app.js`、`config.js`、`styles.css`、`supabase.sql` 等文件上传到仓库根目录。**不得把私人记录、JSON 导出文件、SMTP 密码、`sb_secret_...` 或 service_role 密钥上传！** `supabase.sql` 可公开，因为只包含权限结构，不含用户数据。
3. 仓库 Settings → Pages → Source = Deploy from a branch → Branch = main → Folder = /(root) → Save。
4. 发布后的地址通常为 `https://你的GitHub用户名.github.io/body-awareness/`。
5. 在 Supabase → Authentication → URL Configuration：Site URL 填上面的 **准确网址（含仓库路径和末尾 /）**；Redirect URLs 也加上这一个准确网址。`app.js` 会用当前网页地址作为邮箱链接返回位置。
6. 打开网页测试，第一次进入会显示「登录与数据同步」。成功登录才可以记录。

## 3. 测试两人是否隔离

- A 用户注册/登录，保存“头部、紧张程度 3”，在历史页查看。
- 换一个干净的浏览器配置/无痕窗口，B 用户使用不同邮箱登录，不应看到 A 的记录。
- B 保存“肩颈、紧张程度 7”；A 用户刷新页面后仍只能看到 A 自己的记录。
- A 用手机登录同一邮箱，应该可以看到 A 的记录。
- 如果 B 看到 A 的云端记录，立刻停止公开使用，检查 `supabase.sql` 是否完整执行且 RLS 正在启用。

## 4. 特殊说明

- 网页是公开的，**记录数据不是公开的**。RLS 控制浏览器账号能够读写哪些行。
- 本版没有「管理员查看所有人记录」功能，也不应在未经同意时增加；这是刻意设计的隐私保护。
- Supabase 公开客户端密钥可以存在 `config.js`，但 `sb_secret_...`、`service_role` 和 SMTP 密码绝不能出现在网页代码里。
- 允许多个设备登录；离线修改先在当前浏览器排队，联网后上传。若两台设备同时修改同一记录，不保证自动合并，最后上传的版本可能覆盖。
- 身体日记涉及私人感受，不建议用公用电脑记录；浏览器本地缓存并非端到端加密，且 Supabase 管理员拥有服务端管理能力。
- 本机备份（JSON）请妥善保管，切勿上传至公开仓库。
- 没有配置数据库时，`requireLogin: true` 会阻止未登录用户使用记录页；你可先把它临时改成 `false` 测试界面，但正式多人使用应保持 `true`。
- 每个用户独立账号不是“团队共享表格”；如需用户同意后汇总匿名统计，需要单独设计授权及去标识化流程。

## 5. 本地预览（开发者）

```bash
python -m http.server 8080
```

浏览器打开 `http://localhost:8080`。若测试邮箱登录，需要把该地址加入 Supabase Redirect URLs；正式部署后切换成 GitHub Pages 地址。也可以在数据库尚未配置时临时 `requireLogin: false`，检查界面效果。

## 参考资料

- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/reference/javascript/auth-signinwithotp
- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/docs/guides/auth/redirect-urls
- https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
