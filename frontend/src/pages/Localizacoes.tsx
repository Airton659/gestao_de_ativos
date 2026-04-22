import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { MapPin, Search, Plus, Edit2, Trash2, Package, MoveRight, AlertTriangle, ToggleLeft, ToggleRight } from 'lucide-react';
import { DataTable } from '@/components/ui/DataTable';
import { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/Modal';
import { FeedbackModal } from '@/components/ui/FeedbackModal';
import { useForm } from 'react-hook-form';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface Localizacao {
  id: number;
  campus: string;
  bloco?: string;
  andar?: string;
  sala: string;
  descricao?: string;
  ativo?: boolean;
  equipamentos?: any[];
}

export const Localizacoes = () => {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('TODOS OS STATUS');
  const [modalOpen, setModalOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedLoc, setSelectedLoc] = useState<Localizacao | null>(null);
  const [feedback, setFeedback] = useState<{ open: boolean; success: boolean; title: string; message: string }>({ open: false, success: true, title: '', message: '' });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteBlockOpen, setDeleteBlockOpen] = useState(false);
  const [locToDelete, setLocToDelete] = useState<Localizacao | null>(null);
  const [equipamentosAssociados, setEquipamentosAssociados] = useState<{ id: number; marca?: string; modelo?: string; numero_patrimonio?: string }[]>([]);
  const [checkingDelete, setCheckingDelete] = useState(false);
  const { hasPermission } = useAuth();

  const queryClient = useQueryClient();

  const { data: localizacoes = [], isLoading } = useQuery<Localizacao[]>({
    queryKey: ['localizacoes'],
    queryFn: async () => (await api.get('/localizacoes/')).data,
    staleTime: 10 * 60 * 1000, // 10 minutos (mudam raramente)
    gcTime: 60 * 60 * 1000,    // 1 hora em memória
  });

  const toggleMutation = useMutation({
    mutationFn: (loc: Localizacao) => api.put(`/localizacoes/${loc.id}/`, { ativo: !loc.ativo }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['localizacoes'] }),
    onError: (err: any) => {
      const detail = err.response?.data?.detail || 'Erro ao alterar status.';
      setFeedback({ open: true, success: false, title: 'ERRO', message: detail });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/localizacoes/${id}/`),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['localizacoes'] });
      const nome = `Campus ${locToDelete?.campus}${locToDelete?.bloco ? `, Bloco ${locToDelete.bloco}` : ''}, Sala ${locToDelete?.sala}`;
      const isSoft = res.data?.softDelete;
      setLocToDelete(null);
      setFeedback({ 
        open: true, 
        success: true, 
        title: isSoft ? 'LOCAL DESATIVADO' : 'LOCAL EXCLUÍDO', 
        message: isSoft 
          ? res.data.message 
          : `<span class="text-slate-700 font-black">${nome}</span> foi removido do sistema.` 
      });
    },
    onError: (err: any) => {
      const detail = err.response?.data?.detail || 'Erro ao excluir local.';
      setFeedback({ open: true, success: false, title: 'ERRO AO EXCLUIR', message: detail });
    },
  });

  const handleDeleteClick = async (loc: Localizacao, e: React.MouseEvent) => {
    e.stopPropagation();
    setLocToDelete(loc);
    setCheckingDelete(true);
    try {
      const res = await api.get(`/equipamentos/?localizacao_id=${loc.id}`);
      const equips = res.data || [];
      if (equips.length > 0) {
        setEquipamentosAssociados(equips);
        setDeleteBlockOpen(true);
      } else {
        setDeleteConfirmOpen(true);
      }
    } catch {
      setDeleteConfirmOpen(true);
    } finally {
      setCheckingDelete(false);
    }
  };

  const filteredData = localizacoes.filter(loc => {
    const s = search.toLowerCase();
    const matchSearch = !search || 
      loc.campus.toLowerCase().includes(s) || 
      (loc.bloco && loc.bloco.toLowerCase().includes(s)) || 
      loc.sala.toLowerCase().includes(s);
    
    const matchStatus = filterStatus === 'TODOS OS STATUS' || 
      (filterStatus === 'ATIVOS' && loc.ativo) || 
      (filterStatus === 'INATIVOS' && !loc.ativo);

    return matchSearch && matchStatus;
  });

  const columns: ColumnDef<Localizacao>[] = [
    {
      accessorKey: 'campus',
      header: 'CAMPUS',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <MapPin size={14} className="text-blue-500" />
          <span className="font-black text-[#1E293B]">{row.original.campus}</span>
        </div>
      ),
    },
    {
      accessorKey: 'bloco_sala',
      header: 'BLOCO / SALA',
      cell: ({ row }) => {
        const parts = [row.original.bloco, row.original.sala].filter(Boolean);
        return parts.join(' — ') || '--';
      },
    },
    { accessorKey: 'andar', header: 'ANDAR' },
    {
      accessorKey: 'ativo',
      header: 'STATUS',
      cell: ({ row }) => (
        <div className={cn(
          "inline-flex rounded-xl px-3 py-1 text-[9px] font-black uppercase",
          row.original.ativo !== false ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
        )}>
          {row.original.ativo !== false ? 'ATIVO' : 'INATIVO'}
        </div>
      ),
    },
    {
      id: 'acoes',
      header: 'AÇÕES',
      size: 120,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          {hasPermission('localizacoes:editar') && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setSelectedLoc(row.original); setModalOpen(true); }}
                className="rounded-full p-2 text-blue-500 hover:bg-blue-50 transition-colors"
                title="Editar"
              >
                <Edit2 size={16} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); toggleMutation.mutate(row.original); }}
                className={cn("p-2 rounded-full transition-colors",
                  row.original.ativo !== false ? "text-green-500 hover:bg-green-50" : "text-slate-300 hover:bg-slate-50"
                )}
                title={row.original.ativo !== false ? 'Desativar' : 'Ativar'}
              >
                {row.original.ativo !== false ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
              </button>
            </>
          )}
          {hasPermission('localizacoes:excluir') && (
            <button
              onClick={(e) => handleDeleteClick(row.original, e)}
              disabled={checkingDelete}
              className="rounded-full p-2 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
              title="Excluir"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-4 rounded-[20px] border border-slate-100 bg-white p-5 shadow-sm">
        <div className="relative flex-1 min-w-0">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar Local por Campus, Bloco ou Sala..."
            className="pl-11 h-12"
          />
        </div>
        
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="h-12 rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 text-[11px] font-black text-[#475569] outline-none"
        >
          <option value="TODOS OS STATUS">TODOS OS STATUS</option>
          <option value="ATIVOS">ATIVOS</option>
          <option value="INATIVOS">INATIVOS</option>
        </select>

        {hasPermission('localizacoes:criar') && (
          <Button onClick={() => { setSelectedLoc(null); setModalOpen(true); }} className="h-12 px-6">
            <Plus size={18} className="mr-2" /> NOVO LOCAL
          </Button>
        )}
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-white overflow-hidden shadow-sm">
        <DataTable
          columns={columns}
          data={filteredData}
          isLoading={isLoading}
          onRowClick={(loc) => { setSelectedLoc(loc); setDetailsOpen(true); }}
        />
      </div>

      {modalOpen && (
        <LocalizacaoModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          localizacao={selectedLoc}
          onSaved={(isEdit, nome) => setFeedback({
            open: true,
            success: true,
            title: isEdit ? 'LOCAL ATUALIZADO' : 'LOCAL CADASTRADO',
            message: isEdit
              ? `<span class="text-slate-700 font-black">${nome}</span> foi atualizado com sucesso.`
              : `<span class="text-slate-700 font-black">${nome}</span> foi cadastrado no sistema.`,
          })}
        />
      )}

      {detailsOpen && selectedLoc && (
        <LocalizacaoDetalhesModal
          isOpen={detailsOpen}
          onClose={() => setDetailsOpen(false)}
          localizacao={selectedLoc}
        />
      )}

      {/* Modal bloqueante — tem equipamentos */}
      <Modal isOpen={deleteBlockOpen} onClose={() => setDeleteBlockOpen(false)} title="NÃO É POSSÍVEL EXCLUIR" icon={AlertTriangle} width="max-w-md">
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">
            <span className="font-black">Campus {locToDelete?.campus}{locToDelete?.bloco ? `, Bloco ${locToDelete.bloco}` : ''}, Sala {locToDelete?.sala}</span> possui {equipamentosAssociados.length} equipamento{equipamentosAssociados.length > 1 ? 's' : ''} alocado{equipamentosAssociados.length > 1 ? 's' : ''} e não pode ser excluído.
          </div>
          <p className="text-xs font-black text-slate-400 tracking-widest uppercase">Equipamentos vinculados</p>
          <div className="max-h-52 overflow-y-auto flex flex-col gap-2 pr-1">
            {equipamentosAssociados.map(e => (
              <div key={e.id} className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
                <Package size={14} className="shrink-0 text-slate-400" />
                <div className="flex flex-col">
                  <span className="text-sm font-black text-[#1E293B]">{e.marca} {e.modelo}</span>
                  <span className="text-[10px] font-bold text-slate-400">{e.numero_patrimonio}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end border-t border-slate-100 pt-4">
            <Button onClick={() => setDeleteBlockOpen(false)} className="font-black px-8">ENTENDIDO</Button>
          </div>
        </div>
      </Modal>

      {/* Modal de confirmação — sem equipamentos */}
      <Modal isOpen={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} title="EXCLUIR LOCAL" icon={AlertTriangle} width="max-w-sm">
        <div className="flex flex-col gap-4">
          <p className="font-bold text-[#1E293B]">
            Tem certeza que deseja excluir <span className="font-black text-red-600">Campus {locToDelete?.campus}{locToDelete?.bloco ? `, Bloco ${locToDelete.bloco}` : ''}, Sala {locToDelete?.sala}</span>?
          </p>
          <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700 font-bold">
            ⚠️ Esta ação é <span className="font-black">irreversível</span>.
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <Button variant="ghost" onClick={() => setDeleteConfirmOpen(false)} className="font-bold text-slate-400 hover:text-slate-600">CANCELAR</Button>
            <Button
              disabled={deleteMutation.isPending}
              onClick={() => { if (locToDelete) { deleteMutation.mutate(locToDelete.id); setDeleteConfirmOpen(false); } }}
              className="bg-red-600 hover:bg-red-700 font-black px-6"
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
      />
    </div>
  );
};

const LocalizacaoModal = ({ isOpen, onClose, localizacao, onSaved }: { isOpen: boolean; onClose: () => void; localizacao: Localizacao | null; onSaved?: (isEdit: boolean, nome: string) => void }) => {
  const queryClient = useQueryClient();
  const { register, handleSubmit, watch, setValue } = useForm({
    defaultValues: localizacao || { ativo: true },
  });

  const isAtivo = watch('ativo');

  const saveMutation = useMutation({
    mutationFn: (data: any) => localizacao ? api.put(`/localizacoes/${localizacao.id}/`, data) : api.post('/localizacoes/', data),
    onSuccess: (_res, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ['localizacoes'] });
      onClose();
      const nome = `Campus ${variables.campus}${variables.bloco ? `, Bloco ${variables.bloco}` : ''}, Sala ${variables.sala}`;
      onSaved?.(!!localizacao, nome);
    },
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={localizacao ? 'EDITAR LOCALIZAÇÃO' : 'NOVO LOCAL'} icon={MapPin} width="max-w-md">
      <form onSubmit={handleSubmit((data) => saveMutation.mutate(data))} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black tracking-widest text-slate-400">CAMPUS *</label>
          <Input {...register('campus', { required: true })} placeholder="Principal" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black tracking-widest text-slate-400">BLOCO / PRÉDIO *</label>
            <Input {...register('bloco', { required: true })} placeholder="Azul" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black tracking-widest text-slate-400">ANDAR *</label>
            <Input {...register('andar', { required: true })} placeholder="2" />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black tracking-widest text-slate-400">SALA / IDENTIFICAÇÃO *</label>
          <Input {...register('sala', { required: true })} placeholder="201" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black tracking-widest text-slate-400">DESCRIÇÃO / OBSERVAÇÕES</label>
          <textarea 
            {...register('descricao')} 
            rows={3}
            className="w-full rounded-xl border-none bg-[#F8FAFC] p-3 text-sm font-bold outline-none ring-[#0000A0] focus:ring-2"
          />
        </div>

        <button
          type="button"
          onClick={() => setValue('ativo', !isAtivo)}
          className={cn(
            "flex items-center gap-3 rounded-xl border p-3 transition-colors",
            isAtivo ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-[#F8FAFC]"
          )}
        >
          <div className={cn("h-5 w-5 rounded border-2 border-slate-300 flex items-center justify-center", isAtivo && "bg-[#0000A0] border-[#0000A0]")}>
            {isAtivo && <div className="h-1.5 w-1.5 rounded-full bg-white"/>}
          </div>
          <span className={cn("text-[11px] font-black", isAtivo ? "text-blue-700" : "text-slate-400")}>LOCAL ATIVO</span>
        </button>

        <div className="mt-4 flex justify-end gap-3 border-t pt-6">
          <Button type="button" variant="ghost" onClick={onClose}>CANCELAR</Button>
          <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'SALVANDO...' : 'SALVAR LOCAL'}</Button>
        </div>
      </form>
    </Modal>
  );
};

const LocalizacaoDetalhesModal = ({ isOpen, onClose, localizacao }: any) => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  
  const { data: todosEquipamentos = [] } = useQuery({
    queryKey: ['equipamentos'],
    queryFn: async () => (await api.get('/equipamentos/')).data,
    enabled: isOpen && hasPermission('equipamentos:ler'),
  });

  const ativos = todosEquipamentos.filter((e: any) =>
    e.localizacao?.id === localizacao.id || e.localizacao_id === localizacao.id
  );

  const InfoRow = ({ label, value }: { label: string; value?: string | null }) => (
    <div className="flex flex-col gap-1 border-b border-slate-50 py-3 last:border-0">
      <span className="text-[10px] font-black tracking-widest text-slate-400">{label.toUpperCase()}</span>
      <span className="text-[13px] font-bold text-[#1E293B]">{value || '--'}</span>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="DETALHES DO LOCAL" icon={MapPin} width="max-w-2xl">
      <div className="flex flex-col gap-6">

        {/* CABEÇALHO */}
        <div className="flex items-center gap-3 rounded-2xl bg-blue-50 p-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
            <MapPin size={20} className="text-[#0000A0]" />
          </div>
          <div>
            <h3 className="text-base font-black text-[#1E3A8A]">
              Campus {localizacao.campus}{localizacao.bloco ? ` | Bloco ${localizacao.bloco}` : ''} | Sala {localizacao.sala}
            </h3>
          </div>
        </div>

        {/* INFORMAÇÕES */}
        <div className="rounded-2xl border border-slate-100 p-5">
          <h4 className="mb-3 text-[10px] font-black tracking-[1.5px] text-slate-400">IDENTIFICAÇÃO</h4>
          <InfoRow label="Campus" value={localizacao.campus} />
          <InfoRow label="Bloco / Prédio" value={localizacao.bloco} />
          <InfoRow label="Andar" value={localizacao.andar} />
          <InfoRow label="Sala" value={localizacao.sala} />
          {localizacao.descricao && <InfoRow label="Descrição" value={localizacao.descricao} />}
        </div>

        {/* EQUIPAMENTOS ALOCADOS */}
        {hasPermission('equipamentos:ler') && (
          <div className="rounded-2xl border border-slate-100 overflow-hidden">
            <div className="bg-slate-50 px-5 py-3 border-b border-slate-100">
              <h4 className="text-[10px] font-black tracking-[1.5px] text-slate-400">
                EQUIPAMENTOS ALOCADOS ({ativos.length})
              </h4>
            </div>
            <div className="max-h-52 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-slate-100 bg-white">
                    <th className="w-8 px-3 py-2"></th>
                    <th className="px-3 py-2 text-left text-[10px] font-black tracking-wider text-slate-400">MARCA / MODELO</th>
                    <th className="px-3 py-2 text-left text-[10px] font-black tracking-wider text-slate-400">PATRIMÔNIO</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {ativos.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-[11px] font-bold text-slate-300">
                        Nenhum equipamento alocado neste local.
                      </td>
                    </tr>
                  ) : (
                    ativos.map((a: any) => {
                      const isAtivo = a.ativo !== false;
                      const isBaixado = a.status?.toUpperCase() === 'BAIXADO';
                      
                      let statusColor = 'bg-green-500';
                      let statusLabel = isAtivo ? 'ATIVO' : 'INATIVO';
                      
                      if (isBaixado) {
                        statusColor = 'bg-slate-400';
                        statusLabel = 'BAIXADO';
                      } else if (!isAtivo) {
                        statusColor = 'bg-red-500';
                      }

                      return (
                        <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                          <td className="px-3 py-2">
                            <div className={`h-2 w-2 rounded-full ${statusColor}`} title={statusLabel} />
                          </td>
                          <td className="px-3 py-2 text-[11px] font-black text-[#1E293B] whitespace-nowrap">{a.marca} {a.modelo}</td>
                          <td className="px-3 py-2 text-[11px] font-black text-[#0000A0] whitespace-nowrap">{!a.is_proprio && a.fornecedor_sigla ? `${a.fornecedor_sigla} - ` : ''}{a.numero_patrimonio || a.patrimonio || '--'}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-right">
                            {hasPermission('movimentacoes:criar') && (
                              <button
                                onClick={() => { onClose(); navigate('/movimentacoes'); }}
                                className="flex items-center gap-1 rounded-lg bg-[#7CFF6B] px-2 py-1 text-[10px] font-black text-[#0000A0] hover:opacity-80 transition-opacity"
                              >
                                MOVER <MoveRight size={11} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex justify-end border-t border-slate-100 pt-4">
          <Button onClick={onClose} className="px-8 font-black">FECHAR</Button>
        </div>
      </div>
    </Modal>
  );
};
