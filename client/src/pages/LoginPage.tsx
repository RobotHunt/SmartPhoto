import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Sparkles } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function getRedirectTarget() {
  const raw = new URLSearchParams(window.location.search).get("redirect");
  if (!raw) return "/";
  if (!raw.startsWith("/")) return "/";
  return raw;
}

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { user, login, register } = useAuth();
  const { toast } = useToast();

  const redirectTarget = useMemo(getRedirectTarget, []);
  const [tab, setTab] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");

  useEffect(() => {
    if (user) {
      setLocation(redirectTarget);
    }
  }, [redirectTarget, setLocation, user]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim()) return;

    setLoading(true);
    try {
      await login(loginEmail.trim(), loginPassword);
      toast({ title: "登录成功" });
      setLocation(redirectTarget);
    } catch (err: any) {
      toast({
        title: "登录失败",
        description: err?.message || "请检查邮箱和密码后重试",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!regName.trim() || !regEmail.trim() || !regPassword || !regConfirm) return;

    if (regPassword !== regConfirm) {
      toast({ title: "两次密码不一致", variant: "destructive" });
      return;
    }

    if (regPassword.length < 8) {
      toast({ title: "密码至少 8 位", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      await register(regEmail.trim(), regPassword, regName.trim());
      toast({ title: "注册成功" });
      setLocation(redirectTarget);
    } catch (err: any) {
      toast({
        title: "注册失败",
        description: err?.message || "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-blue-100 px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center">
        <div className="w-full rounded-[28px] bg-white p-8 shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
          <div className="mb-8 flex items-center justify-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500 shadow-lg shadow-blue-200">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">AI 电商做图</p>
              <p className="text-xs text-slate-400">登录后可继续当前页面流程</p>
            </div>
          </div>

          <div className="mb-6 flex rounded-2xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setTab("login")}
              className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                tab === "login"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              登录
            </button>
            <button
              type="button"
              onClick={() => setTab("register")}
              className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                tab === "register"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              注册
            </button>
          </div>

          {tab === "login" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">邮箱</label>
                <Input
                  type="email"
                  placeholder="请输入邮箱"
                  value={loginEmail}
                  onChange={(event) => setLoginEmail(event.target.value)}
                  required
                  className="h-11 rounded-xl border-slate-200"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">密码</label>
                <Input
                  type="password"
                  placeholder="请输入密码"
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  required
                  className="h-11 rounded-xl border-slate-200"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="h-12 w-full rounded-2xl bg-blue-500 text-base font-semibold text-white hover:bg-blue-600"
              >
                {loading ? "登录中..." : "登录"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">昵称</label>
                <Input
                  type="text"
                  placeholder="请输入昵称"
                  value={regName}
                  onChange={(event) => setRegName(event.target.value)}
                  required
                  className="h-11 rounded-xl border-slate-200"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">邮箱</label>
                <Input
                  type="email"
                  placeholder="请输入邮箱"
                  value={regEmail}
                  onChange={(event) => setRegEmail(event.target.value)}
                  required
                  className="h-11 rounded-xl border-slate-200"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  密码
                  <span className="ml-1 text-xs font-normal text-slate-400">至少 8 位</span>
                </label>
                <Input
                  type="password"
                  placeholder="请输入密码"
                  value={regPassword}
                  onChange={(event) => setRegPassword(event.target.value)}
                  required
                  minLength={8}
                  className="h-11 rounded-xl border-slate-200"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">确认密码</label>
                <Input
                  type="password"
                  placeholder="请再次输入密码"
                  value={regConfirm}
                  onChange={(event) => setRegConfirm(event.target.value)}
                  required
                  minLength={8}
                  className="h-11 rounded-xl border-slate-200"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="h-12 w-full rounded-2xl bg-blue-500 text-base font-semibold text-white hover:bg-blue-600"
              >
                {loading ? "注册中..." : "注册"}
              </Button>
            </form>
          )}

          <button
            type="button"
            onClick={() => setLocation(redirectTarget === "/" ? "/" : redirectTarget)}
            className="mt-5 w-full text-center text-sm text-slate-400 transition hover:text-slate-600"
          >
            返回上一页
          </button>
        </div>
      </div>
    </div>
  );
}
