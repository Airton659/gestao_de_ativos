import { useQuery } from '@tanstack/react-query';
import { useState, useRef, useLayoutEffect } from 'react';
import { api } from '@/lib/api';
import { Package, ArrowLeftRight, MapPin, DollarSign, Clock, ChevronRight, ShieldCheck, FileDown, Camera, X, Mail, Loader2 } from 'lucide-react';
import { DataTable } from '@/components/ui/DataTable';
import { ColumnDef } from '@tanstack/react-table';
import { cn, safeParseDate } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AtivoTooltip } from '@/components/ativos/AtivoTooltip';

interface DashboardStats {
  total_ativos: number;
  total_movimentacoes: number;
  total_locais: number;
  valor_total: number;
  recent_movements: RecentMovement[];
}

interface RecentMovement {
  id: number;
  equipamento_id: number;
  lote_id?: string;
  has_termo: boolean;
  has_foto: boolean;
  patrimonio?: string;
  origem?: string;
  destino?: string;
  tecnico?: string;
  gestor?: string;
  data_iso?: string;
  // Extra fields for tooltip
  numero_patrimonio?: string;
  marca?: string;
  modelo?: string;
  numero_serie?: string;
  tipo?: string;
  is_proprio?: boolean;
  fornecedor_sigla?: string;
  fornecedor_nome?: string;
  estado_conservacao?: string;
  equipamento_status?: string;
}

const STATS_CARDS = [
  { label: 'Total Ativos', key: 'total_ativos', icon: Package, color: 'text-blue-500', bg: 'bg-blue-50', permission: 'equipamentos:ler' },
  { label: 'Movimentações', key: 'total_movimentacoes', icon: ArrowLeftRight, color: 'text-green-500', bg: 'bg-green-50', permission: 'movimentacoes:ler' },
  { label: 'Locais', key: 'total_locais', icon: MapPin, color: 'text-purple-500', bg: 'bg-purple-50', permission: 'localizacoes:ler' },
  { label: 'Valor Total', key: 'valor_total', icon: DollarSign, color: 'text-amber-500', bg: 'bg-amber-50', isCurrency: true, permission: 'equipamentos:ler' },
];

const TruncatedValue = ({ value, isCurrency }: { value: any; isCurrency?: boolean }) => {
  const [isTruncated, setIsTruncated] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  const checkTruncation = () => {
    if (ref.current) {
      setIsTruncated(ref.current.scrollWidth > ref.current.clientWidth);
    }
  };

  useLayoutEffect(() => {
    checkTruncation();
    window.addEventListener('resize', checkTruncation);
    return () => window.removeEventListener('resize', checkTruncation);
  }, [value]);

  return (
    <div className="flex items-center gap-1 overflow-hidden w-full" title={isTruncated ? value?.toString() : undefined}>
      <p
        ref={ref}
        className={cn(
          "mt-1 font-black text-[#1E293B] truncate flex-1 min-w-0",
          isCurrency ? "text-lg" : "text-3xl"
        )}
      >
        {value ?? 0}
      </p>
      {isTruncated && (
        <div className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-100 ring-1 ring-amber-200">
          <span className="text-[10px] font-black text-amber-600">!</span>
        </div>
      )}
    </div>
  );
};

