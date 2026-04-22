import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Truck, Plus, Search, Edit2, Trash2, ChevronDown, AlertTriangle, Package, ToggleLeft, ToggleRight } from 'lucide-react';
import { DataTable } from '@/components/ui/DataTable';
import { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/Modal';
import { FeedbackModal } from '@/components/ui/FeedbackModal';
import { useForm } from 'react-hook-form';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

interface Fornecedor {
  id: number;
  nome_empresa: string;
  sigla?: string;
  responsavel: string;
  telefone1: string;
  telefone2?: string;
  cidade: string;
  cnpj: string;
  ativo?: boolean;
}

export const Fornecedores = () => {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedFornecedor, setSelectedFornecedor] = useState<Fornecedor | null>(null);
  const [feedback, setFeedback] = useState<{ open: boolean; success: boolean; title: string; message: string }>({ open: false, success: true, title: '', message: '' });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteBlockOpen, setDeleteBlockOpen] = useState(false);
  const [fornecedorToDelete, setFornecedorToDelete] = useState<Fornecedor | null>(null);
  const [equipamentosAssociados, setEquipamentosAssociados] = useState<{ id: number; marca?: string; modelo?: string; numero_patrimonio?: string }[]>([]);
  const [checkingDelete, setCheckingDelete] = useState(false);

  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();

  const { data: fornecedores = [], isLoading } = useQuery<Fornecedor[]>({
    queryKey: ['fornecedores'],
    queryFn: async () => (await api.get('/fornecedores/')).data,
  });

  const toggleMutation = useMutation({
    mutationFn: (f: Fornecedor) => api.put(`/fornecedores/${f.id}/`, { ativo: !f.ativo }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fornecedores'] }),
    onError: (err: any) => {
      const detail = err.response?.data?.detail || 'Erro ao alterar status.';
      setFeedback({ open: true, success: false, title: 'ERRO', message: detail });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/fornecedores/${id}/`),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['fornecedores'] });
      const nome = `${fornecedorToDelete?.nome_empresa}`;
      const isSoft = res.data?.softDelete;
      setFornecedorToDelete(null);
      setFeedback({ 
        open: true, 
        success: true, 
        title: isSoft ? 'FORNECEDOR DESATIVADO' : 'FORNECEDOR EXCLUÍDO', 
        message: isSoft 
          ? res.data.message 
          : `<span class="text-slate-700 font-black">${nome}</span> foi removido do sistema.` 
      });
    },
    onError: (err: any) => {
      const detail = err.response?.data?.detail || 'Erro ao excluir fornecedor.';
      setFeedback({ open: true, success: false, title: 'ERRO AO EXCLUIR', message: detail });
    },
  });

  const handleDeleteClick = async (fornecedor: Fornecedor) => {
    setFornecedorToDelete(fornecedor);
    setCheckingDelete(true);
    try {
      const res = await api.get(`/equipamentos/?fornecedor_id=${fornecedor.id}`);
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

  const filteredData = fornecedores.filter(f =>
    f.nome_empresa.toLowerCase().includes(search.toLowerCase()) ||
    (f.cnpj && f.cnpj.includes(search)) ||
    (f.sigla && f.sigla.toLowerCase().includes(search.toLowerCase()))
  );

  const columns: ColumnDef<Fornecedor>[] = [
    {
      accessorKey: 'nome_empresa',
      header: 'EMPRESA',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          {row.original.sigla && (
            <div className="flex h-8 w-12 shrink-0 items-center justify-center rounded-lg bg-[#0000A0]/10 text-[11px] font-black text-[#0000A0]">
              {row.original.sigla}
            </div>
          )}
          <span className="font-black text-[#1E293B]">{row.original.nome_empresa}</span>
        </div>
      ),
    },
    { accessorKey: 'cnpj', header: 'CNPJ', cell: ({ row }) => <span className="font-bold text-slate-500">{row.original.cnpj}</span> },
    { accessorKey: 'responsavel', header: 'RESPONSÁVEL', cell: ({ row }) => <span className="font-bold text-slate-600">{row.original.responsavel}</span> },
    {
      accessorKey: 'telefone1',
      header: 'TELEFONE',
      cell: ({ row }) => (
        <span className="font-bold text-slate-500">
          {row.original.telefone1}{row.original.telefone2 ? ` / ${row.original.telefone2}` : ''}
        </span>
      ),
    },
    { accessorKey: 'cidade', header: 'CIDADE', cell: ({ row }) => <span className="font-bold text-slate-500">{row.original.cidade}</span> },
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
          {hasPermission('fornecedores:editar') && (
            <button
              onClick={() => { setSelectedFornecedor(row.original); setModalOpen(true); }}
              className="rounded-full p-2 text-blue-500 hover:bg-blue-50 transition-colors"
              title="Editar"
            >
              <Edit2 size={16} />
            </button>
          )}
          {hasPermission('fornecedores:editar') && (
            <button
              onClick={() => toggleMutation.mutate(row.original)}
              className={cn("p-2 rounded-full transition-colors",
                row.original.ativo !== false ? "text-green-500 hover:bg-green-50" : "text-slate-300 hover:bg-slate-50"
              )}
              title={row.original.ativo !== false ? 'Desativar' : 'Ativar'}
            >
              {row.original.ativo !== false ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
            </button>
          )}
          {hasPermission('fornecedores:excluir') && (
            <button
              onClick={() => handleDeleteClick(row.original)}
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
      <div className="flex flex-wrap items-center gap-4 rounded-[20px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(0,0,0,0.02)]">
        <div className="relative flex-1 min-w-0">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por empresa, sigla ou CNPJ..."
            className="pl-11 h-12"
          />
        </div>
        {hasPermission('fornecedores:criar') && (
          <Button onClick={() => { setSelectedFornecedor(null); setModalOpen(true); }} className="h-12 px-6 shadow-lg shadow-[#0000A0]/20">
            <Plus size={18} className="mr-2" /> NOVO FORNECEDOR
          </Button>
        )}
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-white overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.02)]">
        <DataTable columns={columns} data={filteredData} isLoading={isLoading} emptyMessage="Nenhum fornecedor cadastrado." />
      </div>

      {modalOpen && (
        <FornecedorModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          fornecedor={selectedFornecedor}
          onSaved={(isEdit, nome) => setFeedback({
            open: true,
            success: true,
            title: isEdit ? 'FORNECEDOR ATUALIZADO' : 'FORNECEDOR CADASTRADO',
            message: isEdit
              ? `<span class="text-slate-700 font-black">${nome}</span> foi atualizado com sucesso.`
              : `<span class="text-slate-700 font-black">${nome}</span> foi cadastrado no sistema.`,
          })}
        />
      )}

      {/* Modal de bloqueio — tem equipamentos associados */}
      <Modal isOpen={deleteBlockOpen} onClose={() => setDeleteBlockOpen(false)} title="NÃO É POSSÍVEL EXCLUIR" icon={AlertTriangle} width="max-w-md">
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">
            <span className="font-black">{fornecedorToDelete?.nome_empresa}</span> possui {equipamentosAssociados.length} equipamento{equipamentosAssociados.length > 1 ? 's' : ''} associado{equipamentosAssociados.length > 1 ? 's' : ''} e não pode ser excluído.
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
      <Modal isOpen={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} title="EXCLUIR FORNECEDOR" icon={AlertTriangle} width="max-w-sm">
        <div className="flex flex-col gap-4">
          <p className="font-bold text-[#1E293B]">
            Tem certeza que deseja excluir <span className="font-black text-red-600">{fornecedorToDelete?.nome_empresa}</span>?
          </p>
          <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700 font-bold">
            ⚠️ Esta ação é <span className="font-black">irreversível</span>.
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <Button variant="ghost" onClick={() => setDeleteConfirmOpen(false)} className="font-bold text-slate-400 hover:text-slate-600">CANCELAR</Button>
            <Button
              disabled={deleteMutation.isPending}
              onClick={() => { if (fornecedorToDelete) { deleteMutation.mutate(fornecedorToDelete.id); setDeleteConfirmOpen(false); } }}
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

const maskTelefone = (value: string) => {
  const v = value.replace(/\D/g, '').slice(0, 11);
  if (v.length <= 10) {
    // Fixo: (00) 0000-0000
    return v.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  }
  // Celular: (00) 00000-0000
  return v.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
};

// ──────────────────────────────────────────────────────
// Seletor de Estado + Cidade via API do IBGE
// ──────────────────────────────────────────────────────
const CidadeSelect = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (cidade: string, estado: string) => void;
}) => {
  const [uf, setUf] = useState('');
  const [search, setSearch] = useState(value || '');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const { data: estados = [] } = useQuery<{ id: number; sigla: string; nome: string }[]>({
    queryKey: ['ibge-estados'],
    queryFn: () =>
      fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome')
        .then((r) => r.json()),
    staleTime: Infinity,
  });

  const { data: cidades = [], isLoading: loadingCidades } = useQuery<{ id: number; nome: string }[]>({
    queryKey: ['ibge-cidades', uf],
    queryFn: () =>
      fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`)
        .then((r) => r.json()),
    enabled: !!uf,
    staleTime: Infinity,
  });

  const filtradas = cidades.filter((c) =>
    c.nome.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="grid grid-cols-5 gap-3">
      {/* ESTADO */}
      <div className="col-span-2 flex flex-col gap-2">
        <label className="text-[10px] font-black tracking-widest text-slate-400">ESTADO *</label>
        <select
          value={uf}
          onChange={(e) => { setUf(e.target.value); setSearch(''); onChange('', e.target.value); }}
          className="h-10 rounded-xl bg-[#F8FAFC] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0000A0]"
        >
          <option value="">Selecione...</option>
          {estados.map((e) => (
            <option key={e.id} value={e.sigla}>{e.sigla} — {e.nome}</option>
          ))}
        </select>
      </div>

      {/* CIDADE */}
      <div className="col-span-3 flex flex-col gap-2" ref={ref}>
        <label className="text-[10px] font-black tracking-widest text-slate-400">CIDADE *</label>
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
            onFocus={() => uf && setOpen(true)}
            disabled={!uf}
            placeholder={uf ? (loadingCidades ? 'Carregando...' : 'Buscar cidade...') : 'Selecione o estado'}
            className="h-10 w-full rounded-xl bg-[#F8FAFC] pl-8 pr-8 text-sm outline-none focus:ring-2 focus:ring-[#0000A0] disabled:cursor-not-allowed disabled:opacity-50"
          />
          <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />

          {open && filtradas.length > 0 && (
            <div className="absolute z-50 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
              {filtradas.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setSearch(c.nome);
                    setOpen(false);
                    onChange(c.nome, uf);
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-blue-50 hover:text-[#0000A0]"
                >
                  {c.nome}
                </button>
              ))}
            </div>
          )}
          {open && uf && !loadingCidades && filtradas.length === 0 && (
            <div className="absolute z-50 mt-1 w-full rounded-xl border border-slate-100 bg-white px-4 py-3 text-sm font-bold text-slate-400 shadow-lg">
              Nenhuma cidade encontrada.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const FornecedorModal = ({ isOpen, onClose, fornecedor, onSaved }: { isOpen: boolean; onClose: () => void; fornecedor: Fornecedor | null; onSaved?: (isEdit: boolean, nome: string) => void }) => {
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<Fornecedor>({
    defaultValues: fornecedor || {},
  });
  const [feedback, setFeedback] = useState<{ open: boolean; success: boolean; title: string; message: string }>({
    open: false,
    success: true,
    title: '',
    message: '',
  });
  const cidadeValue = watch('cidade') || '';

  const saveMutation = useMutation({
    mutationFn: (data: any) => {
      const payload = {
        ...data,
        sigla: data.sigla ? data.sigla.toUpperCase().slice(0, 3) : null,
      };
      return fornecedor
        ? api.put(`/fornecedores/${fornecedor.id}/`, payload)
        : api.post('/fornecedores/', payload);
    },
    onSuccess: (_res, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ['fornecedores'] });
      onClose();
      onSaved?.(!!fornecedor, variables.nome_empresa || '');
    },
    onError: (err: any) => {
      const detail = err.response?.data?.detail;
      const msg = Array.isArray(detail) ? detail.map((e: any) => e.msg).join('<br/>') : detail || 'Erro ao salvar fornecedor';
      setFeedback({ open: true, success: false, title: 'ERRO AO SALVAR', message: msg });
    },
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={fornecedor ? 'EDITAR FORNECEDOR' : 'NOVO FORNECEDOR'} icon={Truck} width="max-w-lg">
      <form onSubmit={handleSubmit((data) => saveMutation.mutate(data))} className="flex flex-col gap-4">

        {/* NOME + SIGLA */}
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 flex flex-col gap-2">
            <label className="text-[10px] font-black tracking-widest text-slate-400">NOME / RAZÃO SOCIAL *</label>
            <Input {...register('nome_empresa', { required: true })} placeholder="ex: Funcesi Tecnologia Ltda" />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black tracking-widest text-slate-400">
              SIGLA
              <span className="ml-1 text-slate-300 font-bold">(3 letras)</span>
            </label>
            <Input
              {...register('sigla', {
                maxLength: 3,
                pattern: { value: /^[A-Za-z]{0,3}$/, message: 'Apenas letras' },
              })}
              placeholder="FUN"
              maxLength={3}
              className="uppercase font-black tracking-widest text-center"
              style={{ textTransform: 'uppercase' }}
            />
            {errors.sigla && <span className="text-[10px] text-red-500 font-bold">{errors.sigla.message}</span>}
          </div>
        </div>

        {/* CNPJ */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-black tracking-widest text-slate-400">CNPJ *</label>
          <Input
            {...register('cnpj', { required: true })}
            placeholder="00.000.000/0000-00"
            maxLength={18}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 14);
              const masked = v
                .replace(/^(\d{2})(\d)/, '$1.$2')
                .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
                .replace(/\.(\d{3})(\d)/, '.$1/$2')
                .replace(/(\d{4})(\d)/, '$1-$2');
              e.target.value = masked;
            }}
          />
        </div>

        {/* RESPONSÁVEL */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-black tracking-widest text-slate-400">RESPONSÁVEL *</label>
          <Input {...register('responsavel', { required: true })} placeholder="Nome do responsável pelo contrato" />
        </div>

        {/* TELEFONES */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black tracking-widest text-slate-400">TELEFONE PRINCIPAL *</label>
            <Input
              {...register('telefone1', { required: true })}
              placeholder="(00) 00000-0000"
              maxLength={15}
              onChange={(e) => { e.target.value = maskTelefone(e.target.value); }}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black tracking-widest text-slate-400">TELEFONE SECUNDÁRIO</label>
            <Input
              {...register('telefone2')}
              placeholder="(00) 00000-0000"
              maxLength={15}
              onChange={(e) => { e.target.value = maskTelefone(e.target.value); }}
            />
          </div>
        </div>

        {/* ESTADO + CIDADE */}
        <CidadeSelect
          value={cidadeValue}
          onChange={(cidade) => setValue('cidade', cidade, { shouldValidate: true })}
        />
        <input type="hidden" {...register('cidade', { required: true })} />

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
          <Button type="button" variant="ghost" onClick={onClose} className="font-bold text-slate-400 hover:text-slate-600">CANCELAR</Button>
          <Button type="submit" disabled={saveMutation.isPending} className="font-black px-8">
            {saveMutation.isPending ? 'SALVANDO...' : 'SALVAR FORNECEDOR'}
          </Button>
        </div>
      </form>

      <FeedbackModal
        isOpen={feedback.open}
        onClose={() => setFeedback((f) => ({ ...f, open: false }))}
        success={feedback.success}
        title={feedback.title}
        message={feedback.message}
      />
    </Modal>
  );
};
