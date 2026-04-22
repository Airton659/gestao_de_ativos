import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Lock, UserRound } from 'lucide-react';

export const Login = () => {
  const [matricula, setMatricula] = useState('');
  const [senha, setSenha] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const { login, isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matricula || !senha) {
      setErrorMsg('Preencha usuário e senha');
      return;
    }
    setErrorMsg('');
    setIsLoading(true);

    try {
      const params = new URLSearchParams();
      params.append('username', matricula);
      params.append('password', senha);

      const res = await api.post('/login/access-token/', params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      
      if (res.data?.access_token) {
        const token = res.data.access_token;
        // Injetar manualmente o header para esta chamada específica, pois ainda não está no localStorage
        const userRes = await api.post('/test-token/', null, {
          headers: { Authorization: `Bearer ${token}` }
        });
        login(token, userRes.data);
      } else {
        setErrorMsg('Erro: Resposta inválida do servidor');
        setSenha('');
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Erro ao fazer login. Verifique suas credenciais.');
      setSenha('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] overflow-x-hidden px-4">
      <div className="w-full max-w-[400px] rounded-[32px] border border-slate-100 bg-white p-6 sm:p-10 shadow-[0_20px_40px_rgba(0,0,0,0.04)]">
        
        {/* LOGO */}
        <div className="mb-8 flex flex-col items-center">
          <img src="/logo.png" alt="Logo" className="mb-4 h-16 object-contain" />
          <p className="text-sm font-bold tracking-widest text-[#94A3B8]">
            GESTÃO DE ATIVOS DE TI
          </p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-6">
          {errorMsg && (
            <div className="rounded-xl bg-red-50 p-3 text-center text-sm font-bold text-red-600">
              {errorMsg}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black tracking-[1.0px] text-[#94A3B8]">
              USUÁRIO
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                <UserRound size={18} className="text-slate-400" />
              </div>
              <Input
                type="text"
                placeholder="Digite seu usuário..."
                value={matricula}
                onChange={(e) => setMatricula(e.target.value)}
                className="h-12 pl-11"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black tracking-[1.0px] text-[#94A3B8]">
              SENHA
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                <Lock size={18} className="text-slate-400" />
              </div>
              <Input
                type="password"
                placeholder="Sua senha secreta"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="h-12 pl-11"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="mt-2 h-12 w-full text-[13px] font-black tracking-[1px] shadow-lg shadow-[#0000A0]/20"
          >
            {isLoading ? 'ENTRANDO...' : 'ACESSAR SISTEMA'}
          </Button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-[11px] font-bold text-slate-400">
            Dúvidas? Procure o suporte de TI.
          </p>
        </div>
      </div>
    </div>
  );
};
