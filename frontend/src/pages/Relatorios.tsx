import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Printer, Package, MapPin, History, User, AlertTriangle, FileText,
  FileDown, X, Loader2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// ── Tipos ─────────────────────────────────────────────────────────────────────

type RelatorioId = 'inventario' | 'localizacao' | 'historico' | 'responsavel' | 'manutencao' | 'termos';

interface RelatorioCard {
  id: RelatorioId;
  icon: any;
  titulo: string;
  descricao: string;
  cor: string;
}

const RELATORIOS: RelatorioCard[] = [
  { id: 'inventario',  icon: Package,  titulo: 'Inventário Geral de Ativos',        cor: 'blue',   descricao: 'Fotografia completa do patrimônio para auditorias e prestação de contas.' },
  { id: 'localizacao', icon: MapPin,   titulo: 'Ativos por Localização',             cor: 'indigo', descricao: 'O que existe em cada sala — útil para auditoria in loco e reorganização de labs.' },
  { id: 'historico',   icon: History,  titulo: 'Histórico de Movimentações',         cor: 'violet', descricao: 'Rastreabilidade completa exigida por compliance universitário.' },
  { id: 'responsavel', icon: User,     titulo: 'Ativos por Responsável',             cor: 'emerald',descricao: 'Saber quem guarda o quê — fundamental para desligamentos e cobranças.' },
  { id: 'manutencao',  icon: AlertTriangle, titulo: 'Equipamentos Inativos',             cor: 'amber',  descricao: 'Lista de bens fora de uso ou aguardando descarte. Útil para gestão de resíduos e baixas.' },
  { id: 'termos',      icon: FileText, titulo: 'Termos por Responsável / Período',   cor: 'rose',   descricao: 'Centraliza os termos assinados com busca por pessoa ou data.' },
];

const COR: Record<string, string> = {
  blue:    'bg-blue-50 text-[#0000A0] border-blue-100 hover:border-[#0000A0]',
  indigo:  'bg-indigo-50 text-indigo-700 border-indigo-100 hover:border-indigo-500',
  violet:  'bg-violet-50 text-violet-700 border-violet-100 hover:border-violet-500',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:border-emerald-500',
  amber:   'bg-amber-50 text-amber-700 border-amber-100 hover:border-amber-500',
  rose:    'bg-rose-50 text-rose-700 border-rose-100 hover:border-rose-500',
};

const BTN_COR: Record<string, string> = {
  blue:    'bg-[#0000A0] hover:bg-[#0000c0] shadow-[#0000A0]/20',
  indigo:  'bg-indigo-700 hover:bg-indigo-800 shadow-indigo-700/20',
  violet:  'bg-violet-700 hover:bg-violet-800 shadow-violet-700/20',
  emerald: 'bg-emerald-700 hover:bg-emerald-800 shadow-emerald-700/20',
  amber:   'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20',
  rose:    'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildParams(obj: Record<string, any>): URLSearchParams {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined || v === '') continue;
    if (Array.isArray(v)) { v.forEach((item: any) => { if (item !== '') p.append(k, String(item)); }); }
    else p.append(k, String(v));
  }
  return p;
}

