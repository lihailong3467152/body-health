/**
 * 身体觉察多人版：站长只需填写这里的两个值。
 * 可填写的是 Supabase 的 PUBLIC publishable key（sb_publishable_...）。
 * 不要把 service_role / sb_secret_ / SMTP 密码写在本文件！
 * GitHub Pages 的所有文件都公开，切勿上传私人记录或备份。
 */
window.BODY_AWARENESS_CONFIG = Object.freeze({
  supabaseUrl: 'https://wgaztpchykjikmjfbbkb.supabase.co',
  supabasePublishableKey: 'sb_publishable_oPksta4YT2UATGCZxQo4zA_JIXbXnL2',
  // true: 必须登录后才能记录；更适合多人使用。
  requireLogin: true,
  // false: 此网页的登录请求不会主动创建新用户；还需在 Supabase 后台关闭公开注册。
  allowSignup: true
});
