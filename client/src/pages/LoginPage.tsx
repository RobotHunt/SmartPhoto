import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { User, Phone, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { login, isAuthenticated } = useAuth();
  const { toast } = useToast();

  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");

  const redirect = new URLSearchParams(search).get("redirect") || "/";

  // 已登录直接跳回
  if (isAuthenticated) {
    setLocation(redirect);
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nickname.trim();
    if (!trimmed) {
      toast({ title: "请输入昵称", variant: "destructive" });
      return;
    }
    login(trimmed, phone.trim() || undefined);
    toast({ title: "登录成功", description: `欢迎，${trimmed}！` });
    setLocation(redirect);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <button
          onClick={() => setLocation(redirect)}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-6 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          返回
        </button>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h1 className="text-xl font-bold text-slate-900 mb-1">登录 / 注册</h1>
          <p className="text-xs text-slate-500 mb-6">
            输入昵称即可使用，您的数据将保存在本地浏览器中。
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                昵称 <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="请输入昵称"
                  className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent placeholder:text-slate-300"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                手机号 <span className="text-slate-300">（选填）</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="请输入手机号"
                  className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent placeholder:text-slate-300"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full h-11 rounded-2xl bg-blue-500 hover:bg-blue-600 text-white font-semibold text-sm transition-colors"
            >
              立即登录
            </button>
          </form>

          <p className="mt-4 text-center text-[10px] text-slate-400">
            登录即表示同意《用户协议》和《隐私政策》
          </p>
        </div>
      </div>
    </div>
  );
}
