import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Package, X } from 'lucide-react';
import { Ativo } from '@/pages/Ativos';
import { Button } from '@/components/ui/button';
import { cn, formatLocal, safeParseDate } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';

interface AtivoDetalhesModalProps {
  isOpen: boolean;
  onClose: () => void;
  ativo: Ativo;
}

export const AtivoDetalhesModal = ({ isOpen, onClose, ativo }: AtivoDetalhesModalProps) => {
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const InfoRow = ({ label, value }: { label: string; value?: string | number | null }) => (
    <div className="flex flex-col gap-1 border-b border-slate-50 py-3 last:border-0">
      <span className="text-[10px] font-black tracking-widest text-slate-400">
        {label.toUpperCase()}
      </span>
      <span className="text-[13px] font-bold text-[#1E293B]">
        {value || '--'}
      </span>
    </div>
  );

  const statusMap: Record<string, { label: string; color: string }> = {
    ATIVO:   { label: 'ATIVO',   color: 'bg-green-100 text-green-700' },
    INATIVO: { label: 'INATIVO', color: 'bg-red-100 text-red-700' },
  };

  const conservacaoMap: Record<string, { label: string; color: string }> = {
    OTIMO:   { label: 'Ótimo',   color: 'bg-green-100 text-green-700' },
    BOM:     { label: 'Bom',     color: 'bg-blue-100 text-blue-700' },
    REGULAR: { label: 'Regular', color: 'bg-amber-100 text-amber-700' },
    RUIM:    { label: 'Ruim',    color: 'bg-orange-100 text-orange-700' },
    PESSIMO: { label: 'Péssimo', color: 'bg-red-100 text-red-700' },
  };

  // Busca dados completos do ativo (incluindo fotos) quando o modal abre
  const { data: fullAtivo, isLoading: isLoadingFull } = useQuery<Ativo>({
    queryKey: ['equipamento', ativo.id],
    queryFn: async () => (await api.get(`/equipamentos/${ativo.id}`)).data,
    enabled: isOpen,
  });

  // Busca categorias para obter os campos_especificacoes da categoria do ativo
  const { data: categorias = [] } = useQuery<any[]>({
    queryKey: ['categorias'],
    queryFn: async () => (await api.get('/categorias/')).data,
    staleTime: 5 * 60 * 1000,
    enabled: isOpen,
  });

  const displayAtivo = fullAtivo || ativo;

  const statusKey = displayAtivo.ativo !== false ? 'ATIVO' : 'INATIVO';
  const statusEntry = statusMap[statusKey];

  const conservacaoKey = displayAtivo.estado_conservacao?.toUpperCase() || '';
  const conservacaoEntry = conservacaoMap[conservacaoKey];

  const especificacoes = displayAtivo.especificacoes;

  // Encontra a categoria correspondente ao tipo do ativo
  const categoriaAtual = (categorias as any[]).find(
    (c: any) => c.nome?.toUpperCase() === displayAtivo.tipo?.toUpperCase()
  );

  // Obtém os campos definidos na categoria (com label e key)
  const camposEspecificacoes: { key: string; label: string }[] = (() => {
    const jsonStr = categoriaAtual?.campos_especificacoes || categoriaAtual?.camposEspecificacoes;
    if (!jsonStr) return [];
    try { return JSON.parse(jsonStr); } catch { return []; }
  })();

  // Monta as linhas de especificação a exibir:
  // - Se a categoria tem campos definidos, usa os labels da categoria
  // - Fallback: exibe todas as chaves presentes em especificacoes
  const specRows: { label: string; value: string }[] = (() => {
    if (!especificacoes) return [];
    if (camposEspecificacoes.length > 0) {
      return camposEspecificacoes
        .filter(f => especificacoes[f.key] != null && especificacoes[f.key] !== '')
        .map(f => ({ label: f.label, value: especificacoes[f.key] }));
    }
    // Fallback: mostra todas as chaves do JSON de especificacoes
    return Object.entries(especificacoes)
      .filter(([, v]) => v != null && v !== '')
      .map(([k, v]) => ({ label: k, value: v }));
  })();

  const hasEspecificacoes = specRows.length > 0;

  const { hasPermission } = useAuth();
  const canReadHistory = hasPermission('movimentacoes:ler');

  // Histórico de movimentações do ativo
  const { data: movimentacoes = [] } = useQuery<any[]>({
    queryKey: ['movimentacoes', displayAtivo.id],
    queryFn: async () => (await api.get(`/movimentacoes/?equipamento_id=${displayAtivo.id}`)).data,
    enabled: isOpen && canReadHistory,
  });

  const formatData = (data?: string) => {
    const d = safeParseDate(data);
    if (!d) return '--';
    return format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="DETALHES DO ATIVO"
      icon={Package}
      width="max-w-4xl"
    >
      <div className={cn("flex flex-col gap-6 transition-opacity duration-300", isLoadingFull ? "opacity-50" : "opacity-100")}>

        {/* INFORMAÇÕES PRINCIPAIS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* COLUNA ESQUERDA */}
          <div className="flex flex-col gap-4">

            {/* CABEÇALHO */}
            <div className="flex items-center gap-3 rounded-2xl bg-blue-50 p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                <Package size={20} className="text-[#0000A0]" />
              </div>
              <div>
                <h3 className="text-base font-black text-[#1E3A8A]">
                  {displayAtivo.marca} {displayAtivo.modelo}
                </h3>
                <p className="text-xs font-bold text-blue-500">
                  {displayAtivo.tipo?.toUpperCase() || 'SEM CATEGORIA'}
                </p>
              </div>
            </div>

            {/* STATUS E CONSERVAÇÃO */}
            <div className="flex gap-3">
              <div className="flex flex-1 flex-col gap-1">
                <span className="text-[10px] font-black tracking-widest text-slate-400">STATUS</span>
                <div className={`inline-flex w-fit rounded-xl px-3 py-1 text-[11px] font-black tracking-wide ${statusEntry.color}`}>
                  {statusEntry.label}
                </div>
              </div>
              {conservacaoEntry && (
                <div className="flex flex-1 flex-col gap-1">
                  <span className="text-[10px] font-black tracking-widest text-slate-400">CONSERVAÇÃO</span>
                  <div className={`inline-flex w-fit rounded-xl px-3 py-1 text-[11px] font-black tracking-wide ${conservacaoEntry.color}`}>
                    {conservacaoEntry.label}
                  </div>
                </div>
              )}
            </div>

            {/* IDENTIFICAÇÃO */}
            <div className="rounded-2xl border border-slate-100 p-5">
              <h4 className="mb-3 text-[10px] font-black tracking-[1.5px] text-slate-400">IDENTIFICAÇÃO</h4>
              <InfoRow label="Patrimônio" value={displayAtivo.numero_patrimonio || displayAtivo.patrimonio} />
              <InfoRow label="Número de Série (SN)" value={displayAtivo.numero_serie} />
              <InfoRow label="Tipo de Propriedade" value={displayAtivo.is_proprio === false ? 'TERCEIRO (Aluguel/Comodato)' : 'PRÓPRIO (Compra/Doação)'} />
              {displayAtivo.is_proprio === false && displayAtivo.fornecedor && (
                <InfoRow label="Fornecedor" value={displayAtivo.fornecedor.nome_empresa} />
              )}
              {displayAtivo.is_proprio !== false && displayAtivo.valor != null && (
                <InfoRow label="Valor" value={`R$ ${Number(displayAtivo.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
              )}
              <InfoRow
                label={displayAtivo.is_proprio === false ? 'Data de Início do Contrato' : 'Data de Aquisição'}
                value={displayAtivo.data_aquisicao ? safeParseDate(displayAtivo.data_aquisicao.substring(0, 10))?.toLocaleDateString('pt-BR') : undefined}
              />
            </div>

            {/* OBSERVAÇÕES */}
            {displayAtivo.observacoes && (
              <div className="rounded-2xl border border-slate-100 p-5">
                <h4 className="mb-2 text-[10px] font-black tracking-[1.5px] text-slate-400">OBSERVAÇÕES</h4>
                <p className="text-[13px] font-bold text-[#1E293B] whitespace-pre-wrap">{displayAtivo.observacoes}</p>
              </div>
            )}
          </div>

          {/* COLUNA DIREITA */}
          <div className="flex flex-col gap-4">

            {/* LOCALIZAÇÃO */}
            <div className="rounded-2xl bg-[#F8FAFC] p-5 border border-slate-100">
              <h4 className="mb-3 text-[10px] font-black tracking-[1.5px] text-slate-400">LOCALIZAÇÃO ATUAL</h4>
              <InfoRow
                label="Local"
                value={displayAtivo.localizacao ? formatLocal(displayAtivo.localizacao) : undefined}
              />
              {displayAtivo.responsavel && (
                <InfoRow label="Responsável Atual" value={displayAtivo.responsavel.nome} />
              )}
            </div>

            {/* ESPECIFICAÇÕES TÉCNICAS DINÂMICAS */}
            {hasEspecificacoes && (
              <div className="rounded-2xl bg-slate-50 p-5 border border-slate-100">
                <h4 className="mb-3 text-[10px] font-black tracking-[1.5px] text-slate-400">ESPECIFICAÇÕES TÉCNICAS</h4>
                {specRows.map(({ label, value }) => (
                  <InfoRow key={label} label={label} value={value} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* FOTOS */}
        {displayAtivo.fotos && displayAtivo.fotos.length > 0 ? (
          <div className="rounded-2xl border border-slate-100 p-5">
            <h4 className="mb-3 text-[10px] font-black tracking-[1.5px] text-slate-400">FOTOS DO ATIVO</h4>
            <div className="flex flex-wrap gap-3">
              {displayAtivo.fotos.map((url, i) => (
                <div 
                  key={i} 
                  onClick={() => setSelectedPhoto(url)}
                  className="group relative h-24 w-24 overflow-hidden rounded-xl border border-slate-200 cursor-pointer"
                >
                  <img
                    src={url}
                    alt={`Foto ${i + 1}`}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="text-[10px] font-black text-white bg-black/40 px-2 py-1 rounded-lg">VER</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          !isLoadingFull && (
            <div className="rounded-2xl border border-slate-100 p-5">
              <h4 className="mb-1 text-[10px] font-black tracking-[1.5px] text-slate-400">FOTOS DO ATIVO</h4>
              <p className="text-xs font-bold text-slate-300">Nenhuma foto cadastrada.</p>
            </div>
          )
        )}

        {/* HISTÓRICO DE MOVIMENTAÇÕES */}
        {canReadHistory && (
          <div className="rounded-2xl border border-slate-100 overflow-hidden">
            <div className="bg-slate-50 px-5 py-3 border-b border-slate-100">
              <h4 className="text-[10px] font-black tracking-[1.5px] text-slate-400">HISTÓRICO DE MOVIMENTAÇÕES</h4>
            </div>
            <div className="overflow-x-auto max-h-52 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-slate-100 bg-white">
                    <th className="px-4 py-3 text-left text-[10px] font-black tracking-wider text-slate-400">DATA</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black tracking-wider text-slate-400">ORIGEM</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black tracking-wider text-slate-400">DESTINO</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black tracking-wider text-slate-400">TÉCNICO</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black tracking-wider text-slate-400">MOTIVO</th>
                  </tr>
                </thead>
                <tbody>
                  {movimentacoes.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-[11px] font-bold text-slate-300">
                        Nenhuma movimentação registrada para este ativo.
                      </td>
                    </tr>
                  ) : (
                    movimentacoes.map((mov: any) => (
                      <tr key={mov.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-bold text-slate-600 whitespace-nowrap">
                          {formatData(mov.data_movimentacao)}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {mov.loc_origem_dsc || '--'}
                        </td>
                        <td className="px-4 py-3 font-bold text-[#0000A0]">
                          {mov.loc_destino_dsc || '--'}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {mov.tecnico_nome || '--'}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {mov.motivo || '--'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      <div className="mt-4 flex justify-end border-t border-slate-100 pt-4">
        <Button onClick={onClose} className="px-8 font-black">FECHAR</Button>
      </div>

      {/* ZOOM DA FOTO */}
      {selectedPhoto && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setSelectedPhoto(null)}
        >
          <div 
            className="relative max-w-4xl w-full rounded-3xl overflow-hidden bg-white shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => setSelectedPhoto(null)}
              className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
            >
              <X size={20} />
            </button>
            <img 
              src={selectedPhoto} 
              alt="Foto do ativo ampliada" 
              className="w-full object-contain max-h-[85vh]" 
            />
            <div className="px-6 py-4 border-t border-slate-100 bg-white">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Visualização da foto — {displayAtivo.marca} {displayAtivo.modelo}</p>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};
