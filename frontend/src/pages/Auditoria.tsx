import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { ShieldAlert, FilterX, ChevronDown, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn, safeParseDate } from '@/lib/utils';
import { Pagination } from '@/components/ui/Pagination';

interface LogAuditoria {
  id: number;
  usuario_id: number;
  usuario_nome: string;
  acao: string;
  entidade: string;
  entidade_id: number;
  dados_anteriores_json?: Record<string, unknown>;
  dados_novos_json?: Record<string, unknown>;
  ip?: string;
  created_at: string;
}

interface LogsResponse {
  items: LogAuditoria[];
  total: number;
  page: number;
  page_size: number;
}

const ACAO_STYLE: Record<string, string> = {
  CRIAR: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  EDITAR: 'bg-amber-50 text-amber-700 border border-amber-200',
  EXCLUIR: 'bg-red-50 text-red-700 border border-red-200',
};

const ENTIDADE_LABELS: Record<string, string> = {
  equipamento: 'Equipamento',
  usuario: 'Usuário',
  localizacao: 'Localização',
  fornecedor: 'Fornecedor',
  perfil: 'Perfil',
  movimentacao: 'Movimentação',
  categoria: 'Categoria',
};

const FIELD_LABELS: Record<string, string> = {
  NumeroPatrimonio: 'Patrimônio',
  Nome: 'Nome',
  NumeroSerie: 'Nº Série',
  Tipo: 'Tipo',
  Marca: 'Marca',
  Modelo: 'Modelo',
  DataAquisicao: 'Data Aquisição',
  Valor: 'Valor',
  EstadoConservacao: 'Conservação',
  Ativo: 'Ativo',
  IsProprio: 'Próprio',
  Observacoes: 'Observações',
  LocalizacaoId: 'Local (ID)',
  ResponsavelId: 'Responsável (ID)',
  FornecedorId: 'Fornecedor (ID)',
  Fotos: 'Fotos',
  fotos: 'Fotos',
};

// Campos internos/ruído que não devem aparecer no diff
const SKIP_FIELDS = new Set([
  'Id', 'id', 'Status',
  'EspecificacoesJson', 'FotosJson',
  'LocalizacaoCampus', 'LocalizacaoBloco', 'LocalizacaoSala',
  'ResponsavelNome', 'ResponsavelMatricula',
  'FornecedorNome', 'FornecedorSigla',
  'Localizacao', 'Responsavel', 'Fornecedor',
  'especificacoes', 'localizacao', 'responsavel', 'fornecedor',
]);

function formatValue(val: unknown, fieldKey?: string): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'boolean') return val ? 'Sim' : 'Não';
  // Fotos é armazenado como count (número) após remoção do base64
  if (typeof val === 'number' && (fieldKey === 'Fotos' || fieldKey === 'fotos')) {
    return `${val} foto${val !== 1 ? 's' : ''}`;
  }
  if (typeof val === 'object') return JSON.stringify(val);
  if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}T/)) {
    try {
      return format(new Date(val), 'dd/MM/yyyy', { locale: ptBR });
    } catch { return val; }
  }
  return String(val);
}

function cleanIp(ip?: string): string {
  if (!ip) return '—';
  return ip.replace(/^::ffff:/, '');
}

