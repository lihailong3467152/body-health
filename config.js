/**
 * V3.0 账号密码版：只填写你自己 Supabase 的项目地址和公开 key。
 * 不可填 service_role、sb_secret_、SMTP 密码、用户密码！
 * 如果要让大家自行创建账号，allowSignup 为 true，且 Supabase 后台也必须允许注册。
 * 数据隔离由数据库 RLS 强制执行，不能只依赖前端权限。
 */
window.BODY_AWARENESS_CONFIG = Object.freeze({
  supabaseUrl: 'https://wgaztpchykjikmjfbbkb.supabase.co',
  supabasePublishableKey: 'sb_publishable_oPksta4YT2UATGCZxQo4zA_JIXbXnL2',
  requireLogin: true,
  allowSignup: true
});
