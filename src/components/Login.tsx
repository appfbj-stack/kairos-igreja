import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState("admin@kairos.com");
  const [password, setPassword] = useState("admin123");
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (e: any) {
      setErr(e.message || "Erro ao entrar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#2a2a20] p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 mb-4">
            <img src="/logo-kairos.png" alt="Kairos Tecnologia" className="w-full h-full object-contain drop-shadow-lg" />
          </div>
          <h1 className="text-2xl font-bold font-serif text-[#2a2a20]">Kairos Igreja</h1>
          <p className="text-xs text-[#8a8a70] mt-1">Plataforma de Gestão Eclesiástica</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-[#2a2a20] uppercase mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#f5f5f0] border border-[#e0e0d0] text-sm text-[#2a2a20] focus:outline-none focus:ring-2 focus:ring-[#5a5a40]/30"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[#2a2a20] uppercase mb-1">Senha</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 pr-12 rounded-xl bg-[#f5f5f0] border border-[#e0e0d0] text-sm text-[#2a2a20] focus:outline-none focus:ring-2 focus:ring-[#5a5a40]/30"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-[#8a8a70] hover:text-[#2a2a20] hover:bg-[#e0e0d0]/40 transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {err && <p className="text-xs text-red-600 bg-red-50 p-2 rounded-lg">{err}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[#5a5a40] hover:bg-[#4d4d36] text-white font-bold text-sm transition-colors disabled:opacity-50"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="text-[10px] text-[#8a8a70] text-center mt-6">
          Demo: admin@kairos.com / admin123
        </p>
      </div>
    </div>
  );
};