async function downloadRelatorio(endpoint: string, params: URLSearchParams, filename: string) {
  const res = await api.get(`/relatorios/${endpoint}?${params.toString()}`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Multi-select pill ─────────────────────────────────────────────────────────

function MultiSelect({ label, options, value, onChange }: {
  label: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (v: string) =>
    onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v]);

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-black tracking-widest text-slate-400">{label.toUpperCase()}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map(o => (
          <button
            key={o.value}
            type="button"
            onClick={() => toggle(o.value)}
            className={cn(
              'rounded-full border px-3 py-1 text-[10px] font-black tracking-wide transition-all',
              value.includes(o.value)
                ? 'bg-[#0000A0] text-white border-[#0000A0]'
                : 'bg-white text-slate-500 border-slate-200 hover:border-[#0000A0] hover:text-[#0000A0]'
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Multi-select de entidades (autocomplete simplificado) ─────────────────────

function EntityMultiSelect({ label, items, labelKey, value, onChange }: {
  label: string;
  items: any[];
  labelKey: string;
  value: number[];
  onChange: (v: number[]) => void;
}) {
  const [search, setSearch] = useState('');

  const toggle = (id: number) =>
    onChange(value.includes(id) ? value.filter(x => x !== id) : [...value, id]);

  const filteredItems = items.filter(item =>
    String(item[labelKey] || '').toLowerCase().includes(search.toLowerCase())
  );

  const toggleAll = () => {
    if (filteredItems.every(i => value.includes(i.id))) {
      onChange(value.filter(id => !filteredItems.map(i => i.id).includes(id)));
    } else {
      const newIds = filteredItems.map(i => i.id).filter(id => !value.includes(id));
      onChange([...value, ...newIds]);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-black tracking-widest text-slate-400">{label.toUpperCase()}</label>
        {items.length > 0 && (
          <button
            type="button"
            onClick={toggleAll}
            className="text-[10px] font-black text-[#0000A0] hover:underline"
          >
            {filteredItems.length > 0 && filteredItems.every(i => value.includes(i.id)) ? 'DESMARCAR FILTRADOS' : 'MARCAR FILTRADOS'}
          </button>
        )}
      </div>

      <div className="relative">
        <Input
          placeholder={`Buscar ${label.toLowerCase()}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-[11px] mb-1.5 pr-8"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div className="max-h-32 overflow-y-auto rounded-xl border border-slate-200 bg-[#F8FAFC] p-2 flex flex-col gap-1">
        {filteredItems.map((item: any) => (
          <label key={item.id} className="flex items-center gap-2 cursor-pointer rounded-lg px-2 py-1 hover:bg-white transition-colors">
            <input
              type="checkbox"
              checked={value.includes(item.id)}
              onChange={() => toggle(item.id)}
              className="accent-[#0000A0]"
            />
            <span className="text-[11px] font-bold text-slate-600">{item[labelKey]}</span>
          </label>
        ))}
        {filteredItems.length === 0 && (
          <span className="text-[10px] text-slate-300 p-1">
            {search ? 'Nenhum resultado encontrado.' : 'Carregando...'}
          </span>
        )}
      </div>
      {value.length > 0 && (
        <span className="text-[10px] text-slate-400 font-bold">{value.length} selecionado(s)</span>
      )}
    </div>
  );
}

function AssetMultiSelect({ label, items, value, onChange }: {
  label: string;
  items: any[];
  value: number[];
  onChange: (v: number[]) => void;
}) {
  const [search, setSearch] = useState('');
  const [selectedTipos, setSelectedTipos] = useState<string[]>([]);
  
  const tiposDisponiveis = Array.from(new Set(items.map(i => i.tipo).filter(Boolean))).sort() as string[];

  const toggle = (id: number) =>
    onChange(value.includes(id) ? value.filter(x => x !== id) : [...value, id]);

  const toggleTipo = (t: string) => {
    setSelectedTipos(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  const filteredItems = items.filter(item => {
    const s = search.toLowerCase();
    const matchesSearch = 
      String(item.nome || '').toLowerCase().includes(s) || 
      String(item.numero_patrimonio || '').toLowerCase().includes(s);
    
    const matchesTipo = selectedTipos.length === 0 || selectedTipos.includes(item.tipo);
    return matchesSearch && matchesTipo;
  });

  const toggleAll = () => {
    if (filteredItems.every(i => value.includes(i.id))) {
      onChange(value.filter(id => !filteredItems.map(i => i.id).includes(id)));
    } else {
      const newIds = filteredItems.map(i => i.id).filter(id => !value.includes(id));
      onChange([...value, ...newIds]);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-black tracking-widest text-[#0000A0]">{label.toUpperCase()}</label>
        {items.length > 0 && (
          <button
            type="button"
            onClick={toggleAll}
            className="text-[10px] font-black text-[#0000A0] hover:underline"
          >
            {filteredItems.length > 0 && filteredItems.every(i => value.includes(i.id)) ? 'DESMARCAR FILTRADOS' : 'MARCAR FILTRADOS'}
          </button>
        )}
      </div>

      {/* Busca */}
      <div className="relative">
        <Input
          placeholder={`Buscar patrimônio ou nome...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 text-[11px] pr-8 rounded-xl bg-slate-50 border-none focus:ring-1 focus:ring-[#0000A0]"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Chips de Tipos */}
      <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto py-1">
        {tiposDisponiveis.map(t => (
          <button
            key={t}
            type="button"
            onClick={() => toggleTipo(t)}
            className={cn(
              "px-2 py-0.5 rounded-lg text-[9px] font-black tracking-wide transition-all border",
              selectedTipos.includes(t)
                ? "bg-[#0000A0] text-white border-[#0000A0]"
                : "bg-slate-50 text-slate-400 border-slate-100 hover:border-slate-300"
            )}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-100 bg-[#F8FAFC] p-2 flex flex-col gap-1">
        {filteredItems.map((item: any) => (
          <label key={item.id} className="flex items-center gap-3 cursor-pointer rounded-xl px-3 py-2 hover:bg-white transition-all group">
            <input
              type="checkbox"
              checked={value.includes(item.id)}
              onChange={() => toggle(item.id)}
              className="accent-[#0000A0] h-4 w-4"
            />
            <div className="flex flex-col flex-1">
              <span className="text-[11px] font-black text-slate-600 group-hover:text-[#0000A0]">
                {item.numero_patrimonio ? `[${item.numero_patrimonio}] ` : ''}{item.nome}
              </span>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                {item.tipo || 'Sem Tipo'}
              </span>
            </div>
          </label>
        ))}
        {filteredItems.length === 0 && (
          <span className="text-[10px] text-slate-300 p-2 font-bold italic">
            {search || selectedTipos.length > 0 ? 'Nenhum ativo encontrado com estes filtros.' : 'Carregando ativos...'}
          </span>
        )}
      </div>
      
      {value.length > 0 && (
        <div className="flex justify-between items-center px-1">
          <span className="text-[10px] text-[#0000A0] font-black">{value.length} SELECIONADO(S)</span>
          <button onClick={() => onChange([])} className="text-[10px] font-black text-red-500 hover:underline">LIMPAR</button>
        </div>
      )}
    </div>
  );
}

// ── Painel de filtros por relatório ───────────────────────────────────────────

function PainelFiltros({ rel, onClose }: { rel: RelatorioCard; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  // R01
  const [r01LocalIds, setR01LocalIds]   = useState<number[]>([]);
  const [r01Tipos, setR01Tipos]         = useState<string[]>([]);
  const [r01Status, setR01Status]       = useState<string[]>([]);
  const [r01Proprio, setR01Proprio]     = useState<string[]>([]);
  const [r01Conserv, setR01Conserv]     = useState<string[]>([]);
  const [r01DataIni, setR01DataIni]     = useState('');
  const [r01DataFim, setR01DataFim]     = useState('');
  const [r01FornIds, setR01FornIds]     = useState<number[]>([]);

  // R02
  const [r02Campus, setR02Campus]       = useState<string[]>([]);
  const [r02Blocos, setR02Blocos]       = useState<string[]>([]);
  const [r02Vazias, setR02Vazias]       = useState(false);
  const [r02Tipos, setR02Tipos]         = useState<string[]>([]);

  // R03
  const [r03DataIni, setR03DataIni]     = useState('');
  const [r03DataFim, setR03DataFim]     = useState('');
  const [r03EqIds, setR03EqIds]         = useState<number[]>([]);
  const [r03TecIds, setR03TecIds]       = useState<number[]>([]);
  const [r03OrigIds, setR03OrigIds]     = useState<number[]>([]);
  const [r03DestIds, setR03DestIds]     = useState<number[]>([]);

  // R04
  const [r04RespIds, setR04RespIds]     = useState<number[]>([]);
  const [r04Tipos, setR04Tipos]         = useState<string[]>([]);
  const [r04ValMin, setR04ValMin]       = useState('');

  // R05
  const [r05Conserv, setR05Conserv]     = useState<string[]>([]);
  const [r05Tipos, setR05Tipos]         = useState<string[]>([]);
  const [r05LocalIds, setR05LocalIds]   = useState<number[]>([]);

  // R06
  const [r06GestIds, setR06GestIds]     = useState<number[]>([]);
  const [r06DataIni, setR06DataIni]     = useState('');
  const [r06DataFim, setR06DataFim]     = useState('');

  // Dados auxiliares
  const { data: locaisResult = [] }  = useQuery({ queryKey: ['localizacoes'], queryFn: async () => (await api.get('/localizacoes/')).data });
  const locais = [...locaisResult].sort((a, b) => a.sala.localeCompare(b.sala, undefined, { numeric: true, sensitivity: 'base' }));

  const { data: fornecedores = [] } = useQuery({ queryKey: ['fornecedores'], queryFn: async () => (await api.get('/fornecedores/')).data });
  const { data: usuarios = [] }     = useQuery({ queryKey: ['usuarios'],     queryFn: async () => (await api.get('/usuarios/')).data });
  const { data: equipamentos = [] } = useQuery({ queryKey: ['equipamentos'], queryFn: async () => (await api.get('/equipamentos/')).data });

  const tiposOpts   = [
    { value: 'Notebook',     label: 'Notebook' },
    { value: 'Desktop',      label: 'Desktop' },
    { value: 'Monitor',      label: 'Monitor' },
    { value: 'Impressora',   label: 'Impressora' },
    { value: 'Projetor',     label: 'Projetor' },
    { value: 'Servidor',     label: 'Servidor' },
    { value: 'Switch',       label: 'Switch' },
    { value: 'Roteador',     label: 'Roteador' },
    { value: 'Tablet',       label: 'Tablet' },
    { value: 'Outro',        label: 'Outro' },
  ];
  const conservOpts = [
    { value: 'OTIMO',   label: 'Ótimo' },
    { value: 'BOM',     label: 'Bom' },
    { value: 'REGULAR', label: 'Regular' },
    { value: 'RUIM',    label: 'Ruim' },
    { value: 'PESSIMO', label: 'Péssimo' },
  ];
  const statusOpts  = [{ value: 'ATIVO', label: 'Ativo' }, { value: 'INATIVO', label: 'Inativo' }];
  const proprioOpts = [{ value: 'true', label: 'Próprio' }, { value: 'false', label: 'Terceiros' }];

  // Campus/Blocos únicos
  const campusOpts  = [...new Set((locais as any[]).map((l: any) => l.campus).filter(Boolean))].map(c => ({ value: c, label: c }));
  const blocoOpts   = [...new Set((locais as any[]).map((l: any) => l.bloco).filter(Boolean))].map(b => ({ value: b, label: b }));

  const gerar = async () => {
    setErro('');
    setLoading(true);
    try {
      let params: URLSearchParams;
      let endpoint: string;
      let filename: string;

      if (rel.id === 'inventario') {
        if (r01LocalIds.length === 0 && !r01DataIni) {
          setErro('Informe ao menos uma localização ou período de aquisição.');
          setLoading(false); return;
        }
        params = buildParams({
          localizacao_ids: r01LocalIds, tipos: r01Tipos, status: r01Status,
          is_proprio: r01Proprio, conservacao: r01Conserv,
          data_inicio: r01DataIni, data_fim: r01DataFim,
          fornecedor_ids: r01FornIds,
        });
        endpoint = 'inventario'; filename = 'relatorio-inventario.pdf';

      } else if (rel.id === 'localizacao') {
        params = buildParams({ campus: r02Campus, blocos: r02Blocos, incluir_vazias: r02Vazias, tipos: r02Tipos });
        endpoint = 'localizacao'; filename = 'relatorio-ativos-por-localizacao.pdf';

      } else if (rel.id === 'historico') {
        if (!r03DataIni || !r03DataFim) { setErro('Período (de / até) é obrigatório.'); setLoading(false); return; }
        params = buildParams({
          data_inicio: r03DataIni, data_fim: r03DataFim,
          equipamento_ids: r03EqIds, tecnico_ids: r03TecIds,
          origem_ids: r03OrigIds, destino_ids: r03DestIds,
        });
        endpoint = 'historico'; filename = 'relatorio-historico-movimentacoes.pdf';

      } else if (rel.id === 'responsavel') {
        params = buildParams({ responsavel_ids: r04RespIds, tipos: r04Tipos, valor_minimo: r04ValMin });
        endpoint = 'responsavel'; filename = 'relatorio-ativos-por-responsavel.pdf';

      } else if (rel.id === 'manutencao') {
        params = buildParams({
          conservacao: r05Conserv,
          tipos: r05Tipos, localizacao_ids: r05LocalIds,
        });
        endpoint = 'manutencao'; filename = 'relatorio-equipamentos-inativos.pdf';

      } else {
        params = buildParams({ gestor_ids: r06GestIds, data_inicio: r06DataIni, data_fim: r06DataFim });
        endpoint = 'termos'; filename = 'relatorio-termos.pdf';
      }

      await downloadRelatorio(endpoint, params, filename);
    } catch (e: any) {
      const detail = e?.response?.data ? await e.response.data.text?.() : '';
      try { setErro(JSON.parse(detail)?.detail || 'Erro ao gerar o relatório.'); } catch { setErro('Erro ao gerar o relatório.'); }
    } finally {
      setLoading(false);
    }
  };

  const labelCss = 'text-[10px] font-black tracking-widest text-slate-400';
  const checkCss = 'flex items-center gap-2 cursor-pointer text-[11px] font-bold text-slate-600';

  return (
    <div className="flex flex-col h-full">
      {/* Header do painel */}
      <div className={cn('flex items-center justify-between rounded-2xl p-5 mb-6', COR[rel.cor].split(' ').slice(0,2).join(' '))}>
        <div className="flex items-center gap-3">
          <rel.icon size={20} />
          <div>
            <p className="text-sm font-black">{rel.titulo}</p>
            <p className="text-[10px] font-bold opacity-70">{rel.descricao}</p>
          </div>
        </div>
        <button onClick={onClose} className="rounded-full p-1.5 hover:bg-black/10 transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Filtros */}
      <div className="flex-1 overflow-y-auto space-y-5 pr-1">

        {/* ── R01 ── */}
        {rel.id === 'inventario' && (<>
          <EntityMultiSelect label="Localizações" items={locais} labelKey="sala" value={r01LocalIds} onChange={setR01LocalIds} />
          <MultiSelect label="Tipos" options={tiposOpts} value={r01Tipos} onChange={setR01Tipos} />
          <MultiSelect label="Status" options={statusOpts} value={r01Status} onChange={setR01Status} />
          <MultiSelect label="Propriedade" options={proprioOpts} value={r01Proprio} onChange={setR01Proprio} />
          <MultiSelect label="Estado de Conservação" options={conservOpts} value={r01Conserv} onChange={setR01Conserv} />
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className={labelCss}>AQUISIÇÃO DE</label>
              <Input type="date" value={r01DataIni} onChange={e => setR01DataIni(e.target.value)} className="h-10" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCss}>AQUISIÇÃO ATÉ</label>
              <Input type="date" value={r01DataFim} onChange={e => setR01DataFim(e.target.value)} className="h-10" />
            </div>
          </div>
          <EntityMultiSelect label="Fornecedores" items={fornecedores} labelKey="nome_empresa" value={r01FornIds} onChange={setR01FornIds} />
        </>)}

        {/* ── R02 ── */}
        {rel.id === 'localizacao' && (<>
          <MultiSelect label="Campus" options={campusOpts} value={r02Campus} onChange={setR02Campus} />
          <MultiSelect label="Blocos" options={blocoOpts} value={r02Blocos} onChange={setR02Blocos} />
          <MultiSelect label="Tipos de Equipamento" options={tiposOpts} value={r02Tipos} onChange={setR02Tipos} />
          <label className={checkCss}>
            <input type="checkbox" checked={r02Vazias} onChange={e => setR02Vazias(e.target.checked)} className="accent-[#0000A0]" />
            Incluir salas sem equipamentos
          </label>
        </>)}

        {/* ── R03 ── */}
        {rel.id === 'historico' && (<>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className={labelCss}>PERÍODO DE <span className="text-red-500">*</span></label>
              <Input type="date" value={r03DataIni} onChange={e => setR03DataIni(e.target.value)} className="h-10" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCss}>PERÍODO ATÉ <span className="text-red-500">*</span></label>
              <Input type="date" value={r03DataFim} onChange={e => setR03DataFim(e.target.value)} className="h-10" />
            </div>
          </div>
          <AssetMultiSelect label="Equipamentos" items={equipamentos} value={r03EqIds} onChange={setR03EqIds} />
          <EntityMultiSelect label="Técnicos" items={usuarios} labelKey="nome" value={r03TecIds} onChange={setR03TecIds} />
          <EntityMultiSelect label="Local de Origem" items={locais} labelKey="sala" value={r03OrigIds} onChange={setR03OrigIds} />
          <EntityMultiSelect label="Local de Destino" items={locais} labelKey="sala" value={r03DestIds} onChange={setR03DestIds} />
        </>)}

        {/* ── R04 ── */}
        {rel.id === 'responsavel' && (<>
          <EntityMultiSelect label="Responsáveis (vazio = todos)" items={usuarios} labelKey="nome" value={r04RespIds} onChange={setR04RespIds} />
          <MultiSelect label="Tipos de Equipamento" options={tiposOpts} value={r04Tipos} onChange={setR04Tipos} />
          <div className="flex flex-col gap-1.5">
            <label className={labelCss}>VALOR MÍNIMO (R$)</label>
            <Input type="number" placeholder="Ex: 500" value={r04ValMin} onChange={e => setR04ValMin(e.target.value)} className="h-10" />
          </div>
        </>)}

        {/* ── R05 ── */}
        {rel.id === 'manutencao' && (<>
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-[11px] font-bold text-amber-700">
            Este relatório lista apenas equipamentos com status <span className="font-black">INATIVO</span>.
          </div>
          <MultiSelect label="Estado de Conservação" options={conservOpts} value={r05Conserv} onChange={setR05Conserv} />
          <MultiSelect label="Tipos de Equipamento" options={tiposOpts} value={r05Tipos} onChange={setR05Tipos} />
          <EntityMultiSelect label="Localizações" items={locais} labelKey="sala" value={r05LocalIds} onChange={setR05LocalIds} />
        </>)}

        {/* ── R06 ── */}
        {rel.id === 'termos' && (<>
          <EntityMultiSelect label="Gestor Recebedor (vazio = todos)" items={usuarios} labelKey="nome" value={r06GestIds} onChange={setR06GestIds} />
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className={labelCss}>PERÍODO DE</label>
              <Input type="date" value={r06DataIni} onChange={e => setR06DataIni(e.target.value)} className="h-10" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCss}>PERÍODO ATÉ</label>
              <Input type="date" value={r06DataFim} onChange={e => setR06DataFim(e.target.value)} className="h-10" />
            </div>
          </div>
        </>)}
      </div>

      {/* Erro */}
      {erro && (
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-[11px] font-bold text-red-700">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          {erro}
        </div>
      )}

      {/* Botão */}
      <button
        onClick={gerar}
        disabled={loading}
        className={cn(
          'mt-5 flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-[11px] font-black text-white shadow-lg transition-all disabled:opacity-50',
          BTN_COR[rel.cor]
        )}
      >
        {loading
          ? <><Loader2 size={16} className="animate-spin" /> GERANDO PDF...</>
          : <><FileDown size={16} /> GERAR E BAIXAR PDF</>
        }
      </button>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export const Relatorios = () => {
  const [selecionado, setSelecionado] = useState<RelatorioCard | null>(null);

  return (
    <div className="flex gap-6 h-full">

      {/* Grid de cards */}
      <div className={cn('flex flex-col gap-4 transition-all duration-300', selecionado ? 'w-1/2' : 'w-full')}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {RELATORIOS.map(rel => {
            const ativo = selecionado?.id === rel.id;
            return (
              <button
                key={rel.id}
                onClick={() => setSelecionado(ativo ? null : rel)}
                className={cn(
                  'flex flex-col gap-4 rounded-[24px] border-2 bg-white p-6 text-left shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-all duration-200',
                  ativo
                    ? `border-current ${COR[rel.cor].split(' ').slice(0,2).join(' ')}`
                    : `border-transparent hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] ${COR[rel.cor].split(' ').slice(2).join(' ')}`
                )}
              >
                <div className={cn('flex h-12 w-12 items-center justify-center rounded-2xl', COR[rel.cor].split(' ').slice(0,2).join(' '))}>
                  <rel.icon size={22} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-black text-[#1E293B] leading-snug">{rel.titulo}</p>
                  <p className="mt-1 text-[11px] font-bold text-slate-400 leading-relaxed">{rel.descricao}</p>
                </div>
                <div className={cn(
                  'flex items-center gap-1.5 rounded-xl px-3 py-2 text-[10px] font-black tracking-wide w-fit transition-colors',
                  ativo ? 'bg-white/60' : COR[rel.cor].split(' ').slice(0,2).join(' ')
                )}>
                  <Printer size={12} />
                  {ativo ? 'FECHAR' : 'CONFIGURAR E GERAR'}
                </div>
              </button>
            );
          })}
        </div>

        {!selecionado && (
          <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-6 py-4 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
            <Printer size={16} className="text-slate-300" />
            <p className="text-[11px] font-bold text-slate-400">Selecione um relatório acima para configurar os filtros e gerar o PDF.</p>
          </div>
        )}
      </div>

      {/* Painel de filtros */}
      {selecionado && (
        <div className="w-1/2 rounded-[28px] border border-slate-100 bg-white p-7 shadow-[0_8px_40px_rgba(0,0,0,0.06)] overflow-hidden flex flex-col">
          <PainelFiltros rel={selecionado} onClose={() => setSelecionado(null)} />
        </div>
      )}
    </div>
  );
};
