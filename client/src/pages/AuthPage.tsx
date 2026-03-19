// [2026-03-19 新增] 登录注册页面
// 支持：手机号+密码登录、手机号+验证码登录、手机号+密码+验证码注册
import { useState, useEffect, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { ArrowLeft, Phone, Lock, Shield, Eye, EyeOff, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
// [2026-03-19 新增] 导入 auth 函数
import { authLogin, authLoginByCode, authRegister } from "@/_core/hooks/useAuth";

// ─── 验证码倒计时 Hook ──────────────────────────────────────────────
function useCountdown(seconds: number) {
  const [count, setCount] = useState(0);
  const [active, setActive] = useState(false);
  useEffect(() => { if (!active || count <= 0) return; const t = setTimeout(() => setCount(c => c - 1), 1000); return () => clearTimeout(t); }, [active, count]);
  useEffect(() => { if (count <= 0 && active) setActive(false); }, [count, active]);
  const start = useCallback(() => { setCount(seconds); setActive(true); }, [seconds]);
  return { count, active, start };
}

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // 主 tab：登录 / 注册
  const [mode, setMode] = useState<"login" | "register">("login");
  // 登录子 tab：密码 / 验证码
  const [loginMethod, setLoginMethod] = useState<"password" | "code">("password");

  // 表单字段
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const countdown = useCountdown(60);

  // 切换模式时清空表单
  const switchMode = (newMode: "login" | "register") => {
    setMode(newMode);
    setPhone(""); setPassword(""); setConfirmPassword(""); setVerifyCode("");
    setShowPassword(false); setShowConfirmPassword(false);
  };

  // 发送验证码
  const handleSendCode = () => {
    if (!phone.trim() || phone.trim().length < 11) {
      toast({ title: "请输入正确的手机号" });
      return;
    }
    countdown.start();
    toast({ title: "验证码已发送", description: `已发送到 ${phone}` });
  };

  // 登录 — 密码方式
  const handlePasswordLogin = () => {
    if (!phone.trim() || phone.trim().length < 11) { toast({ title: "请输入正确的手机号" }); return; }
    if (!password.trim()) { toast({ title: "请输入密码" }); return; }
    setSubmitting(true);
    // [2026-03-19 改造] 原: 纯模拟，改为调用 authLogin 验证预置用户
    setTimeout(() => {
      const result = authLogin(phone.trim(), password);
      setSubmitting(false);
      if (result.success) {
        toast({ title: "登录成功", description: `欢迎回来，${result.user?.name}！` });
        setLocation("/");
      } else {
        toast({ title: "登录失败", description: result.error });
      }
    }, 1500);
  };

  // 登录 — 验证码方式
  const handleCodeLogin = () => {
    if (!phone.trim() || phone.trim().length < 11) { toast({ title: "请输入正确的手机号" }); return; }
    if (!verifyCode.trim() || verifyCode.trim().length < 4) { toast({ title: "请输入验证码" }); return; }
    setSubmitting(true);
    // [2026-03-19 改造] 原: 纯模拟，改为调用 authLoginByCode 验证预置用户
    setTimeout(() => {
      const result = authLoginByCode(phone.trim(), verifyCode.trim());
      setSubmitting(false);
      if (result.success) {
        toast({ title: "登录成功", description: `欢迎回来，${result.user?.name}！` });
        setLocation("/");
      } else {
        toast({ title: "登录失败", description: result.error });
      }
    }, 1500);
  };

  // 注册
  const handleRegister = () => {
    if (!phone.trim() || phone.trim().length < 11) { toast({ title: "请输入正确的手机号" }); return; }
    if (!password.trim() || password.length < 6) { toast({ title: "密码至少6位" }); return; }
    if (password !== confirmPassword) { toast({ title: "两次密码不一致" }); return; }
    if (!verifyCode.trim() || verifyCode.trim().length < 4) { toast({ title: "请输入验证码" }); return; }
    setSubmitting(true);
    // [2026-03-19 改造] 原: 纯模拟，改为调用 authRegister
    setTimeout(() => {
      const result = authRegister(phone.trim(), password, verifyCode.trim());
      setSubmitting(false);
      if (result.success) {
        toast({ title: "注册成功", description: "已自动登录" });
        setLocation("/");
      } else {
        toast({ title: "注册失败", description: result.error });
      }
    }, 1500);
  };

  const handleSubmit = () => {
    if (mode === "register") return handleRegister();
    if (loginMethod === "password") return handlePasswordLogin();
    return handleCodeLogin();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* 顶部导航 */}
      <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => setLocation("/")} className="p-1.5 rounded-full hover:bg-slate-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <h1 className="text-base font-bold text-slate-900">
          {mode === "login" ? "登录" : "注册"}
        </h1>
      </div>

      <div className="flex-1 flex flex-col items-center px-6 pt-10">
        {/* Logo / 标题 */}
        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-200">
          <span className="text-white text-2xl font-black">S</span>
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-1">SmartPhoto</h2>
        <p className="text-sm text-slate-400 mb-8">AI 电商做图平台</p>

        {/* 主 Tab：登录 / 注册 */}
        <div className="w-full max-w-sm mb-6">
          <div className="flex bg-slate-100 rounded-xl p-1">
            <button
              onClick={() => switchMode("login")}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${
                mode === "login" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              登录
            </button>
            <button
              onClick={() => switchMode("register")}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${
                mode === "register" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              注册
            </button>
          </div>
        </div>

        {/* 登录子 Tab：密码登录 / 验证码登录 */}
        {mode === "login" && (
          <div className="w-full max-w-sm mb-4">
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => { setLoginMethod("password"); setVerifyCode(""); }}
                className={`text-sm font-medium pb-1 border-b-2 transition ${
                  loginMethod === "password" ? "text-blue-600 border-blue-500" : "text-slate-400 border-transparent"
                }`}
              >
                密码登录
              </button>
              <button
                onClick={() => { setLoginMethod("code"); setPassword(""); }}
                className={`text-sm font-medium pb-1 border-b-2 transition ${
                  loginMethod === "code" ? "text-blue-600 border-blue-500" : "text-slate-400 border-transparent"
                }`}
              >
                验证码登录
              </button>
            </div>
          </div>
        )}

        {/* 表单 */}
        <div className="w-full max-w-sm space-y-3">
          {/* 手机号（所有模式都有） */}
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2">
              <Phone className="w-4 h-4 text-slate-400" />
            </div>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="请输入手机号"
              maxLength={11}
              className="w-full pl-10 pr-4 py-3 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            />
          </div>

          {/* 密码（密码登录 + 注册） */}
          {(mode === "register" || (mode === "login" && loginMethod === "password")) && (
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                <Lock className="w-4 h-4 text-slate-400" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={mode === "register" ? "设置密码（至少6位）" : "请输入密码"}
                className="w-full pl-10 pr-10 py-3 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              />
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          )}

          {/* 确认密码（仅注册） */}
          {mode === "register" && (
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                <Lock className="w-4 h-4 text-slate-400" />
              </div>
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="确认密码"
                className="w-full pl-10 pr-10 py-3 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              />
              <button
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          )}

          {/* 验证码（验证码登录 + 注册） */}
          {(mode === "register" || (mode === "login" && loginMethod === "code")) && (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                  <Shield className="w-4 h-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  value={verifyCode}
                  onChange={e => setVerifyCode(e.target.value)}
                  placeholder="请输入验证码"
                  maxLength={6}
                  className="w-full pl-10 pr-4 py-3 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                />
              </div>
              <button
                onClick={handleSendCode}
                disabled={countdown.active}
                className={`shrink-0 px-4 py-3 text-sm font-medium rounded-xl transition ${
                  countdown.active
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                    : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                }`}
              >
                {countdown.active ? `${countdown.count}s` : "发送验证码"}
              </button>
            </div>
          )}

          {/* 提交按钮 */}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:opacity-60 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-sm transition active:scale-95 mt-2"
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" />{mode === "login" ? "登录中…" : "注册中…"}</>
            ) : (
              mode === "login" ? "登录" : "注册"
            )}
          </button>

          {/* 密码登录时的忘记密码 */}
          {mode === "login" && loginMethod === "password" && (
            <div className="text-center">
              <button
                onClick={() => toast({ title: "忘记密码", description: "功能开发中，请使用验证码登录" })}
                className="text-xs text-slate-400 hover:text-blue-500"
              >
                忘记密码？
              </button>
            </div>
          )}
        </div>

        {/* 底部协议 */}
        <p className="text-[10px] text-slate-400 mt-8 text-center leading-relaxed">
          {mode === "register" ? "注册" : "登录"}即代表同意
          <Link href="/terms" className="text-blue-500 hover:text-blue-600 mx-0.5">《用户协议》</Link>
          和
          <Link href="/privacy" className="text-blue-500 hover:text-blue-600 mx-0.5">《隐私政策》</Link>
        </p>
      </div>
    </div>
  );
}
