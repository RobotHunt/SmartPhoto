import { useState } from "react";
import { useLocation } from "wouter";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { login, register } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);

  // Login fields
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register fields
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) return;
    setLoading(true);
    try {
      await login(loginEmail, loginPassword);
      toast({ title: "登录成功" });
      setLocation("/");
    } catch (err: any) {
      toast({ title: "登录失败", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (regPassword !== regConfirm) {
      toast({ title: "两次密码不一致", variant: "destructive" });
      return;
    }
    if (regPassword.length < 8) {
      toast({ title: "密码至少8位", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await register(regEmail, regPassword, regName);
      toast({ title: "注册成功" });
      setLocation("/");
    } catch (err: any) {
      toast({ title: "注册失败", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-blue-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <span className="font-bold text-xl text-slate-900">AI电商做图</span>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 mb-6">
          <button
            className={`flex-1 py-3 text-center font-semibold text-sm border-b-2 transition-colors ${
              tab === "login" ? "text-blue-500 border-blue-500" : "text-slate-400 border-transparent"
            }`}
            onClick={() => setTab("login")}
          >
            登录
          </button>
          <button
            className={`flex-1 py-3 text-center font-semibold text-sm border-b-2 transition-colors ${
              tab === "register" ? "text-blue-500 border-blue-500" : "text-slate-400 border-transparent"
            }`}
            onClick={() => setTab("register")}
          >
            注册
          </button>
        </div>

        {/* Login Form */}
        {tab === "login" && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">邮箱</label>
              <Input type="email" placeholder="请输入邮箱" value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">密码</label>
              <Input type="password" placeholder="请输入密码" value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)} required />
            </div>
            <Button type="submit" disabled={loading}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white py-5 rounded-xl text-base">
              {loading ? "登录中..." : "登录"}
            </Button>
          </form>
        )}

        {/* Register Form */}
        {tab === "register" && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">昵称</label>
              <Input type="text" placeholder="请输入昵称" value={regName}
                onChange={e => setRegName(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">邮箱</label>
              <Input type="email" placeholder="请输入邮箱" value={regEmail}
                onChange={e => setRegEmail(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">密码 <span className="text-slate-400 font-normal">(至少8位)</span></label>
              <Input type="password" placeholder="请输入密码" value={regPassword}
                onChange={e => setRegPassword(e.target.value)} required minLength={8} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">确认密码</label>
              <Input type="password" placeholder="再次输入密码" value={regConfirm}
                onChange={e => setRegConfirm(e.target.value)} required minLength={8} />
            </div>
            <Button type="submit" disabled={loading}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white py-5 rounded-xl text-base">
              {loading ? "注册中..." : "注册"}
            </Button>
          </form>
        )}

        <button onClick={() => setLocation("/")}
          className="mt-4 w-full text-center text-sm text-slate-400 hover:text-slate-600 transition-colors">
          返回主页
        </button>
      </div>
    </div>
  );
}