// Diff view para EDITAR
const DiffView = ({ before, after }: { before?: Record<string, unknown>; after?: Record<string, unknown> }) => {
  const [open, setOpen] = useState(false);

  if (!before && !after) return <span className="text-[10px] text-slate-300">sem dados</span>;

  const allKeys = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ]);

  const diffs: { key: string; before: unknown; after: unknown }[] = [];
  for (const key of allKeys) {
    if (SKIP_FIELDS.has(key)) continue;
    const bVal = JSON.stringify((before ?? {})[key] ?? null);
    const aVal = JSON.stringify((after ?? {})[key] ?? null);
    if (bVal !== aVal) {
      diffs.push({ key, before: (before ?? {})[key], after: (after ?? {})[key] });
    }
  }

  if (diffs.length === 0) return <span className="text-[10px] text-slate-300">sem alterações</span>;

  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 text-[10px] font-black text-amber-500 hover:text-amber-700 transition-colors"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {diffs.length} CAMPO{diffs.length !== 1 ? 'S' : ''}
      </button>
      {open && (
        <div className="mt-1.5 flex flex-col gap-0.5 max-w-[320px]">
          {diffs.map(({ key, before: bVal, after: aVal }) => (
            <div key={key} className="rounded-md bg-slate-50 px-2 py-1.5 text-[9px] leading-4">
              <span className="font-black text-slate-500">{FIELD_LABELS[key] ?? key}</span>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className="rounded bg-red-50 px-1 text-red-500 line-through">{formatValue(bVal, key)}</span>
                <span className="text-slate-300">→</span>
                <span className="rounded bg-emerald-50 px-1 text-emerald-600">{formatValue(aVal, key)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Resumo compacto para CRIAR / EXCLUIR
const SummaryView = ({ data, acao }: { data?: Record<string, unknown>; acao: string }) => {
  const [open, setOpen] = useState(false);
  if (!data) return <span className="text-[10px] text-slate-300">sem dados</span>;

  const mainFields = ['NumeroPatrimonio', 'Nome', 'Tipo', 'Marca', 'Modelo'];
  const preview = mainFields
    .filter(f => data[f])
    .map(f => String(data[f]))
    .join(' · ');

  const color = acao === 'CRIAR' ? 'text-emerald-600 hover:text-emerald-800' : 'text-red-500 hover:text-red-700';

  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className={cn('flex items-center gap-1 text-[10px] font-black transition-colors', color)}
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        VER
      </button>
      {!open && preview && (
        <div className="mt-0.5 text-[9px] text-slate-400 max-w-[200px] truncate">{preview}</div>
      )}
      {open && (
        <div className="mt-1.5 flex flex-col gap-0.5 max-w-[280px]">
          {Object.entries(data)
            .filter(([k, v]) => !SKIP_FIELDS.has(k) && v !== null && v !== undefined)
            .map(([k, v]) => (
              <div key={k} className="flex gap-1 rounded-md bg-slate-50 px-2 py-1 text-[9px]">
                <span className="font-black text-slate-500 shrink-0">{FIELD_LABELS[k] ?? k}:</span>
                <span className="text-slate-600 break-all">{formatValue(v)}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};

const ENTIDADES = ['equipamento', 'usuario', 'localizacao', 'fornecedor', 'perfil', 'movimentacao', 'categoria'];
const ACOES = ['CRIAR', 'EDITAR', 'EXCLUIR'];
const PAGE_SIZE = 50;

export const Auditoria = () => {
  const { hasPermission } = useAuth();
  const [page, setPage] = useState(1);
  const [filterEntidade, setFilterEntidade] = useState('');
  const [filterAcao, setFilterAcao] = useState('');
  const [filterDe, setFilterDe] = useState('');
  const [filterAte, setFilterAte] = useState('');

  if (!hasPermission('auditoria:ler')) {
    return <Navigate to="/" replace />;
  }

  const params: Record<string, string | number> = { page, page_size: PAGE_SIZE };
  if (filterEntidade) params.entidade = filterEntidade;
  if (filterAcao) params.acao = filterAcao;
  if (filterDe) params.de = filterDe;
  if (filterAte) params.ate = filterAte;

  const { data, isLoading } = useQuery<LogsResponse>({
    queryKey: ['auditoria', page, filterEntidade, filterAcao, filterDe, filterAte],
    queryFn: async () => (await api.get('/auditoria/', { params })).data,
  });

  const logs = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const hasFilters = filterEntidade || filterAcao || filterDe || filterAte;

  const handleClearFilters = () => {
    setFilterEntidade('');
    setFilterAcao('');
    setFilterDe('');
    setFilterAte('');
    setPage(1);
  };

  const handleFilterChange = (setter: (v: string) => void) =>
    (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
      setter(e.target.value);
      setPage(1);
    };

  return (
    <div className="flex flex-col gap-6">
      {/* FILTERS */}
      <div className="flex flex-wrap items-center gap-3 rounded-[24px] border border-slate-100 bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,0.02)]">
        <div className={cn(
          "flex h-12 items-center rounded-xl border px-3 transition-all",
          filterEntidade ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-[#F8FAFC]"
        )}>
          <select
            value={filterEntidade}
            onChange={handleFilterChange(setFilterEntidade)}
            className="bg-transparent text-[11px] font-black text-[#1E3A8A] outline-none"
          >
            <option value="">ENTIDADE</option>
            {ENTIDADES.map(e => (
              <option key={e} value={e}>{ENTIDADE_LABELS[e] || e}</option>
            ))}
          </select>
        </div>

        <div className={cn(
          "flex h-12 items-center rounded-xl border px-3 transition-all",
          filterAcao ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-[#F8FAFC]"
        )}>
          <select
            value={filterAcao}
            onChange={handleFilterChange(setFilterAcao)}
            className="bg-transparent text-[11px] font-black text-[#1E3A8A] outline-none"
          >
            <option value="">AÇÃO</option>
            {ACOES.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>

        <div className={cn(
          "flex h-12 items-center gap-2 rounded-xl border px-3 transition-all",
          filterDe ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-[#F8FAFC]"
        )}>
          <span className="text-[10px] font-black text-slate-400">DE</span>
          <input
            type="date"
            value={filterDe}
            onChange={handleFilterChange(setFilterDe)}
            className="bg-transparent text-[11px] font-black text-[#1E3A8A] outline-none"
          />
        </div>

        <div className={cn(
          "flex h-12 items-center gap-2 rounded-xl border px-3 transition-all",
          filterAte ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-[#F8FAFC]"
        )}>
          <span className="text-[10px] font-black text-slate-400">ATÉ</span>
          <input
            type="date"
            value={filterAte}
            onChange={handleFilterChange(setFilterAte)}
            className="bg-transparent text-[11px] font-black text-[#1E3A8A] outline-none"
          />
        </div>

        {hasFilters && (
          <button
            onClick={handleClearFilters}
            className="flex items-center gap-2 px-4 text-[11px] font-black text-slate-400 hover:text-slate-600 transition-colors"
          >
            <FilterX size={16} />
            LIMPAR FILTROS
          </button>
        )}

        <span className="ml-auto text-[11px] font-bold text-slate-400">
          {total} registro{total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* TABLE */}
      <div className="rounded-[32px] border border-slate-200 bg-white overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.02)]">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
            Carregando...
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400">
            <ShieldAlert size={40} className="text-slate-200" />
            <span className="text-sm font-bold">Nenhum registro de auditoria encontrado.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100">
                  {['DATA / HORA', 'USUÁRIO', 'AÇÃO', 'ENTIDADE', 'ID', 'ALTERAÇÕES', 'IP'].map(h => (
                    <th key={h} className="px-5 py-4 text-left text-[10px] font-black tracking-widest text-slate-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log, idx) => (
                  <tr
                    key={log.id}
                    className={cn(
                      "border-b border-slate-50 transition-colors hover:bg-slate-50/60",
                      idx % 2 === 0 ? "bg-white" : "bg-slate-50/30"
                    )}
                  >
                    <td className="px-5 py-3 text-slate-500 whitespace-nowrap">
                      {log.created_at
                        ? (() => {
                            const date = safeParseDate(log.created_at);
                            return date ? format(date, "dd/MM/yy 'às' HH:mm", { locale: ptBR }) : '—';
                          })()
                        : '—'}
                    </td>
                    <td className="px-5 py-3 font-bold text-[#1E3A8A]">{log.usuario_nome ?? '—'}</td>
                    <td className="px-5 py-3">
                      <span className={cn(
                        "rounded-lg px-2.5 py-1 text-[10px] font-black tracking-wide",
                        ACAO_STYLE[log.acao] || "bg-slate-100 text-slate-600"
                      )}>
                        {log.acao}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-bold text-slate-600">
                      {ENTIDADE_LABELS[log.entidade] || log.entidade}
                    </td>
                    <td className="px-5 py-3 text-slate-400">#{log.entidade_id}</td>
                    <td className="px-5 py-3">
                      {log.acao === 'EDITAR' ? (
                        <DiffView before={log.dados_anteriores_json} after={log.dados_novos_json} />
                      ) : (
                        <SummaryView
                          data={log.acao === 'CRIAR' ? log.dados_novos_json : log.dados_anteriores_json}
                          acao={log.acao}
                        />
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-400 text-[10px] whitespace-nowrap">
                      {cleanIp(log.ip)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PAGINATION */}
      {totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      )}
    </div>
  );
};
