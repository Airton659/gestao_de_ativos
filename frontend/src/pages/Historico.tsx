import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Package, FilterX, Search, FileDown, Camera, X, Mail, Loader2,
  SlidersHorizontal, ChevronDown, ArrowLeftRight,
} from 'lucide-react';
import { DataTable } from '@/components/ui/DataTable';
import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn, safeParseDate } from '@/lib/utils';
import { AtivoTooltip } from '@/components/ativos/AtivoTooltip';
import { Pagination } from '@/components/ui/Pagination';

interface Movimentacao {
  id: number;
  data_movimentacao: string;
  equipamento_id: number;
  equipamento_patrimonio?: string;
  equipamento_marca?: string;
  equipamento_modelo?: string;
  loc_origem_id?: number;
  loc_origem_dsc?: string;
  loc_destino_id?: number;
  loc_destino_dsc?: string;
  tecnico_id: number;
  tecnico_nome?: string;
  recebedor_id?: number;
  recebedor_nome?: string;
  lote_id?: string;
  termo_pdf_url?: string;
  foto_assinatura_url?: string;
  marca?: string;
  modelo?: string;
  numero_serie?: string;
  tipo?: string;
  is_proprio?: boolean;
  estado_conservacao?: string;
  equipamento_status?: string;
  fornecedor_nome?: string;
  fornecedor_sigla?: string;
}

