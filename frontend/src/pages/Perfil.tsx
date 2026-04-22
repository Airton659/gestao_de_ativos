import { useState, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import {
  User, Mail, Hash, ShieldCheck, Activity,
  MoveHorizontal, Eye, EyeOff, CheckCircle2, XCircle,
  ArrowRight, Lock, PenLine, Trash2, Save,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn, safeParseDate } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FeedbackModal } from '@/components/ui/FeedbackModal';

export const Perfil = () => {
  const { user } = useAuth();
  const [showAtual, setShowAtual] = useState(false);

  // ── Assinatura canvas ──────────────────────────────────────────────────────
  const sigCanvasRef = useRef<SignatureCanvas>(null);
  const [canvasMode, setCanvasMode] = useState<'view' | 'draw'>('view');
  const [canSave, setCanSave] = useState(false);
  const [sigCacheBuster, setSigCacheBuster] = useState(Date.now);

  const { data: meData, refetch: refetchMe } = useQuery({
    queryKey: ['me'],
    queryFn: async () => (await api.get('/usuarios/me/')).data,
  });

  const existingSignature: string | null = meData?.assinatura_url || null;

  const enterDrawMode = () => {
    setCanSave(false);
    setCanvasMode('draw');
    // Sincroniza o buffer interno do canvas com o tamanho real exibido na tela
    setTimeout(() => {
      const pad = sigCanvasRef.current;
      if (!pad) return;
      const canvas = pad.getCanvas();
      const dpr = Math.max(window.devicePixelRatio || 1, 1);
      // Pega o tamanho real que o CSS aplicou
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      canvas.getContext('2d')?.scale(dpr, dpr);
      pad.clear();
    }, 100);
  };

  const clearCanvas = () => { sigCanvasRef.current?.clear(); setCanSave(false); };

  const salvarAssinaturaMutation = useMutation({
    mutationFn: (base64: string) => api.post('/usuarios/me/assinatura/', { base64 }),
    onSuccess: () => {
      refetchMe();
      setSigCacheBuster(Date.now());
      setCanvasMode('view');
      setFeedback({ open: true, success: true, title: 'ASSINATURA SALVA', message: 'Sua assinatura foi salva e será usada automaticamente nos termos de responsabilidade.' });
    },
    onError: () => {
      setFeedback({ open: true, success: false, title: 'ERRO', message: 'Não foi possível salvar a assinatura.' });
    },
  });

  const trimCanvas = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const l = pixels.data.length;
    const bound: { top: number | null; left: number | null; right: number | null; bottom: number | null } = { 
      top: null, left: null, right: null, bottom: null 
    };
    let x, y;

    for (let i = 0; i < l; i += 4) {
      if (pixels.data[i + 3] !== 0) {
        x = (i / 4) % canvas.width;
        y = Math.floor((i / 4) / canvas.width);

        if (bound.top === null || y < bound.top) bound.top = y;
        if (bound.left === null || x < bound.left) bound.left = x;
        if (bound.right === null || x > bound.right) bound.right = x;
        if (bound.bottom === null || y > bound.bottom) bound.bottom = y;
      }
    }

    if (bound.top === null || bound.left === null || bound.right === null || bound.bottom === null) return null;

    const trimHeight = bound.bottom - bound.top + 20;
    const trimWidth = bound.right - bound.left + 20;
    const trimmed = document.createElement('canvas');
    trimmed.width = trimWidth;
    trimmed.height = trimHeight;
    const trimmedCtx = trimmed.getContext('2d');
    if (!trimmedCtx) return null;
    
    trimmedCtx.drawImage(
      canvas, 
      bound.left - 10, 
      bound.top - 10, 
      trimWidth, 
      trimHeight, 
      0, 
      0, 
      trimWidth, 
      trimHeight
    );
    return trimmed;
  };

  const salvarAssinatura = () => {
    const sc = sigCanvasRef.current;
    if (!sc || !canSave || sc.isEmpty()) return;
    
    const canvas = sc.getCanvas();
    const trimmedCanvas = trimCanvas(canvas);
    const dataUrl = trimmedCanvas ? trimmedCanvas.toDataURL('image/png') : canvas.toDataURL('image/png');
    salvarAssinaturaMutation.mutate(dataUrl);
  };
  const [showNova, setShowNova] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);
  const [feedback, setFeedback] = useState<{ open: boolean; success: boolean; title: string; message: string }>({
    open: false, success: true, title: '', message: '',
  });

  const { register, handleSubmit, watch, reset, setError, formState: { errors } } = useForm();
  const novaSenha = watch('senha_nova') || '';

  const requisitos = [
    { label: 'Mínimo 8 caracteres', ok: novaSenha.length >= 8 },
    { label: 'Letra maiúscula', ok: /[A-Z]/.test(novaSenha) },
    { label: 'Letra minúscula', ok: /[a-z]/.test(novaSenha) },
    { label: 'Número', ok: /[0-9]/.test(novaSenha) },
    { label: 'Caractere especial', ok: /[^A-Za-z0-9]/.test(novaSenha) },
  ];

  const { data: movsData, isLoading: isLoadingMovs } = useQuery({
    queryKey: ['minhas-movimentacoes'],
    queryFn: async () => (await api.get('/movimentacoes/minhas/')).data,
  });

  const minhasMovs = movsData?.movimentacoes || [];

  const { data: ativos = [] } = useQuery({
    queryKey: ['equipamentos'],
    queryFn: async () => (await api.get('/equipamentos/')).data,
    enabled: minhasMovs.length > 0,
  });

  const { data: locais = [] } = useQuery({
    queryKey: ['localizacoes'],
    queryFn: async () => (await api.get('/localizacoes/')).data,
    enabled: minhasMovs.length > 0,
  });

  const ativoMap = Object.fromEntries(ativos.map((a: any) => [a.id, a]));
  const localMap = Object.fromEntries(locais.map((l: any) => [l.id, l]));

  const totalTecnico = movsData?.total_tecnico || 0;
  const totalGestor = movsData?.total_gestor || 0;
  const totalRegistros = movsData?.total_registros || 0;
  const ultimaMov = minhasMovs[0];

  const alterarSenhaMutation = useMutation({
    mutationFn: (data: any) =>
      api.put('/usuarios/me/senha/', { senha_atual: data.senha_atual, senha_nova: data.senha_nova }),
    onSuccess: () => {
      reset();
      setFeedback({ open: true, success: true, title: 'SENHA ALTERADA', message: 'Sua senha foi atualizada com sucesso.' });
    },
    onError: (err: any) => {
      const detail = err.response?.data?.detail || 'Erro ao alterar senha.';
      if (detail.toLowerCase().includes('atual')) {
        setError('senha_atual', { message: detail });
      } else {
        setFeedback({ open: true, success: false, title: 'ERRO', message: detail });
      }
    },
  });

  const onSubmit = (data: any) => {
    if (data.senha_nova !== data.confirmar) {
      setError('confirmar', { message: 'As senhas não coincidem.' });
      return;
    }
    alterarSenhaMutation.mutate(data);
  };

  const initials = (user?.nome || 'U').substring(0, 2).toUpperCase();

  const locLabel = (id?: number) => {
    if (!id) return '—';
    const l = localMap[id];
    if (!l) return `#${id}`;
    return `${l.sala}${l.bloco ? ` · ${l.bloco}` : ''} · ${l.campus}`;
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">

      {/* ── HEADER ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-6 rounded-[32px] border border-slate-100 bg-white p-8 shadow-[0_8px_40px_rgba(0,0,0,0.04)]">
        <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-3xl bg-[#0000A0] text-2xl font-black text-white shadow-lg shadow-[#0000A0]/20">
          {initials}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-black text-[#1E293B]">{user?.nome}</h1>
          <p className="text-sm font-bold text-slate-400">{user?.perfil?.nome?.toUpperCase()}</p>
        </div>
        <div className={cn(
          "rounded-full px-4 py-1.5 text-[10px] font-black tracking-widest",
          user?.ativo !== false ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"
        )}>
          {user?.ativo !== false ? 'ATIVO' : 'INATIVO'}
        </div>
      </div>

      {/* ── ASSINATURA DIGITAL ──────────────────────────────────────── */}
      <div className="rounded-[32px] border border-slate-100 bg-white p-8 shadow-[0_8px_40px_rgba(0,0,0,0.04)]">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
            <PenLine size={18} />
          </div>
          <div>
            <h2 className="text-sm font-black text-[#1E293B]">Assinatura Digital</h2>
            <p className="text-[10px] font-bold text-slate-400">Assine uma vez e ela aparecerá automaticamente nos termos de responsabilidade.</p>
          </div>
        </div>

        {canvasMode === 'view' ? (
          <div className="flex flex-col gap-4">
            {existingSignature ? (
              <div className="flex flex-col items-center gap-4">
                <p className="text-[10px] font-black tracking-widest text-slate-400">ASSINATURA ATUAL</p>
                <div className="flex h-32 w-full max-w-md items-center justify-center rounded-2xl border border-slate-100 bg-slate-50/50 p-6">
                  <img 
                    src={existingSignature.startsWith('data:') ? existingSignature : `${existingSignature}?t=${sigCacheBuster}`} 
                    alt="Assinatura" 
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <button
                  onClick={enterDrawMode}
                  className="flex w-fit items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-[11px] font-black text-slate-500 transition-colors hover:border-[#0000A0] hover:text-[#0000A0]"
                >
                  <PenLine size={14} />
                  REFAZER ASSINATURA
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-6">
                <p className="text-sm font-bold text-slate-400">Você ainda não tem assinatura cadastrada.</p>
                <button
                  onClick={enterDrawMode}
                  className="flex items-center gap-2 rounded-xl bg-[#0000A0] px-6 py-2.5 text-[11px] font-black text-white shadow-lg shadow-[#0000A0]/20 hover:bg-[#0000c0] transition-colors"
                >
                  <PenLine size={14} />
                  CRIAR ASSINATURA
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-[10px] font-black tracking-widest text-slate-400">DESENHE SUA ASSINATURA</p>
            <div className="relative rounded-2xl border-2 border-dashed border-[#0000A0]/20 bg-white overflow-hidden">
              <SignatureCanvas
                ref={sigCanvasRef}
                penColor="#0000A0"
                velocityFilterWeight={0.1}
                canvasProps={{ 
                  className: "w-full h-full min-h-[200px] touch-none cursor-crosshair",
                  style: { display: 'block' } 
                }}
                onBegin={() => setCanSave(true)}
              />
              {!canSave && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-bold text-slate-300">Assine aqui com o dedo ou mouse</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCanvasMode('view')}
                className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-[11px] font-black text-slate-400 transition-colors hover:border-slate-300 hover:text-slate-600"
              >
                CANCELAR
              </button>
              <button
                onClick={clearCanvas}
                disabled={!canSave}
                className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-[11px] font-black text-slate-400 transition-colors hover:border-red-200 hover:text-red-500 disabled:opacity-30"
              >
                <Trash2 size={14} />
                LIMPAR
              </button>
              <button
                onClick={salvarAssinatura}
                disabled={!canSave || salvarAssinaturaMutation.isPending}
                className="flex items-center gap-2 rounded-xl bg-[#0000A0] px-6 py-2.5 text-[11px] font-black text-white shadow-lg shadow-[#0000A0]/20 transition-all hover:bg-[#0000c0] disabled:opacity-40"
              >
                <Save size={14} />
                {salvarAssinaturaMutation.isPending ? 'SALVANDO...' : 'SALVAR ASSINATURA'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── DADOS PESSOAIS + SEGURANÇA ──────────────────────────────── */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">

        {/* Dados pessoais */}
        <div className="rounded-[32px] border border-slate-100 bg-white p-8 shadow-[0_8px_40px_rgba(0,0,0,0.04)]">
          <h2 className="mb-6 text-[10px] font-black tracking-[2px] text-slate-400">DADOS PESSOAIS</h2>
          <div className="space-y-4">
            <InfoRow icon={User} label="Nome" value={user?.nome || '—'} />
            <InfoRow icon={Hash} label="Usuário" value={user?.matricula || '—'} />
            <InfoRow icon={Mail} label="E-mail" value={user?.email || '—'} />
            <InfoRow icon={ShieldCheck} label="Perfil de acesso" value={user?.perfil?.nome || '—'} />
          </div>
        </div>

        {/* Segurança */}
        <div className="rounded-[32px] border border-slate-100 bg-white p-8 shadow-[0_8px_40px_rgba(0,0,0,0.04)]">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
              <Lock size={18} />
            </div>
            <div>
              <h2 className="text-sm font-black text-[#1E293B]">Alterar Senha</h2>
              <p className="text-[10px] font-bold text-slate-400">Informe sua senha atual para criar uma nova.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black tracking-widest text-slate-400">SENHA ATUAL</label>
              <div className="relative">
                <Input
                  type={showAtual ? 'text' : 'password'}
                  placeholder="Sua senha atual"
                  {...register('senha_atual', { required: 'Obrigatório' })}
                  className={cn("h-12 pr-10", errors.senha_atual && "border-red-400 focus-visible:ring-red-400")}
                />
                <button type="button" onClick={() => setShowAtual(v => !v)} className="absolute right-3 top-3.5 text-slate-400">
                  {showAtual ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.senha_atual && <p className="text-[10px] font-bold text-red-500">{errors.senha_atual.message as string}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black tracking-widest text-slate-400">NOVA SENHA</label>
              <div className="relative">
                <Input
                  type={showNova ? 'text' : 'password'}
                  placeholder="Nova senha"
                  {...register('senha_nova', { required: 'Obrigatório' })}
                  className="h-12 pr-10"
                />
                <button type="button" onClick={() => setShowNova(v => !v)} className="absolute right-3 top-3.5 text-slate-400">
                  {showNova ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {novaSenha && (
                <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1">
                  {requisitos.map(r => (
                    <div key={r.label} className="flex items-center gap-1.5">
                      {r.ok
                        ? <CheckCircle2 size={12} className="text-green-500 flex-shrink-0" />
                        : <XCircle size={12} className="text-slate-300 flex-shrink-0" />}
                      <span className={cn("text-[10px] font-bold", r.ok ? "text-green-600" : "text-slate-400")}>{r.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black tracking-widest text-slate-400">CONFIRMAR NOVA SENHA</label>
              <div className="relative">
                <Input
                  type={showConfirmar ? 'text' : 'password'}
                  placeholder="Confirme a nova senha"
                  {...register('confirmar', { required: 'Obrigatório' })}
                  className={cn("h-12 pr-10", errors.confirmar && "border-red-400 focus-visible:ring-red-400")}
                />
                <button type="button" onClick={() => setShowConfirmar(v => !v)} className="absolute right-3 top-3.5 text-slate-400">
                  {showConfirmar ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.confirmar && <p className="text-[10px] font-bold text-red-500">{errors.confirmar.message as string}</p>}
            </div>

            <Button
              type="submit"
              disabled={alterarSenhaMutation.isPending}
              className="h-12 px-8 shadow-lg shadow-[#0000A0]/20"
            >
              {alterarSenhaMutation.isPending ? 'SALVANDO...' : 'SALVAR NOVA SENHA'}
            </Button>
          </form>
        </div>
      </div>

      {/* ── ESTATÍSTICAS ────────────────────────────────────────────── */}
      <div className="rounded-[32px] border border-slate-100 bg-white p-8 shadow-[0_8px_40px_rgba(0,0,0,0.04)]">
        <h2 className="mb-6 text-[10px] font-black tracking-[2px] text-slate-400">ESTATÍSTICAS</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard icon={MoveHorizontal} value={totalTecnico} label="Como técnico" color="blue" />
          <StatCard icon={CheckCircle2} value={totalGestor} label="Como gestor" color="green" />
          <StatCard icon={Activity} value={totalRegistros} label="Total registros" color="slate" />
          {ultimaMov ? (
            <div className="flex flex-col gap-2 rounded-2xl bg-slate-50 p-4">
              <Activity size={18} className="text-slate-400" />
              <p className="text-sm font-black text-[#1E293B] leading-tight">
                {format(safeParseDate(ultimaMov.data_movimentacao) || new Date(), "dd/MM/yy HH:mm", { locale: ptBR })}
              </p>
              <p className="text-[10px] font-black tracking-wide text-slate-500">ÚLTIMA ATIV.</p>
            </div>
          ) : (
            <StatCard icon={Activity} value={0} label="Última ativ." color="slate" />
          )}
        </div>
      </div>

      {/* ── ÚLTIMAS ATIVIDADES ──────────────────────────────────────── */}
      <div className="rounded-[32px] border border-slate-100 bg-white p-8 shadow-[0_8px_40px_rgba(0,0,0,0.04)]">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-[10px] font-black tracking-[2px] text-slate-400">ÚLTIMAS ATIVIDADES</h2>
          <span className="text-[10px] font-bold text-slate-300">ÚLTIMAS {minhasMovs.length}</span>
        </div>

        {isLoadingMovs ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-[#0000A0] border-t-transparent" />
          </div>
        ) : minhasMovs.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 text-center">
            <Activity size={28} className="mb-2 text-slate-300" />
            <p className="text-xs font-bold text-slate-400">Nenhuma movimentação registrada.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {minhasMovs.map((mov: any) => {
              const ativo = ativoMap[mov.equipamento_id];
              const isGestor = mov.recebedor_id === user?.id;
              return (
                <div key={mov.id} className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-[#F8FAFC] px-4 py-3">
                  <div className={cn(
                    "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl",
                    isGestor ? "bg-green-50 text-green-500" : "bg-blue-50 text-[#0000A0]"
                  )}>
                    {isGestor ? <CheckCircle2 size={16} /> : <MoveHorizontal size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-[#1E293B] truncate">
                      {ativo ? `${ativo.marca} ${ativo.modelo}` : `Equipamento #${mov.equipamento_id}`}
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                      <span className="truncate">{locLabel(mov.loc_origem_id)}</span>
                      <ArrowRight size={10} className="flex-shrink-0" />
                      <span className="truncate">{locLabel(mov.loc_destino_id)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end flex-shrink-0">
                    <span className="text-[10px] font-black text-slate-400">
                      {format(safeParseDate(mov.data_movimentacao) || new Date(), 'dd/MM/yy', { locale: ptBR })}
                    </span>
                    <span className={cn(
                      "text-[9px] font-black tracking-wide",
                      isGestor ? "text-green-500" : "text-[#0000A0]"
                    )}>
                      {isGestor ? 'GESTOR' : 'TÉCNICO'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <FeedbackModal
        isOpen={feedback.open}
        onClose={() => setFeedback(f => ({ ...f, open: false }))}
        success={feedback.success}
        title={feedback.title}
        message={feedback.message}
      />
    </div>
  );
};

// ── Sub-components ────────────────────────────────────────────────────────────
const InfoRow = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
  <div className="flex items-center gap-4">
    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
      <Icon size={16} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-black tracking-widest text-slate-400">{label.toUpperCase()}</p>
      <p className="text-sm font-bold text-[#1E293B] truncate">{value}</p>
    </div>
  </div>
);

const StatCard = ({ icon: Icon, value, label, color }: { icon: any; value: number; label: string; color: 'blue' | 'green' | 'slate' }) => (
  <div className={cn(
    "flex flex-col gap-2 rounded-2xl p-4",
    color === 'blue' ? "bg-blue-50" : color === 'green' ? "bg-green-50" : "bg-slate-50"
  )}>
    <Icon size={18} className={color === 'blue' ? "text-[#0000A0]" : color === 'green' ? "text-green-600" : "text-slate-400"} />
    <p className={cn("text-3xl font-black", color === 'blue' ? "text-[#0000A0]" : color === 'green' ? "text-green-600" : "text-slate-500")}>{value}</p>
    <p className="text-[10px] font-black tracking-wide text-slate-500">{label.toUpperCase()}</p>
  </div>
);
