import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { LayoutGrid, Search, Plus, Edit2, Trash2, AlertTriangle, Package } from 'lucide-react';
import { DataTable } from '@/components/ui/DataTable';
import { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/Modal';
import { FeedbackModal } from '@/components/ui/FeedbackModal';
import { useForm } from 'react-hook-form';
import { useAuth } from '@/contexts/AuthContext';

interface Categoria {
  id: number;
  nome: string;
  campos_especificacoes?: string;
}

interface SpecField {
  key: string;
  label: string;
}

export const Categorias = () => {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCat, setSelectedCat] = useState<Categoria | null>(null);
  const [feedback, setFeedback] = useState<{ open: boolean; success: boolean; title: string; message: string }>({ open: false, success: true, title: '', message: '' });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteBlockOpen, setDeleteBlockOpen] = useState(false);
  const [catToDelete, setCatToDelete] = useState<Categoria | null>(null);
  const [catToView, setCatToView] = useState<Categoria | null>(null);
  const [equipamentosAssociados, setEquipamentosAssociados] = useState<number>(0);
  const [checkingDelete, setCheckingDelete] = useState(false);
  const { hasPermission } = useAuth();

  const queryClient = useQueryClient();

  const { data: categorias = [], isLoading } = useQuery<Categoria[]>({
    queryKey: ['categorias'],
    queryFn: async () => (await api.get('/categorias/')).data,
    staleTime: 5 * 60 * 1000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/categorias/${id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categorias'] });
      const nome = catToDelete?.nome;
      setCatToDelete(null);
      setFeedback({ 
        open: true, 
        success: true, 
        title: 'CATEGORIA EXCLUÍDA', 
        message: `<span class="text-slate-700 font-black">${nome}</span> foi removida com sucesso.` 
      });
    },
    onError: (err: any) => {
      const detail = err.response?.data?.detail || 'Erro ao excluir categoria.';
      setFeedback({ open: true, success: false, title: 'ERRO AO EXCLUIR', message: detail });
    },
  });

  const handleDeleteClick = async (cat: Categoria, e: React.MouseEvent) => {
    e.stopPropagation();
    setCatToDelete(cat);
    setCheckingDelete(true);
    try {
      // Verificar se existem equipamentos com este tipo
      const res = await api.get(`/equipamentos/?tipo=${cat.nome}`);
      const count = res.data?.length || 0;
      if (count > 0) {
        setEquipamentosAssociados(count);
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

  const filteredData = categorias.filter(cat => 
    cat.nome.toLowerCase().includes(search.toLowerCase())
  );

  const columns: ColumnDef<Categoria>[] = [
    {
      accessorKey: 'nome',
      header: 'NOME DA CATEGORIA',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <Package size={14} className="text-blue-500" />
          <span className="font-black text-[#1E293B]">{row.original.nome.toUpperCase()}</span>
        </div>
      ),
    },
    {
      id: 'acoes',
      header: 'AÇÕES',
      size: 100,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          {hasPermission('categorias:editar') && (
            <button
              onClick={(e) => { e.stopPropagation(); setSelectedCat(row.original); setModalOpen(true); }}
              className="rounded-full p-2 text-blue-500 hover:bg-blue-50 transition-colors"
              title="Editar"
            >
              <Edit2 size={16} />
            </button>
          )}
          {hasPermission('categorias:excluir') && (
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
            placeholder="Buscar Categoria..."
            className="pl-11 h-12"
          />
        </div>

        {hasPermission('categorias:criar') && (
          <Button onClick={() => { setSelectedCat(null); setModalOpen(true); }} className="h-12 px-6">
            <Plus size={18} className="mr-2" /> NOVA CATEGORIA
          </Button>
        )}
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.02)] overflow-hidden">
        <DataTable
          columns={columns}
          data={filteredData}
          isLoading={isLoading}
          onRowClick={(cat) => setCatToView(cat)}
        />
      </div>

      {modalOpen && (
        <CategoriaModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          categoria={selectedCat}
          onSaved={(isEdit, nome) => setFeedback({
            open: true,
            success: true,
            title: isEdit ? 'CATEGORIA ATUALIZADA' : 'CATEGORIA CADASTRADA',
            message: isEdit
              ? `<span class="text-slate-700 font-black">${nome}</span> foi atualizada com sucesso.`
              : `<span class="text-slate-700 font-black">${nome}</span> foi cadastrada no sistema.`,
          })}
        />
      )}

      {catToView && (
        <CategoriaDetalhesModal
          isOpen={!!catToView}
          onClose={() => setCatToView(null)}
          categoria={catToView}
        />
      )}

      {/* Modal bloqueante — tem equipamentos vinculados */}
      <Modal isOpen={deleteBlockOpen} onClose={() => setDeleteBlockOpen(false)} title="NÃO É POSSÍVEL EXCLUIR" icon={AlertTriangle} width="max-w-md">
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">
            A categoria <span className="font-black">{catToDelete?.nome}</span> possui {equipamentosAssociados} equipamento{equipamentosAssociados > 1 ? 's' : ''} vinculado{equipamentosAssociados > 1 ? 's' : ''} e não pode ser excluída.
          </div>
          <p className="text-xs font-bold text-slate-500">
            Para excluir esta categoria, você deve primeiro alterar o tipo de todos os equipamentos vinculados a ela.
          </p>
          <div className="flex justify-end border-t border-slate-100 pt-4">
            <Button onClick={() => setDeleteBlockOpen(false)} className="font-black px-8">ENTENDIDO</Button>
          </div>
        </div>
      </Modal>

      {/* Modal de confirmação — sem vínculos */}
      <Modal isOpen={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} title="EXCLUIR CATEGORIA" icon={AlertTriangle} width="max-w-sm">
        <div className="flex flex-col gap-4">
          <p className="font-bold text-[#1E293B]">
            Tem certeza que deseja excluir <span className="font-black text-red-600">{catToDelete?.nome}</span>?
          </p>
          <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700 font-bold">
            ⚠️ Esta ação removerá a opção do cadastro de novos ativos.
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <Button variant="ghost" onClick={() => setDeleteConfirmOpen(false)} className="font-bold text-slate-400 hover:text-slate-600">CANCELAR</Button>
            <Button
              disabled={deleteMutation.isPending}
              onClick={() => { if (catToDelete) { deleteMutation.mutate(catToDelete.id); setDeleteConfirmOpen(false); } }}
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

const CategoriaModal = ({ isOpen, onClose, categoria, onSaved }: { isOpen: boolean; onClose: () => void; categoria: Categoria | null; onSaved?: (isEdit: boolean, nome: string) => void }) => {
  const queryClient = useQueryClient();
  const [fields, setFields] = useState<SpecField[]>(() => {
    // Tenta ler de várias possíveis chaves (snake_case, camelCase, PascalCase)
    const jsonStr = (categoria as any)?.campos_especificacoes || 
                    (categoria as any)?.camposEspecificacoes || 
                    (categoria as any)?.CamposEspecificacoes;
                    
    if (jsonStr) {
      try { return JSON.parse(jsonStr); } catch { return []; }
    }
    return [];
  });

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: categoria || { nome: '' },
  });

  const addField = () => {
    setFields([...fields, { key: '', label: '' }]);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const updateField = (index: number, part: Partial<SpecField>) => {
    const next = [...fields];
    next[index] = { ...next[index], ...part };
    
    // Auto-gerar key a partir do label se a key estiver vazia ou for igual ao label antigo
    if (part.label && !next[index].key) {
      next[index].key = part.label.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remover acentos
        .replace(/[^a-z0-9]/g, '_') // Slugify
        .replace(/_+/g, '_');
    }
    
    setFields(next);
  };

  const saveMutation = useMutation({
    mutationFn: (data: any) => {
      const payload = {
        ...data,
        campos_especificacoes: JSON.stringify(fields.filter(f => f.key && f.label))
      };
      return categoria ? api.put(`/categorias/${categoria.id}/`, payload) : api.post('/categorias/', payload);
    },
    onSuccess: (_res, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ['categorias'] });
      onClose();
      onSaved?.(!!categoria, variables.nome);
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Erro ao salvar categoria.');
    }
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={categoria ? 'EDITAR CATEGORIA' : 'NOVA CATEGORIA'} icon={LayoutGrid} width="max-w-xl">
      <form onSubmit={handleSubmit((data) => saveMutation.mutate(data))} className="flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black tracking-widest text-slate-400">NOME DA CATEGORIA *</label>
          <Input 
            {...register('nome', { required: "O nome é obrigatório" })} 
            placeholder="Ex: Desktop, Notebook, etc." 
            autoFocus
          />
          {errors.nome && <span className="text-[10px] font-bold text-red-500 uppercase">{errors.nome.message}</span>}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-black tracking-widest text-slate-400">ESPECIFICAÇÕES TÉCNICAS (CAMPOS JSON)</label>
            <Button type="button" variant="ghost" size="sm" onClick={addField} className="text-[#0000A0] h-7 px-2 text-[9px] font-black">
              <Plus size={14} className="mr-1" /> ADICIONAR CAMPO
            </Button>
          </div>

          <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
            {fields.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center bg-slate-50/50">
                <p className="text-[10px] font-bold text-slate-400">Nenhum campo técnico definido.</p>
              </div>
            ) : (
              fields.map((field, index) => (
                <div key={index} className="flex gap-2 items-start bg-slate-50/80 p-3 rounded-2xl border border-slate-100 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="flex-1 flex flex-col gap-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Rótulo Exibido</label>
                    <Input 
                      value={field.label} 
                      onChange={e => updateField(index, { label: e.target.value })}
                      placeholder="Ex: Processador"
                      className="h-10 text-xs"
                    />
                  </div>
                  <div className="flex-1 flex flex-col gap-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Chave no JSON</label>
                    <Input 
                      value={field.key} 
                      onChange={e => updateField(index, { key: e.target.value })}
                      placeholder="Ex: processador"
                      className="h-10 text-xs bg-white/50"
                    />
                  </div>
                  <button 
                    type="button" 
                    onClick={() => removeField(index)}
                    className="mt-6 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
          <p className="text-[9px] font-bold text-slate-400 leading-tight">
            Estes campos aparecerão no cadastro de ativos para esta categoria. <br/>
            Dica: Use chaves curtas e sem espaços.
          </p>
        </div>

        <div className="mt-4 flex justify-end gap-3 border-t pt-6">
          <Button type="button" variant="ghost" onClick={onClose}>CANCELAR</Button>
          <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'SALVANDO...' : 'SALVAR CATEGORIA'}</Button>
        </div>
      </form>
    </Modal>
  );
};

const CategoriaDetalhesModal = ({ isOpen, onClose, categoria }: { isOpen: boolean; onClose: () => void; categoria: Categoria }) => {
  const fields: SpecField[] = (() => {
    const jsonStr = (categoria as any)?.campos_especificacoes || 
                    (categoria as any)?.camposEspecificacoes || 
                    (categoria as any)?.CamposEspecificacoes;
                    
    if (!jsonStr) return [];
    try { return JSON.parse(jsonStr); } catch { return []; }
  })();

  const InfoRow = ({ label, value }: { label: string; value?: string | number | null }) => (
    <div className="flex flex-col gap-1 border-b border-slate-50 py-3 last:border-0">
      <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">
        {label}
      </span>
      <span className="text-[13px] font-bold text-[#1E293B]">
        {value || '--'}
      </span>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="DETALHES DA CATEGORIA" icon={Package} width="max-w-2xl">
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Coluna 1: Info Básica */}
          <div className="flex flex-col">
             <InfoRow label="NOME DA CATEGORIA" value={categoria.nome.toUpperCase()} />
             <InfoRow label="ID NO SISTEMA" value={categoria.id} />
          </div>

          {/* Coluna 2: Especificações */}
          <div className="flex flex-col gap-4">
            <h4 className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Campos Técnicos Configurados</h4>
            <div className="flex flex-col gap-2">
              {fields.length === 0 ? (
                <p className="text-[11px] font-bold text-slate-400 italic">Nenhum campo técnico definido.</p>
              ) : (
                fields.map(f => (
                  <div key={f.key} className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-2xl">
                    <div className="h-1.5 w-1.5 rounded-full bg-[#0000A0]" />
                    <div className="flex flex-col">
                      <span className="text-[11px] font-black text-slate-700">{f.label}</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Chave: {f.key}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-5 flex justify-end">
          <Button onClick={onClose} className="px-8 font-black shadow-lg shadow-[#0000A0]/20">FECHAR</Button>
        </div>
      </div>
    </Modal>
  );
};