const PAGE_SIZE = 25;

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export const Historico = () => {
  const topRef = useRef<HTMLDivElement>(null);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCategorias, setFilterCategorias] = useState<string[]>([]);
  const [filterOrigem, setFilterOrigem] = useState('');
  const [filterDestino, setFilterDestino] = useState('');
  const [filterGestor, setFilterGestor] = useState('');
  const [filterTecnico, setFilterTecnico] = useState('');
  const [filterDataDe, setFilterDataDe] = useState('');
  const [filterDataAte, setFilterDataAte] = useState('');
  const [page, setPage] = useState(1);

  const [photoModal, setPhotoModal] = useState<{ loteId: string; url: string } | null>(null);
  const [loadingPhoto, setLoadingPhoto] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);

  const debouncedSearch = useDebounce(search, 400);
  const debouncedOrigem = useDebounce(filterOrigem, 400);
  const debouncedDestino = useDebounce(filterDestino, 400);
  const debouncedGestor = useDebounce(filterGestor, 400);
  const debouncedTecnico = useDebounce(filterTecnico, 400);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterCategorias.join(','), debouncedOrigem, debouncedDestino, debouncedGestor, debouncedTecnico, filterDataDe, filterDataAte]);

  const { data: tiposDisponiveis = [] } = useQuery<string[]>({
    queryKey: ['movimentacoes-tipos'],
    queryFn: async () => (await api.get('/movimentacoes/tipos/')).data,
    staleTime: 30 * 60 * 1000,
  });

  const { data, isLoading: isLoadingHist } = useQuery<{ items: Movimentacao[]; total: number; page: number; page_size: number }>({
    queryKey: ['historico', page, debouncedSearch, filterCategorias, debouncedOrigem, debouncedDestino, debouncedGestor, debouncedTecnico, filterDataDe, filterDataAte],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('page_size', String(PAGE_SIZE));
      if (debouncedSearch) params.set('search', debouncedSearch);
      filterCategorias.forEach((c) => params.append('tipos', c));
      if (debouncedOrigem) params.set('origem', debouncedOrigem);
      if (debouncedDestino) params.set('destino', debouncedDestino);
      if (debouncedGestor) params.set('gestor', debouncedGestor);
      if (debouncedTecnico) params.set('tecnico', debouncedTecnico);
      if (filterDataDe) params.set('data_de', filterDataDe);
      if (filterDataAte) params.set('data_ate', filterDataAte);
      const res = await api.get(`/movimentacoes/paginated/?${params}`);
      return res.data;
    },
    staleTime: 2 * 60 * 1000,
    placeholderData: (prev) => prev,
  });

  const historico = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const hasFilters = !!(
    search || filterCategorias.length || filterOrigem || filterDestino ||
    filterGestor || filterTecnico || filterDataDe || filterDataAte
  );

  const activeFilterCount = [
    filterCategorias.length > 0,
    !!(filterOrigem || filterDestino),
    !!(filterGestor || filterTecnico),
    !!(filterDataDe || filterDataAte),
  ].filter(Boolean).length;

  const clearFilters = () => {
    setSearch('');
    setFilterCategorias([]);
    setFilterOrigem('');
    setFilterDestino('');
    setFilterGestor('');
    setFilterTecnico('');
    setFilterDataDe('');
    setFilterDataAte('');
  };

  const handlePageChange = (p: number) => {
    setPage(p);
    setTimeout(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const getLocLabel = (dsc?: string) => dsc || '--';
  const getUserLabel = (nome?: string) => nome || '--';

  const downloadTermo = async (loteId: string) => {
    const res = await api.get(`/movimentacoes/termo/${loteId}`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `termo_${loteId}.pdf`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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

  const sendEmail = async (loteId: string) => {
    setSendingEmail(loteId);
    try {
      await api.post(`/movimentacoes/enviar-termo/${loteId}`);
      alert('E-mail enviado com sucesso!');
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'Erro ao enviar e-mail.';
      alert(`Erro: ${detail}`);
    } finally {
      setSendingEmail(null);
    }
  };

  const closePhoto = () => {
    if (photoModal) URL.revokeObjectURL(photoModal.url);
    setPhotoModal(null);
  };

  const columns: ColumnDef<Movimentacao>[] = [
    {
      accessorKey: 'equipamento_patrimonio',
      header: 'ATIVO',
      cell: ({ row }) => {
        const m = row.original;
        const ativo = {
          id: m.equipamento_id,
          numero_patrimonio: m.equipamento_patrimonio,
          marca: m.equipamento_marca,
          modelo: m.equipamento_modelo,
          numero_serie: m.numero_serie,
          tipo: m.tipo,
          is_proprio: m.is_proprio,
          fornecedor_sigla: m.fornecedor_sigla,
          estado_conservacao: m.estado_conservacao,
          status: m.equipamento_status,
          fornecedor: m.fornecedor_nome ? { nome_empresa: m.fornecedor_nome, sigla: m.fornecedor_sigla } : null,
        } as any;
        return (
          <AtivoTooltip ativo={ativo}>
            <div className="flex items-center gap-2 cursor-help">
              <Package size={14} className="text-[#0000A0] shrink-0" />
              <span className="font-black text-[#1E3A8A]">
                {m.equipamento_patrimonio || '--'}
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
      cell: ({ row }) => getLocLabel(row.original.loc_origem_dsc),
    },
    {
      id: 'destino',
      header: 'DESTINO',
      cell: ({ row }) => {
        const isTroca = row.original.lote_id?.startsWith('TR');
        return (
          <div className="flex flex-col">
            <span className="text-[#0000A0] font-bold">
              {getLocLabel(row.original.loc_destino_dsc)}
            </span>
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
      id: 'recebedor',
      header: 'GESTOR RESPONSÁVEL',
      cell: ({ row }) => getUserLabel(row.original.recebedor_nome),
    },
    {
      accessorKey: 'data_movimentacao',
      header: 'DATA / HORA',
      cell: ({ row }) => {
        const date = safeParseDate(row.original.data_movimentacao);
        if (!date) return '--';
        try {
          return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
        } catch {
          return row.original.data_movimentacao;
        }
      },
    },
    {
      id: 'tecnico',
      header: 'TÉCNICO',
      cell: ({ row }) => getUserLabel(row.original.tecnico_nome),
    },
    {
      id: 'termo',
      header: 'TERMO',
      cell: ({ row }) => {
        const loteId = row.original.lote_id;
        if (!loteId || !row.original.termo_pdf_url) return <span className="text-slate-300 text-xs">—</span>;
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
        if (!loteId || !row.original.foto_assinatura_url) return <span className="text-slate-300 text-xs">—</span>;
        const isLoadingFoto = loadingPhoto === loteId;
        return (
          <button
            onClick={() => openPhoto(loteId)}
            disabled={isLoadingFoto}
            title="Ver foto de confirmação"
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-black text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            {isLoadingFoto
              ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
              : <Camera size={14} />}
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
        if (!loteId || !row.original.termo_pdf_url) return <span className="text-slate-300 text-xs">—</span>;
        const isSending = sendingEmail === loteId;
        return (
          <button
            onClick={() => sendEmail(loteId)}
            disabled={isSending}
            title="Enviar termo por e-mail"
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-black text-amber-600 transition-colors hover:bg-amber-50 disabled:opacity-50"
          >
            {isSending ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
            ENVIAR
          </button>
        );
      },
    },
  ];

  return (
    <div ref={topRef} className="flex flex-col gap-6">

      {/* ── PAINEL DE BUSCA E FILTROS ── */}
      <div className="rounded-[24px] border border-slate-100 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.02)] overflow-hidden">

        {/* Linha principal: busca + toggle filtros */}
        <div className="flex items-center gap-3 p-5">
          <div className="relative min-w-0 flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Patrimônio, categoria, origem, destino, gestor ou técnico..."
              className="h-10 w-full rounded-xl bg-[#F8FAFC] pl-9 pr-4 text-[11px] font-bold outline-none ring-[#0000A0] focus:ring-2 border border-transparent focus:border-blue-100"
            />
          </div>

          <button
            onClick={() => setFiltersOpen(o => !o)}
            className={cn(
              'flex items-center gap-2 h-10 rounded-xl px-4 text-[10px] font-black tracking-wide border transition-all',
              filtersOpen
                ? 'bg-[#0000A0] text-white border-[#0000A0]'
                : activeFilterCount > 0
                  ? 'bg-blue-50 text-[#0000A0] border-blue-200'
                  : 'bg-[#F8FAFC] text-slate-500 border-slate-200 hover:bg-slate-100'
            )}
          >
            <SlidersHorizontal size={13} />
            FILTROS
            {activeFilterCount > 0 && (
              <span className={cn(
                'flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black',
                filtersOpen ? 'bg-white text-[#0000A0]' : 'bg-[#0000A0] text-white'
              )}>
                {activeFilterCount}
              </span>
            )}
            <ChevronDown size={12} className={cn('transition-transform', filtersOpen && 'rotate-180')} />
          </button>
        </div>

        {/* Painel colapsável */}
        {filtersOpen && (
          <div className="border-t border-slate-50 px-5 py-4 flex flex-col gap-4">

            {/* CATEGORIA chips */}
            {tiposDisponiveis.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black tracking-widest text-slate-400 shrink-0 w-20">CATEGORIA</span>
                <div className="flex flex-1 items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
                  <button
                    onClick={() => setFilterCategorias([])}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-[9px] font-black tracking-wide transition-all shrink-0',
                      filterCategorias.length === 0
                        ? 'bg-[#0000A0] text-white border-[#0000A0]'
                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                    )}
                  >
                    TODOS
                  </button>
                  {tiposDisponiveis.map((cat) => {
                    const active = filterCategorias.includes(cat);
                    return (
                      <button
                        key={cat}
                        onClick={() => setFilterCategorias(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])}
                        className={cn(
                          'rounded-full border px-3 py-1.5 text-[9px] font-black tracking-wide transition-all shrink-0 whitespace-nowrap',
                          active
                            ? 'bg-[#0000A0] text-white border-[#0000A0]'
                            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                        )}
                      >
                        {cat.toUpperCase()}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Inputs de texto + datas */}
            <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-slate-50">
              {[
                { placeholder: 'Origem (sala, bloco ou campus)...', value: filterOrigem, onChange: setFilterOrigem },
                { placeholder: 'Destino (sala, bloco ou campus)...', value: filterDestino, onChange: setFilterDestino },
                { placeholder: 'Gestor responsável...', value: filterGestor, onChange: setFilterGestor },
                { placeholder: 'Técnico...', value: filterTecnico, onChange: setFilterTecnico },
              ].map(({ placeholder, value, onChange }) => (
                <div key={placeholder} className="relative min-w-0 flex-1">
                  <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className={cn(
                      'h-9 w-full rounded-xl border pl-8 pr-3 text-[11px] font-bold outline-none ring-[#0000A0] focus:ring-2 transition-all',
                      value ? 'border-blue-200 bg-blue-50 text-[#1E3A8A]' : 'border-slate-200 bg-[#F8FAFC] text-slate-500'
                    )}
                  />
                </div>
              ))}
            </div>

            {/* Datas + limpar */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-black tracking-widest text-slate-400">PERÍODO</span>
                <input
                  type="date"
                  value={filterDataDe}
                  onChange={(e) => setFilterDataDe(e.target.value)}
                  className={cn(
                    'h-9 rounded-xl border px-3 text-[11px] font-bold outline-none ring-[#0000A0] focus:ring-2 transition-all',
                    filterDataDe ? 'border-blue-200 bg-blue-50 text-[#1E3A8A]' : 'border-slate-200 bg-[#F8FAFC] text-slate-500'
                  )}
                />
                <span className="text-[10px] font-black text-slate-300">ATÉ</span>
                <input
                  type="date"
                  value={filterDataAte}
                  onChange={(e) => setFilterDataAte(e.target.value)}
                  className={cn(
                    'h-9 rounded-xl border px-3 text-[11px] font-bold outline-none ring-[#0000A0] focus:ring-2 transition-all',
                    filterDataAte ? 'border-blue-200 bg-blue-50 text-[#1E3A8A]' : 'border-slate-200 bg-[#F8FAFC] text-slate-500'
                  )}
                />
              </div>

              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[10px] font-black text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors ml-auto"
                >
                  <FilterX size={13} />
                  LIMPAR
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* COUNTER */}
      <div className="px-1">
        <span className="text-xl font-black text-[#1E293B]">{total}</span>
        <span className="text-[10px] font-black tracking-widest text-slate-400 ml-2">
          {hasFilters ? 'MOVIMENTAÇÕES ENCONTRADAS' : 'MOVIMENTAÇÕES NO HISTÓRICO'}
        </span>
      </div>

      {/* TABLE */}
      <div className="rounded-[32px] border border-slate-200 bg-white overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.02)]">
        <DataTable
          columns={columns}
          data={historico}
          isLoading={isLoadingHist}
          emptyMessage="Nenhuma movimentação encontrada."
        />
        {totalPages > 1 && (
          <div className="border-t border-slate-50 px-4 py-3">
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              pageSize={PAGE_SIZE}
              onPageChange={handlePageChange}
            />
          </div>
        )}
      </div>

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
              <p className="text-xs font-bold text-slate-400">
                Foto de confirmação — Lote {photoModal.loteId.slice(0, 8)}...
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
