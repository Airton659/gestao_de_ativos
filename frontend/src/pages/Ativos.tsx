import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Package, Plus, Search, Edit2, Trash2, AlertTriangle,
  ToggleLeft, ToggleRight, FilterX, SlidersHorizontal, ChevronDown, ArrowLeftRight
} from 'lucide-react';
import { formatLocal, cn } from '@/lib/utils';
import { DataTable } from '@/components/ui/DataTable';
import { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/Modal';
import { FeedbackModal } from '@/components/ui/FeedbackModal';
import { AtivoModal } from '@/components/ativos/AtivoModal';
import { AtivoDetalhesModal } from '@/components/ativos/AtivoDetalhesModal';
import { TrocaResponsabilidadeModal } from '@/components/ativos/TrocaResponsabilidadeModal';
import { Pagination } from '@/components/ui/Pagination';
import { useAuth } from '@/contexts/AuthContext';

export interface Ativo {
  id: number;
  nome?: string;
  patrimonio?: string;
  numero_patrimonio?: string;
  numero_serie?: string;
  marca?: string;
  modelo?: string;
  tipo: string;
  estado_conservacao?: string;
  ativo?: boolean;
  is_proprio?: boolean;
  data_aquisicao?: string;
  valor?: number;
  observacoes?: string;
  responsavel?: { id: number; nome: string; matricula?: string };
  localizacao?: { id: number; campus: string; bloco?: string; sala: string };
  fornecedor?: { id: number; nome_empresa: string };
  fornecedor_sigla?: string;
  fotos?: string[];
  especificacoes?: Record<string, string>;
}

interface Fornecedor {
  id: number;
  sigla?: string;
  nome_empresa?: string;
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

export const Ativos = () => {
  const topRef = useRef<HTMLDivElement>(null);

  // Filtros
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterProprio, setFilterProprio] = useState<string[]>([]); // 'PROPRIO' | 'TERCEIRO'
  const [filterFornecedorId, setFilterFornecedorId] = useState<number | null>(null);
  const [filterCategorias, setFilterCategorias] = useState<string[]>([]);
  const [filterConservacao, setFilterConservacao] = useState<string[]>([]);
  const [filterHasPhoto, setFilterHasPhoto] = useState<string>('TODOS');
  const [filterLocal, setFilterLocal] = useState('');
  const [filterResponsavel, setFilterResponsavel] = useState('');
  const [filterDataDe, setFilterDataDe] = useState('');
  const [filterDataAte, setFilterDataAte] = useState('');
  const [page, setPage] = useState(1);

  // UI
  const [modalOpen, setModalOpen] = useState(false);
  const [detalhesOpen, setDetalhesOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [trocaResponsabilidadeOpen, setTrocaResponsabilidadeOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ open: boolean; success: boolean; title: string; message: string; loteId?: string }>({ open: false, success: true, title: '', message: '' });
  const [selectedAtivo, setSelectedAtivo] = useState<Ativo | null>(null);
  const [ativoToDelete, setAtivoToDelete] = useState<Ativo | null>(null);

  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const debouncedSearch = useDebounce(search, 400);
  const debouncedLocal = useDebounce(filterLocal, 400);
  const debouncedResponsavel = useDebounce(filterResponsavel, 400);

  // Resetar página ao mudar qualquer filtro
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterStatus.join(','), filterProprio.join(','), filterFornecedorId,
      filterCategorias.join(','), debouncedLocal, debouncedResponsavel,
      filterDataDe, filterDataAte, filterConservacao.join(','), filterHasPhoto]);

  // Resetar fornecedor quando não for filtro de terceiro
  useEffect(() => {
    if (!filterProprio.includes('TERCEIRO')) setFilterFornecedorId(null);
  }, [filterProprio]);

  // Tipos disponíveis
  const { data: tiposDisponiveis = [] } = useQuery<string[]>({
    queryKey: ['equipamentos-tipos'],
    queryFn: async () => (await api.get('/equipamentos/tipos/')).data,
    staleTime: 30 * 60 * 1000,
  });

  // Fornecedores (para chips de terceiros)
  const { data: fornecedores = [] } = useQuery<Fornecedor[]>({
    queryKey: ['fornecedores'],
    queryFn: async () => (await api.get('/fornecedores/')).data,
    staleTime: 30 * 60 * 1000,
  });

  // Query principal paginada
  const { data, isLoading } = useQuery<{ items: Ativo[]; total: number; page: number; page_size: number }>({
    queryKey: ['ativos', page, debouncedSearch, filterStatus, filterProprio, filterFornecedorId,
               filterCategorias, debouncedLocal, debouncedResponsavel,
               filterDataDe, filterDataAte, filterConservacao, filterHasPhoto],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('page_size', String(PAGE_SIZE));
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (filterStatus.length === 1) params.set('status', filterStatus[0] === 'ATIVOS' ? 'ATIVO' : 'INATIVO');
      if (filterProprio.length === 1) params.set('is_proprio', filterProprio[0] === 'PROPRIO' ? 'true' : 'false');
      if (filterFornecedorId) params.set('fornecedor_id', String(filterFornecedorId));
      filterCategorias.forEach((c) => params.append('tipos', c));
      filterConservacao.forEach((c) => params.append('conservacoes', c));
      if (debouncedLocal) params.set('local', debouncedLocal);
      if (debouncedResponsavel) params.set('responsavel', debouncedResponsavel);
      if (filterDataDe) params.set('data_de', filterDataDe);
      if (filterDataAte) params.set('data_ate', filterDataAte);
      if (filterHasPhoto !== 'TODOS') params.set('has_foto', filterHasPhoto);
      const res = await api.get(`/equipamentos/paginated/?${params}`);
      return res.data;
    },
    staleTime: 2 * 60 * 1000,
    placeholderData: (prev) => prev,
  });

  const ativos = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const hasFilters = !!(
    search || filterCategorias.length || filterStatus.length || filterProprio.length ||
    filterFornecedorId || filterLocal || filterResponsavel ||
    filterDataDe || filterDataAte || filterConservacao.length || filterHasPhoto !== 'TODOS'
  );

  const activeFilterCount = [
    filterStatus.length > 0,
    filterProprio.length > 0,
    filterFornecedorId !== null,
    filterCategorias.length > 0,
    filterConservacao.length > 0,
    filterHasPhoto !== 'TODOS',
    !!(filterLocal || filterResponsavel),
    !!(filterDataDe || filterDataAte),
  ].filter(Boolean).length;

  const clearFilters = () => {
    setSearch('');
    setFilterStatus([]);
    setFilterProprio([]);
    setFilterFornecedorId(null);
    setFilterCategorias([]);
    setFilterLocal('');
    setFilterResponsavel('');
    setFilterDataDe('');
    setFilterDataAte('');
    setFilterConservacao([]);
    setFilterHasPhoto('TODOS');
  };

  const handlePageChange = (p: number) => {
    setPage(p);
    setTimeout(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const toggleMutation = useMutation({
    mutationFn: (a: Ativo) => api.put(`/equipamentos/${a.id}/`, { ativo: !a.ativo }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ativos'] }),
    onError: (err: any) => {
      const detail = err.response?.data?.detail || 'Erro ao alterar status.';
      setFeedback({ open: true, success: false, title: 'ERRO', message: detail });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/equipamentos/${id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ativos'] });
      queryClient.invalidateQueries({ queryKey: ['equipamentos-tipos'] });
      const nome = `${ativoToDelete?.marca || ''} ${ativoToDelete?.modelo || ''}`.trim();
      setAtivoToDelete(null);
      setFeedback({ open: true, success: true, title: 'ATIVO EXCLUÍDO', message: `<span class="text-slate-700 font-black">${nome}</span> foi removido permanentemente do sistema.` });
    },
    onError: (err: any) => {
      const detail = err.response?.data?.detail || 'Erro desconhecido ao excluir o ativo.';
      setAtivoToDelete(null);
      setFeedback({ open: true, success: false, title: 'ERRO AO EXCLUIR', message: detail });
    },
  });

  const columns: ColumnDef<Ativo>[] = [
    {
      accessorKey: 'nome',
      header: 'MARCA / MODELO',
      size: 250,
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Package size={14} />
          </div>
          <span className="font-black text-[#1E293B]">
            {row.original.marca || ''} {row.original.modelo || ''}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'patrimonio',
      header: 'PATRIMÔNIO / NS',
      cell: ({ row }) => {
        const a = row.original;
        const tombamento = a.patrimonio || a.numero_patrimonio || '--';
        const sigla = !a.is_proprio && a.fornecedor_sigla ? `${a.fornecedor_sigla} - ` : '';
        return (
          <span className="font-black text-[#0000A0]">
            {sigla}{tombamento}
          </span>
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
      accessorKey: 'local',
      header: 'LOCAL',
      cell: ({ row }) => {
        const loc = row.original.localizacao;
        if (!loc) return '--';
        return formatLocal(loc);
      },
    },
    {
      accessorKey: 'estado_conservacao',
      header: 'CONSERVAÇÃO',
      cell: ({ row }) => {
        const estado = row.original.estado_conservacao;
        if (!estado) return <span className="text-slate-300">—</span>;
        const map: Record<string, { label: string; color: string }> = {
          OTIMO:   { label: 'Ótimo',   color: 'bg-green-50 text-green-700' },
          BOM:     { label: 'Bom',     color: 'bg-blue-50 text-blue-700' },
          REGULAR: { label: 'Regular', color: 'bg-amber-50 text-amber-700' },
          RUIM:    { label: 'Ruim',    color: 'bg-orange-50 text-orange-700' },
          PESSIMO: { label: 'Péssimo', color: 'bg-red-50 text-red-700' },
        };
        const entry = map[estado.toUpperCase()] || { label: estado, color: 'bg-slate-100 text-slate-500' };
        return (
          <div className={`inline-flex rounded-lg px-3 py-1 text-[10px] font-black tracking-wide ${entry.color}`}>
            {entry.label}
          </div>
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'STATUS',
      cell: ({ row }) => {
        const ativo = row.original.ativo !== false;
        const colorClass = ativo ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700';
        return (
          <div className={`inline-flex rounded-xl px-3 py-1 text-[10px] font-black tracking-wide ${colorClass}`}>
            {ativo ? 'ATIVO' : 'INATIVO'}
          </div>
        );
      },
    },
    {
      id: 'acoes',
      header: () => <div className="text-center w-full">AÇÕES</div>,
      size: 130,
      cell: ({ row }) => (
        <div className="flex items-center justify-center gap-1">
          {hasPermission('movimentacoes:trocar-responsabilidade') && row.original.ativo !== false && (
            <button
              onClick={(e) => { e.stopPropagation(); setSelectedAtivo(row.original); setTrocaResponsabilidadeOpen(true); }}
              className="rounded-full p-2 text-[#0000A0] hover:bg-blue-50 transition-colors"
              title="Trocar Responsável"
            >
              <ArrowLeftRight size={16} strokeWidth={2.5} />
            </button>
          )}
          {hasPermission('equipamentos:editar') && (
            <button
              onClick={(e) => { e.stopPropagation(); setSelectedAtivo(row.original); setModalOpen(true); }}
              className="rounded-full p-2 text-blue-500 hover:bg-blue-50 transition-colors"
              title="Editar"
            >
              <Edit2 size={16} />
            </button>
          )}
          {hasPermission('equipamentos:editar') && (
            <button
              onClick={(e) => { e.stopPropagation(); toggleMutation.mutate(row.original); }}
              className={cn('p-2 rounded-full transition-colors',
                row.original.ativo !== false ? 'text-green-500 hover:bg-green-50' : 'text-slate-300 hover:bg-slate-50'
              )}
              title={row.original.ativo !== false ? 'Desativar' : 'Ativar'}
            >
              {row.original.ativo !== false ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
            </button>
          )}
          {hasPermission('equipamentos:excluir') && (
            <button
              onClick={(e) => { e.stopPropagation(); setAtivoToDelete(row.original); setDeleteConfirmOpen(true); }}
              className="rounded-full p-2 text-red-500 hover:bg-red-50 transition-colors"
              title="Excluir"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      ),
    },
  ];

  const showTerceiroChips = filterProprio.includes('TERCEIRO') && fornecedores.length > 0;

  return (
    <div ref={topRef} className="flex flex-col gap-6">
      {/* ── PAINEL DE BUSCA E FILTROS ── */}
      <div className="rounded-[24px] border border-slate-100 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.02)] overflow-hidden">

        {/* Linha principal: busca + toggle filtros + botão novo */}
        <div className="flex items-center gap-3 p-5">
          <div className="relative min-w-0 flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Patrimônio, marca ou modelo..."
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

          {hasPermission('equipamentos:criar') && (
            <Button
              onClick={() => { setSelectedAtivo(null); setModalOpen(true); }}
              className="h-10 px-4 text-xs shadow-lg shadow-[#0000A0]/20"
            >
              <Plus size={16} className="mr-2" />
              NOVO ATIVO
            </Button>
          )}
        </div>

        {/* Painel de filtros colapsável */}
        {filtersOpen && (
          <div className="border-t border-slate-50 px-5 py-4 flex flex-col gap-4">

            {/* Linha 1: STATUS + PROPRIEDADE + FOTOS */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              {/* Status */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black tracking-widest text-slate-400 shrink-0 w-20">STATUS</span>
                {(['ATIVOS', 'INATIVOS'] as const).map((s) => {
                  const active = filterStatus.includes(s);
                  return (
                    <button
                      key={s}
                      onClick={() => setFilterStatus(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}
                      className={cn(
                        'rounded-full border px-3 py-1 text-[9px] font-black tracking-wide transition-all',
                        s === 'ATIVOS'
                          ? (active ? 'bg-green-600 text-white border-green-600' : 'bg-white text-green-700 border-green-200 hover:bg-green-50')
                          : (active ? 'bg-red-500 text-white border-red-500' : 'bg-white text-red-600 border-red-200 hover:bg-red-50')
                      )}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>

              {/* Propriedade */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black tracking-widest text-slate-400 shrink-0 w-20">ORIGEM</span>
                {(['PROPRIO', 'TERCEIRO'] as const).map((p) => {
                  const label = p === 'PROPRIO' ? 'PRÓPRIO' : 'TERCEIRO';
                  const active = filterProprio.includes(p);
                  return (
                    <button
                      key={p}
                      onClick={() => setFilterProprio(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
                      className={cn(
                        'rounded-full border px-3 py-1 text-[9px] font-black tracking-wide transition-all',
                        active
                          ? 'bg-violet-600 text-white border-violet-600'
                          : 'bg-white text-violet-700 border-violet-200 hover:bg-violet-50'
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Fotos */}
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-[10px] font-black tracking-widest text-slate-400 shrink-0">FOTOS</span>
                <div className="flex rounded-lg bg-slate-100 p-0.5">
                  {['TODOS', 'SIM', 'NAO'].map(v => (
                    <button
                      key={v}
                      onClick={() => setFilterHasPhoto(v)}
                      className={cn(
                        'rounded-md px-3 py-1 text-[9px] font-black transition-all',
                        filterHasPhoto === v ? 'bg-white text-[#0000A0] shadow-sm' : 'text-slate-400 hover:text-slate-600'
                      )}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Chips de fornecedor (só quando TERCEIRO selecionado) */}
            {showTerceiroChips && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black tracking-widest text-slate-400 shrink-0 w-20">FORNECEDOR</span>
                <div className="flex flex-1 items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
                  <button
                    onClick={() => setFilterFornecedorId(null)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-[9px] font-black tracking-wide transition-all shrink-0',
                      filterFornecedorId === null
                        ? 'bg-violet-600 text-white border-violet-600'
                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                    )}
                  >
                    TODOS
                  </button>
                  {fornecedores.map((f) => {
                    const active = filterFornecedorId === f.id;
                    return (
                      <button
                        key={f.id}
                        onClick={() => setFilterFornecedorId(active ? null : f.id)}
                        className={cn(
                          'rounded-full border px-3 py-1 text-[9px] font-black tracking-wide transition-all shrink-0 whitespace-nowrap',
                          active
                            ? 'bg-violet-600 text-white border-violet-600'
                            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                        )}
                      >
                        {f.sigla || f.nome_empresa}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Linha 2: Categorias */}
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

            {/* Linha 3: Estado de conservação */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black tracking-widest text-slate-400 shrink-0 w-20">ESTADO</span>
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { val: 'OTIMO',   label: 'ÓTIMO',    color: 'bg-green-600 text-white border-green-600', idle: 'text-green-700 border-green-200 hover:bg-green-50' },
                  { val: 'BOM',     label: 'BOM',       color: 'bg-blue-600 text-white border-blue-600',   idle: 'text-blue-700 border-blue-200 hover:bg-blue-50' },
                  { val: 'REGULAR', label: 'REGULAR',   color: 'bg-amber-500 text-white border-amber-500', idle: 'text-amber-700 border-amber-200 hover:bg-amber-50' },
                  { val: 'RUIM',    label: 'RUIM',      color: 'bg-orange-500 text-white border-orange-500', idle: 'text-orange-700 border-orange-200 hover:bg-orange-50' },
                  { val: 'PESSIMO', label: 'PÉSSIMO',   color: 'bg-red-600 text-white border-red-600',     idle: 'text-red-700 border-red-200 hover:bg-red-50' },
                ].map(({ val, label, color, idle }) => {
                  const active = filterConservacao.includes(val);
                  return (
                    <button
                      key={val}
                      onClick={() => setFilterConservacao(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val])}
                      className={cn('rounded-full border px-3 py-1 text-[9px] font-black tracking-wide transition-all shrink-0', active ? color : `bg-white ${idle}`)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Linha 4: Inputs de texto + datas */}
            <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-slate-50">
              {[
                { placeholder: 'Sala, Bloco ou Campus...', label: 'LOCAL', value: filterLocal, onChange: setFilterLocal },
                { placeholder: 'Nome do responsável...', label: 'RESPONSÁVEL', value: filterResponsavel, onChange: setFilterResponsavel },
              ].map(({ placeholder, label, value, onChange }) => (
                <div key={label} className="relative min-w-0 flex-1">
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

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-black tracking-widest text-slate-400">AQUISIÇÃO</span>
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
      <div className="flex items-center gap-2 px-1">
        <span className="text-xl font-black text-[#1E293B]">{total}</span>
        <span className="text-[10px] font-black tracking-widest text-slate-400 pt-1">
          {hasFilters ? 'EQUIPAMENTOS ENCONTRADOS' : 'EQUIPAMENTOS NO SISTEMA'}
        </span>
      </div>

      {/* TABLE */}
      <div className="rounded-[24px] border border-slate-200 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.02)] overflow-hidden">
        <DataTable
          columns={columns}
          data={ativos}
          isLoading={isLoading}
          emptyMessage="Nenhum ativo encontrado."
          onRowClick={(ativo) => {
            setSelectedAtivo(ativo);
            setDetalhesOpen(true);
          }}
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

      {/* MODAIS */}
      {modalOpen && (
        <AtivoModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          ativo={selectedAtivo}
          onSaved={(isEdit, nome) => setFeedback({
            open: true,
            success: true,
            title: isEdit ? 'ATIVO ATUALIZADO' : 'ATIVO CADASTRADO',
            message: isEdit
              ? `<span class="text-slate-700 font-black">${nome}</span> foi atualizado com sucesso.`
              : `<span class="text-slate-700 font-black">${nome}</span> foi cadastrado no sistema.`,
          })}
        />
      )}

      {detalhesOpen && selectedAtivo && (
        <AtivoDetalhesModal
          isOpen={detalhesOpen}
          onClose={() => setDetalhesOpen(false)}
          ativo={selectedAtivo}
        />
      )}

      {trocaResponsabilidadeOpen && selectedAtivo && (
        <TrocaResponsabilidadeModal
          isOpen={trocaResponsabilidadeOpen}
          onClose={() => setTrocaResponsabilidadeOpen(false)}
          ativo={selectedAtivo}
          onSuccess={(nome, loteId) => setFeedback({
            open: true,
            success: true,
            title: 'RESPONSABILIDADE TRANSFERIDA',
            message: `A responsabilidade do ativo <span class="text-slate-700 font-black">${nome}</span> foi transferida com sucesso. O termo foi gerado e enviado por e-mail ao novo responsável.`,
            loteId,
          })}
        />
      )}

      <Modal
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title="EXCLUIR ATIVO"
        icon={AlertTriangle}
        width="max-w-md"
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <p className="font-black text-[#1E293B]">
              Tem certeza que deseja excluir{' '}
              <span className="text-red-600">
                {ativoToDelete?.marca} {ativoToDelete?.modelo}
              </span>
              ?
            </p>
            <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700 font-bold">
              ⚠️ Esta ação é <span className="font-black">irreversível</span>. O ativo e todo seu histórico serão permanentemente removidos do sistema.
            </div>
            <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
              <p className="font-black mb-1">Sugestão: desabilite o equipamento</p>
              <p className="font-bold text-amber-700">
                Em vez de excluir, você pode desativar o ativo. Ele deixa de aparecer nas operações mas o histórico é preservado.{' '}
                <button
                  className="font-black text-[#0000A0] underline underline-offset-2 hover:text-blue-700"
                  onClick={() => {
                    setDeleteConfirmOpen(false);
                    setSelectedAtivo(ativoToDelete);
                    setModalOpen(true);
                  }}
                >
                  Clique aqui para desabilitar
                </button>
                .
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <Button type="button" variant="ghost" onClick={() => setDeleteConfirmOpen(false)} className="font-bold text-slate-400 hover:text-slate-600">
              CANCELAR
            </Button>
            <Button
              type="button"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (ativoToDelete) deleteMutation.mutate(ativoToDelete.id);
                setDeleteConfirmOpen(false);
              }}
              className="bg-red-600 hover:bg-red-700 font-black px-6 shadow-lg shadow-red-600/20"
            >
              {deleteMutation.isPending ? 'EXCLUINDO...' : 'SIM, EXCLUIR'}
            </Button>
          </div>
        </div>
      </Modal>

      <FeedbackModal
        isOpen={feedback.open}
        onClose={() => setFeedback(f => ({ ...f, open: false }))}
        success={feedback.success}
        title={feedback.title}
        message={feedback.message}
        extraButton={feedback.loteId ? {
          label: 'VER TERMO PDF',
          onClick: () => window.open(`/api/v1/movimentacoes/termo/${feedback.loteId}`, '_blank'),
        } : undefined}
      />
    </div>
  );
};
