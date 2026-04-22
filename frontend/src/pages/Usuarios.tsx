import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { User, UserPlus, Search, Key, Trash2, AlertTriangle, Edit2, ToggleLeft, ToggleRight, Eye, EyeOff, Check, X } from 'lucide-react';
import { DataTable } from '@/components/ui/DataTable';
import { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/Modal';
import { FeedbackModal } from '@/components/ui/FeedbackModal';
import { useForm } from 'react-hook-form';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

interface Perfil {
  id: number;
  nome: string;
}

interface Usuario {
  id: number;
  matricula: string;
  nome: string;
  email: string;
  ativo: boolean;
  perfil?: Perfil;
  perfil_id?: number;
}

export const Usuarios = () => {
  const [search, setSearch] = useState('');
  const [filterPerfilId, setFilterPerfilId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [senhaOpen, setSenhaOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Usuario | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<Usuario | null>(null);
  const [feedback, setFeedback] = useState<{ open: boolean; success: boolean; title: string; message: string }>({ open: false, success: true, title: '', message: '' });

  const queryClient = useQueryClient();
  const { user: currentUser, hasPermission } = useAuth();

  const { data: usuarios = [], isLoading } = useQuery<Usuario[]>({
    queryKey: ['usuarios'],
    queryFn: async () => (await api.get('/usuarios/')).data,
  });

  const { data: perfis = [] } = useQuery<Perfil[]>({
    queryKey: ['perfis'],
    queryFn: async () => (await api.get('/perfis/')).data,
  });

  const toggleStatusMutation = useMutation({
    mutationFn: (u: Usuario) => api.put(`/usuarios/${u.id}/`, { ativo: !u.ativo }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['usuarios'] }),
    onError: (err: any) => {
      const detail = err.response?.data?.detail || 'Erro ao alterar status.';
      setFeedback({ open: true, success: false, title: 'ERRO', message: Array.isArray(detail) ? detail.map((e: any) => e.msg).join(', ') : detail });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/usuarios/${id}/`),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      const nome = `${userToDelete?.nome}`;
      const isSoft = res.data?.softDelete;
      setUserToDelete(null);
      setFeedback({ 
        open: true, 
        success: true, 
        title: isSoft ? 'USUÁRIO DESATIVADO' : 'USUÁRIO EXCLUÍDO', 
        message: isSoft 
          ? res.data.message 
          : `<span class="text-slate-700 font-black">${nome}</span> foi removido do sistema.` 
      });
    },
    onError: (err: any) => {
      const detail = err.response?.data?.detail || 'Erro ao excluir usuário.';
      setFeedback({ open: true, success: false, title: 'ERRO AO EXCLUIR', message: detail });
    },
  });

  const filteredData = usuarios.filter(u => {
    const s = search.toLowerCase();
    const matchSearch = !search || u.nome.toLowerCase().includes(s) || u.matricula.toLowerCase().includes(s);
    const matchPerfil = !filterPerfilId || u.perfil_id === filterPerfilId || u.perfil?.id === filterPerfilId;
    return matchSearch && matchPerfil;
  });

  const columns: ColumnDef<Usuario>[] = [
    { accessorKey: 'matricula', header: 'USUÁRIO' },
    { accessorKey: 'nome', header: 'NOME', cell: ({ row }) => <span className="font-black text-[#1E293B]">{row.original.nome}</span> },
    {
      accessorKey: 'perfil',
      header: 'PERFIL',
      cell: ({ row }) => (
        <div className="inline-flex rounded-xl bg-blue-50 px-3 py-1 text-[9px] font-black text-blue-700 uppercase">
          {row.original.perfil?.nome || 'NENHUM'}
        </div>
      )
    },
    {
      accessorKey: 'ativo',
      header: 'STATUS',
      cell: ({ row }) => (
        <div className={cn(
          "inline-flex rounded-xl px-3 py-1 text-[9px] font-black uppercase",
          row.original.ativo ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
        )}>
          {row.original.ativo ? 'ATIVO' : 'INATIVO'}
        </div>
      )
    },
    {
      id: 'acoes',
      header: 'AÇÕES',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          {hasPermission('usuarios:editar') && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setSelectedUser(row.original); setModalOpen(true); }}
                className="p-2 text-blue-500 hover:bg-blue-50 rounded-full"
                title="Editar"
              >
                <Edit2 size={16} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); toggleStatusMutation.mutate(row.original); }}
                disabled={row.original.id === currentUser?.id}
                className={cn("p-2 rounded-full transition-colors",
                  row.original.id === currentUser?.id ? "opacity-30 cursor-not-allowed" :
                  row.original.ativo ? "text-green-500 hover:bg-green-50" : "text-slate-300 hover:bg-slate-50"
                )}
                title={row.original.id === currentUser?.id ? 'Não é possível desativar seu próprio usuário' : row.original.ativo ? 'Desativar' : 'Ativar'}
              >
                {row.original.ativo ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
              </button>
            </>
          )}
          {hasPermission('usuarios:excluir') && (
            <button
              onClick={(e) => { e.stopPropagation(); setUserToDelete(row.original); setDeleteConfirmOpen(true); }}
              disabled={row.original.id === currentUser?.id}
              className={cn("p-2 rounded-full transition-colors",
                row.original.id === currentUser?.id ? "opacity-30 cursor-not-allowed" : "text-red-500 hover:bg-red-50"
              )}
              title={row.original.id === currentUser?.id ? 'Não é possível excluir seu próprio usuário' : 'Excluir'}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-4 rounded-[20px] border border-slate-100 bg-white p-5 shadow-sm">
        <div className="relative flex-1 min-w-0">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou usuário..." className="pl-11 h-12" />
        </div>
        <select
          value={filterPerfilId || ''}
          onChange={(e) => setFilterPerfilId(Number(e.target.value) || null)}
          className="h-12 rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 text-[11px] font-black text-[#475569] outline-none"
        >
          <option value="">TODOS OS PERFIS</option>
          {perfis.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        {hasPermission('usuarios:criar') && (
          <Button onClick={() => { setSelectedUser(null); setModalOpen(true); }} className="h-12 px-6">
            <UserPlus size={18} className="mr-2" /> NOVO USUÁRIO
          </Button>
        )}
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-white overflow-hidden shadow-sm">
        <DataTable
          columns={columns}
          data={filteredData}
          isLoading={isLoading}
          onRowClick={(u) => { setSelectedUser(u); setDetailsOpen(true); }}
        />
      </div>

      {modalOpen && (
        <UsuarioModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          usuario={selectedUser}
          perfis={perfis}
          onSaved={(isEdit: boolean, nome: string) => setFeedback({
            open: true, success: true,
            title: isEdit ? 'USUÁRIO ATUALIZADO' : 'USUÁRIO CADASTRADO',
            message: isEdit
              ? `<span class="text-slate-700 font-black">${nome}</span> foi atualizado com sucesso.`
              : `<span class="text-slate-700 font-black">${nome}</span> foi cadastrado no sistema.`,
          })}
          setFeedback={setFeedback}
          onSenha={() => { setModalOpen(false); setSenhaOpen(true); }}
        />
      )}

      {detailsOpen && selectedUser && (
        <UsuarioDetalhesModal
          isOpen={detailsOpen}
          onClose={() => setDetailsOpen(false)}
          usuario={selectedUser}
        />
      )}

      {senhaOpen && selectedUser && (
        <RedefinirSenhaModal
          isOpen={senhaOpen}
          onClose={() => setSenhaOpen(false)}
          usuario={selectedUser}
          onSaved={(nome: string) => setFeedback({ open: true, success: true, title: 'SENHA REDEFINIDA', message: `Senha de <span class="text-slate-700 font-black">${nome}</span> atualizada com sucesso.` })}
        />
      )}

      <Modal isOpen={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} title="EXCLUIR USUÁRIO" icon={AlertTriangle} width="max-w-sm">
        <div className="flex flex-col gap-4">
          <p className="font-bold text-[#1E293B]">
            Tem certeza que deseja excluir <span className="font-black text-red-600">{userToDelete?.nome}</span>?
          </p>
          <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700 font-bold">
            ⚠️ Esta ação é <span className="font-black">irreversível</span>.
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <Button variant="ghost" onClick={() => setDeleteConfirmOpen(false)} className="font-bold text-slate-400 hover:text-slate-600">CANCELAR</Button>
            <Button
              disabled={deleteMutation.isPending}
              onClick={() => { if (userToDelete) { deleteMutation.mutate(userToDelete.id); setDeleteConfirmOpen(false); } }}
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

const UsuarioModal = ({ isOpen, onClose, usuario, perfis, onSaved, onSenha, setFeedback }: any) => {
  const queryClient = useQueryClient();
  const { register, handleSubmit, watch } = useForm({ defaultValues: usuario || { ativo: true } });
  const [showSenha, setShowSenha] = useState(false);
  const senha = watch('senha') || '';

  const requisitos = [
    { label: 'Mínimo 8 caracteres', ok: senha.length >= 8 },
    { label: 'Letra maiúscula', ok: /[A-Z]/.test(senha) },
    { label: 'Letra minúscula', ok: /[a-z]/.test(senha) },
    { label: 'Número', ok: /[0-9]/.test(senha) },
    { label: 'Caractere especial', ok: /[^A-Za-z0-9]/.test(senha) },
  ];

  const saveMutation = useMutation({
    mutationFn: (data: any) => usuario ? api.put(`/usuarios/${usuario.id}/`, data) : api.post('/usuarios/', data),
    onSuccess: (_res, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      onClose();
      onSaved?.(!!usuario, variables.nome || '');
    },
    onError: (err: any) => {
      const detail = err.response?.data?.detail || 'Erro ao salvar usuário.';
      setFeedback({ 
        open: true, 
        success: false, 
        title: 'ERRO AO SALVAR', 
        message: Array.isArray(detail) ? detail.map((e: any) => e.msg).join(', ') : detail 
      });
    },
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={usuario ? 'EDITAR USUÁRIO' : 'NOVO USUÁRIO'} icon={User} width="max-w-lg">
      <form onSubmit={handleSubmit(d => saveMutation.mutate(d))} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Nome Completo</label>
          <Input {...register('nome', { required: true })} placeholder="Nome do usuário" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Usuário</label>
            <Input {...register('matricula', { required: true })} placeholder="usuario" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase">E-mail</label>
            <Input {...register('email', { required: true })} placeholder="email@exemplo.com" />
          </div>
        </div>
        {!usuario && (
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Senha</label>
              <div className="relative">
                <Input type={showSenha ? 'text' : 'password'} {...register('senha', { required: true })} placeholder="Digite a senha inicial" className="pr-10" />
                <button type="button" onClick={() => setShowSenha(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {senha.length > 0 && (
              <div className="rounded-xl bg-slate-50 p-3 flex flex-col gap-1.5">
                <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase mb-1">Requisitos de senha</p>
                {requisitos.map(r => (
                  <div key={r.label} className={cn("flex items-center gap-2 text-[11px] font-bold transition-colors", r.ok ? "text-green-600" : "text-slate-400")}>
                    {r.ok ? <Check size={12} className="shrink-0" /> : <X size={12} className="shrink-0" />}
                    <span className={r.ok ? 'line-through' : ''}>{r.label}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Perfil de Acesso</label>
          <select {...register('perfil_id', { valueAsNumber: true })} className="h-12 rounded-xl border-none bg-[#F8FAFC] px-4 text-sm font-bold outline-none ring-[#0000A0] focus:ring-2">
            <option value="">Selecione...</option>
            {perfis.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>
        <div className="mt-4 flex items-center justify-between border-t pt-6">
          {usuario ? (
            <Button type="button" onClick={onSenha} className="bg-orange-50 text-orange-600 border border-orange-100 hover:bg-orange-100 shadow-none flex items-center gap-2">
              <Key size={14} /> REDEFINIR SENHA
            </Button>
          ) : <div />}
          <div className="flex gap-3">
            <Button type="button" variant="ghost" onClick={onClose}>CANCELAR</Button>
            <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'SALVANDO...' : 'SALVAR'}</Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};

const RedefinirSenhaModal = ({ isOpen, onClose, usuario, onSaved }: any) => {
  const { register, handleSubmit, watch, reset, setError, formState: { errors } } = useForm();
  const queryClient = useQueryClient();
  const [showNova, setShowNova] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);

  const novaSenha = watch('senha') || '';

  const requisitos = [
    { label: 'Mínimo 8 caracteres', ok: novaSenha.length >= 8 },
    { label: 'Letra maiúscula', ok: /[A-Z]/.test(novaSenha) },
    { label: 'Letra minúscula', ok: /[a-z]/.test(novaSenha) },
    { label: 'Número', ok: /[0-9]/.test(novaSenha) },
    { label: 'Caractere especial', ok: /[^A-Za-z0-9]/.test(novaSenha) },
  ];

  const resetMutation = useMutation({
    mutationFn: (data: any) => api.put(`/usuarios/${usuario.id}/`, { senha: data.senha }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      reset();
      onClose();
      onSaved?.(usuario.nome);
    },
  });

  const onSubmit = (data: any) => {
    if (data.senha !== data.confirmar) {
      setError('confirmar', { message: 'As senhas não conferem.' });
      return;
    }
    resetMutation.mutate(data);
  };

  return (
    <Modal isOpen={isOpen} onClose={() => { reset(); onClose(); }} title="REDEFINIR SENHA" icon={Key} width="max-w-md">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <p className="text-sm font-medium text-slate-400 text-center">
          Alterando senha para <span className="text-[#0000A0] font-black">{usuario.nome}</span>
        </p>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Nova Senha</label>
          <div className="relative">
            <Input type={showNova ? 'text' : 'password'} {...register('senha', { required: true })} placeholder="Digite a nova senha" className="pr-10" />
            <button type="button" onClick={() => setShowNova(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showNova ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {novaSenha.length > 0 && (
          <div className="rounded-xl bg-slate-50 p-3 flex flex-col gap-1.5">
            <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase mb-1">Requisitos de senha</p>
            {requisitos.map(r => (
              <div key={r.label} className={cn("flex items-center gap-2 text-[11px] font-bold transition-colors", r.ok ? "text-green-600" : "text-slate-400")}>
                {r.ok ? <Check size={12} className="shrink-0" /> : <X size={12} className="shrink-0" />}
                <span className={r.ok ? 'line-through' : ''}>{r.label}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Confirmar Nova Senha</label>
          <div className="relative">
            <Input type={showConfirmar ? 'text' : 'password'} {...register('confirmar', { required: true })} placeholder="Confirme a nova senha" className="pr-10" />
            <button type="button" onClick={() => setShowConfirmar(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showConfirmar ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.confirmar && <p className="text-[11px] font-bold text-red-500">{String((errors.confirmar as any).message || 'Campo obrigatório')}</p>}
        </div>

        <div className="mt-2 flex justify-end gap-3 border-t pt-4">
          <Button type="button" variant="ghost" onClick={() => { reset(); onClose(); }}>CANCELAR</Button>
          <Button type="submit" disabled={resetMutation.isPending}>
            {resetMutation.isPending ? 'SALVANDO...' : 'SALVAR NOVA SENHA'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

const UsuarioDetalhesModal = ({ isOpen, onClose, usuario }: any) => (
  <Modal isOpen={isOpen} onClose={onClose} title="DETALHES DO USUÁRIO" icon={User} width="max-w-md">
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4">
        <DetailRow label="Nome" value={usuario.nome} />
        <DetailRow label="Usuário" value={usuario.matricula} />
        <DetailRow label="E-mail" value={usuario.email} />
        <DetailRow label="Perfil" value={usuario.perfil?.nome} />
        <DetailRow label="Status" value={usuario.ativo ? 'Ativo' : 'Inativo'} />
      </div>
      <div className="mt-4 flex justify-end border-t pt-6">
        <Button variant="ghost" onClick={onClose} className="px-8 font-black">FECHAR</Button>
      </div>
    </div>
  </Modal>
);

const DetailRow = ({ label, value }: any) => (
  <div className="flex flex-col gap-1">
    <span className="text-[10px] font-black tracking-widest text-slate-300 uppercase">{label}</span>
    <span className="text-sm font-black text-[#1E293B]">{value || '--'}</span>
  </div>
);