export const Dashboard = () => {
  const { hasPermission } = useAuth();
  const [photoModal, setPhotoModal] = useState<{ loteId: string; url: string } | null>(null);
  const [loadingPhoto, setLoadingPhoto] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);

  const { data, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => (await api.get('/dashboard/stats/')).data,
  });

  const stats = data;
  const recentes: RecentMovement[] = data?.recent_movements || [];

  const visibleCards = STATS_CARDS.filter(card => !card.permission || hasPermission(card.permission));
  const canSeeRecent = hasPermission('movimentacoes:ler');
  const hasAnyDashboardPermission = visibleCards.length > 0 || canSeeRecent;

  const downloadTermo = async (loteId: string) => {
    const res = await api.get(`/movimentacoes/termo/${loteId}`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `termo_${loteId}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openPhoto = async (loteId: string) => {
    setLoadingPhoto(loteId);
    try {
      const res = await api.get(`/movimentacoes/foto-confirmacao/${loteId}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      setPhotoModal({ loteId, url });
    } catch {
      // foto não disponível
    } finally {
      setLoadingPhoto(null);
    }
  };

  const closePhoto = () => {
    if (photoModal) URL.revokeObjectURL(photoModal.url);
    setPhotoModal(null);
  };

  const sendEmail = async (loteId: string) => {
    setSendingEmail(loteId);
    try {
      await api.post(`/movimentacoes/enviar-termo/${loteId}`);
      alert("E-mail enviado com sucesso!");
    } catch (err: any) {
      const detail = err.response?.data?.detail || "Erro ao enviar e-mail.";
      alert(`Erro: ${detail}`);
    } finally {
      setSendingEmail(null);
    }
  };

  const columns: ColumnDef<RecentMovement>[] = [
    {
      accessorKey: 'patrimonio',
      header: 'ATIVO',
      cell: ({ row }) => {
        const m = row.original;
        // Construct a partial Ativo object for the tooltip
        const ativo = {
          id: m.equipamento_id,
          numero_patrimonio: m.numero_patrimonio,
          marca: m.marca,
          modelo: m.modelo,
          numero_serie: m.numero_serie,
          tipo: m.tipo,
          is_proprio: m.is_proprio,
          fornecedor_sigla: m.fornecedor_sigla,
          estado_conservacao: m.estado_conservacao,
          status: m.equipamento_status,
          fornecedor: m.fornecedor_nome ? { nome_empresa: m.fornecedor_nome, sigla: m.fornecedor_sigla } : null
        } as any;

        return (
          <AtivoTooltip ativo={ativo}>
            <div className="flex items-center gap-2 cursor-help">
              <Package size={14} className="text-[#0000A0] shrink-0" />
              <span className="font-black text-[#1E3A8A]">
                {m.patrimonio || '--'}
              </span>
            </div>
          </AtivoTooltip>
        );
      },
    },
    {
      accessorKey: 'tipo',
      header: 'CATEGORIA',
      cell: ({ row }) => (
        <div className="inline-flex rounded-lg bg-slate-100 px-3 py-1 text-[10px] font-black tracking-wide text-slate-500">
          {row.original.tipo?.toUpperCase() || 'N/A'}
        </div>
      ),
    },
    {
      id: 'origem',
      header: 'ORIGEM',
      cell: ({ row }) => (
        <span className="text-slate-600 font-medium">{row.original.origem || '--'}</span>
      ),
    },
    {
      id: 'destino',
      header: 'DESTINO',
      cell: ({ row }) => {
        const isTroca = row.original.lote_id?.startsWith('TR');
        return (
          <div className="flex flex-col">
            <span className="text-[#0000A0] font-bold">{row.original.destino || '--'}</span>
            {isTroca && (
              <span className="mt-1 inline-flex items-center gap-1 w-fit rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[9px] font-semibold text-blue-400">
                <ArrowLeftRight size={9} />
                troca de responsável
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: 'gestor',
      header: 'GESTOR RESPONSÁVEL',
      cell: ({ row }) => row.original.gestor || '--',
    },
    {
      id: 'data',
      header: 'DATA / HORA',
      cell: ({ row }) => {
        const date = safeParseDate(row.original.data_iso);
        if (!date) return '--';
        try {
          return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
        } catch {
          return row.original.data_iso || '--';
        }
      },
    },
    {
      id: 'tecnico',
      header: 'TÉCNICO',
      cell: ({ row }) => row.original.tecnico || '--',
    },
    {
      id: 'termo',
      header: 'TERMO',
      cell: ({ row }) => {
        const loteId = row.original.lote_id;
        if (!loteId || !row.original.has_termo) return <span className="text-slate-300 text-xs">—</span>;
        return (
          <button
            onClick={() => downloadTermo(loteId)}
            title="Baixar Termo de Responsabilidade"
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-black text-[#0000A0] transition-colors hover:bg-blue-50"
          >
            <FileDown size={14} />
            BAIXAR
          </button>
        );
      },
    },
    {
      id: 'foto',
      header: 'FOTO',
      cell: ({ row }) => {
        const loteId = row.original.lote_id;
        if (!loteId || !row.original.has_foto) return <span className="text-slate-300 text-xs">—</span>;
        const isLoading = loadingPhoto === loteId;
        return (
          <button
            onClick={() => openPhoto(loteId)}
            disabled={isLoading}
            title="Ver foto de confirmação"
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-black text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            {isLoading ? (
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
            ) : (
              <Camera size={14} />
            )}
            VER
          </button>
        );
      },
    },
    {
      id: 'acoes_email',
      header: 'E-MAIL',
      cell: ({ row }) => {
        const loteId = row.original.lote_id;
        if (!loteId) return <span className="text-slate-300 text-xs">—</span>;
        const isSending = sendingEmail === loteId;
        return (
          <button
            onClick={() => sendEmail(loteId)}
            disabled={isSending}
            title="Enviar termo por e-mail"
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-black text-amber-600 transition-colors hover:bg-amber-50 disabled:opacity-50"
          >
            {isSending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Mail size={14} />
            )}
            ENVIAR
          </button>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-8 h-full">

      {!hasAnyDashboardPermission ? (
        <div className="flex flex-col items-center justify-center py-24 text-center px-4 w-full max-w-sm mx-auto">
          <div className="h-20 w-20 bg-blue-50 rounded-[32px] flex items-center justify-center mb-6 text-[#0000A0]">
            <ShieldCheck size={40} strokeWidth={1.5} />
          </div>
          <h2 className="text-xl font-black text-[#1E293B] mb-3 uppercase tracking-tight">Bem-vindo ao Sistema de Gestão de Ativos</h2>
          <p className="text-sm font-medium text-slate-400 leading-relaxed italic">
            Seu perfil de acesso está ativo, mas você não tem permissão para visualizar as estatísticas e indicadores deste dashboard.
          </p>
          <div className="mt-8 pt-8 border-t border-slate-100 w-full">
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-loose">
              Para visualizar os ativos e movimentações,<br/> Solicite acesso às permissões de leitura.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* STATS GRID */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {visibleCards.map((card, idx) => {
              let value = stats ? (stats as any)[card.key] : 0;
              if (card.isCurrency && value) {
                value = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
              }

              return (
                <div
                  key={idx}
                  className="flex items-center gap-4 rounded-3xl border border-slate-100 bg-white p-5 shadow-[0_20px_40px_rgba(0,0,0,0.02)] transition-transform hover:-translate-y-1"
                >
                  <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${card.bg}`}>
                    <card.icon size={22} className={card.color} strokeWidth={2.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black tracking-[1.5px] text-[#94A3B8] truncate">
                      {card.label.toUpperCase()}
                    </p>
                    {isLoading ? (
                      <div className="mt-2 h-8 w-16 animate-pulse rounded bg-slate-100" />
                    ) : (
                      <TruncatedValue value={value} isCurrency={card.isCurrency} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* RECENT MOVEMENTS TABLE */}
          {canSeeRecent && (
            <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-[0_20px_40px_rgba(0,0,0,0.02)]">
              <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EFF6FF]">
                    <Clock size={20} className="text-[#0000A0]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-[#1E293B]">Movimentações Recentes</h2>
                    <p className="text-xs font-bold text-slate-400">Últimos ativos movimentados no sistema</p>
                  </div>
                </div>
                <Link to="/historico">
                  <Button variant="ghost" className="text-[11px] font-black text-[#0000A0] hover:bg-blue-50 sm:ml-0 -ml-2">
                    VER TUDO <ChevronRight size={14} className="ml-1" />
                  </Button>
                </Link>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-100">
                <DataTable
                  columns={columns}
                  data={recentes}
                  isLoading={isLoading}
                  emptyMessage="Nenhuma movimentação recente."
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* PHOTO MODAL */}
      {photoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={closePhoto}
        >
          <div
            className="relative max-w-lg w-full rounded-3xl overflow-hidden bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closePhoto}
              className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
            >
              <X size={18} />
            </button>
            <img
              src={photoModal.url}
              alt="Foto de confirmação"
              className="w-full object-contain max-h-[80vh]"
            />
            <div className="px-6 py-4 border-t border-slate-100">
              <p className="text-xs font-bold text-slate-400">Foto de confirmação — Lote {photoModal.loteId.slice(0, 8)}...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
