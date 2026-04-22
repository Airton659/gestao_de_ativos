import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ShieldCheck, Plus, ChevronRight, Square, CheckSquare, Save, Trash2, AlertTriangle, User, Package, MoveRight, MapPin, Truck, Edit2, Lock, ClipboardList, RefreshCw, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/Modal';
import { FeedbackModal } from '@/components/ui/FeedbackModal';
import { useForm } from 'react-hook-form';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

const GRUPOS_PERMISSAO = [
  { prefixo: 'equipamentos', label: 'Equipamentos',      icon: Package },
  { prefixo: 'movimentacoes', label: 'Movimentações',    icon: MoveRight },
  { prefixo: 'localizacoes', label: 'Localizações',      icon: MapPin },
  { prefixo: 'fornecedores', label: 'Fornecedores',      icon: Truck },
  { prefixo: 'usuarios',     label: 'Usuários',          icon: User },
  { prefixo: 'perfis',       label: 'Perfis de Acesso',  icon: ShieldCheck },
  { prefixo: 'permissoes',   label: 'Permissões',        icon: ShieldCheck },
  { prefixo: 'relatorios',   label: 'Relatórios',        icon: Printer },
  { prefixo: 'categorias',   label: 'Categorias',        icon: Package },
  { prefixo: 'auditoria',    label: 'Auditoria',         icon: ClipboardList },
];

interface Permissao {
  id: number;
  nome: string;
  chave: string;
}

interface Perfil {
  id: number;
  nome: string;
  descricao?: string;
  permissoes?: Permissao[];
}

export const Acessos = () => {
  const [selectedPerfil, setSelectedPerfil] = useState<Perfil | null>(null);
  const [selectedPerms, setSelectedPerms] = useState<Set<number>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ open: boolean; success: boolean; title: string; message: string }>({ open: false, success: true, title: '', message: '' });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteBlockOpen, setDeleteBlockOpen] = useState(false);
  const [perfilToDelete, setPerfilToDelete] = useState<Perfil | null>(null);
  const [perfilToEdit, setPerfilToEdit] = useState<Perfil | null>(null);
  const [usuariosAssociados, setUsuariosAssociados] = useState<{ id: number; nome: string; matricula: string }[]>([]);
  const [checkingDelete, setCheckingDelete] = useState(false);
  const { hasPermission } = useAuth();

  const queryClient = useQueryClient();

  const { data: perfis = [], isLoading: isLoadingPerfis } = useQuery<Perfil[]>({
    queryKey: ['perfis'],
    queryFn: async () => (await api.get('/perfis/')).data,
  });

  const { data: todasPermissoes = [] } = useQuery<Permissao[]>({
    queryKey: ['permissoes'],
    queryFn: async () => (await api.get('/permissoes/')).data,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPerfil) return;
      return api.put(`/perfis/${selectedPerfil.id}/`, {
        nome: selectedPerfil.nome,
        permissoes_ids: Array.from(selectedPerms)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['perfis'] });
      setFeedback({ open: true, success: true, title: 'ALTERAÇÕES SALVAS', message: `As permissões de <span class="text-slate-700 font-black">${selectedPerfil?.nome}</span> foram atualizadas.` });
    },
    onError: () => setFeedback({ open: true, success: false, title: 'ERRO AO SALVAR', message: 'Não foi possível salvar as alterações.' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/perfis/${id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['perfis'] });
      if (selectedPerfil?.id === perfilToDelete?.id) {
        setSelectedPerfil(null);
        setSelectedPerms(new Set());
      }
      setFeedback({ open: true, success: true, title: 'PERFIL EXCLUÍDO', message: `O perfil <span class="text-slate-700 font-black">${perfilToDelete?.nome}</span> foi removido do sistema.` });
      setPerfilToDelete(null);
    },
    onError: (err: any) => {
      const detail = err.response?.data?.detail || 'Erro ao excluir perfil.';
      setFeedback({ open: true, success: false, title: 'ERRO AO EXCLUIR', message: detail });
    },
  });

  const syncMutation = useMutation({
    mutationFn: () => api.post('/permissoes/sync'),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['permissoes'] });
      setFeedback({ 
        open: true, 
        success: true, 
        title: 'PERMISSÕES SINCRONIZADAS', 
        message: `O sistema verificou as chaves. Foram adicionadas <span class="text-slate-700 font-black">${res.data.added}</span> novas permissões de um total de ${res.data.total}.` 
      });
    },
    onError: () => setFeedback({ open: true, success: false, title: 'ERRO NA SINCRONIZAÇÃO', message: 'Não foi possível sincronizar as chaves com o banco de dados.' }),
  });

  const handleDeleteClick = async (perfil: Perfil) => {
    setPerfilToDelete(perfil);
    setCheckingDelete(true);
    try {
      const res = await api.get(`/usuarios/?perfil_id=${perfil.id}`);
      const users = res.data || [];
      if (users.length > 0) {
        setUsuariosAssociados(users);
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

  const handleSelectPerfil = (perfil: Perfil) => {
    setSelectedPerfil(perfil);
    setSelectedPerms(new Set(perfil.permissoes?.map(p => p.id) || []));
  };

  const togglePerm = (id: number) => {
    const next = new Set(selectedPerms);
    const perm = todasPermissoes.find(p => p.id === id);
    if (!perm) return;

    const [prefix, action] = perm.chave.split(':');

    if (next.has(id)) {
      // DESMARCANDO
      next.delete(id);
      
      // Se desmarcou 'ler', desmarca obrigatoriamente as de escrita do mesmo grupo
      if (action === 'ler') {
        todasPermissoes
          .filter(p => p.chave.startsWith(`${prefix}:`) && p.id !== id)
          .forEach(p => next.delete(p.id));
        
        // Regra adicional: se desmarcou 'perfis:ler', desmarca obrigatoriamente 'permissoes:ler'
        if (perm.chave === 'perfis:ler') {
          const pPermsLer = todasPermissoes.find(p => p.chave === 'permissoes:ler');
          if (pPermsLer) next.delete(pPermsLer.id);
        }
      }
    } else {
      // MARCANDO
      next.add(id);
      
      // Se marcou qualquer ação de escrita, marca automaticamente a de 'ler' do mesmo grupo
      if (action !== 'ler') {
        const pLer = todasPermissoes.find(p => p.chave === `${prefix}:ler`);
        if (pLer) next.add(pLer.id);
      }

      // Regra adicional: se marcou 'permissoes:ler', marca automaticamente 'perfis:ler'
      if (perm.chave === 'permissoes:ler') {
        const pPerfisLer = todasPermissoes.find(p => p.chave === 'perfis:ler');
        if (pPerfisLer) next.add(pPerfisLer.id);
      }

      // Regra específica: Criar Equipamento exige ver Locais e Fornecedores
      if (perm.chave === 'equipamentos:criar') {
        const pLoc = todasPermissoes.find(p => p.chave === 'localizacoes:ler');
        const pForn = todasPermissoes.find(p => p.chave === 'fornecedores:ler');
        if (pLoc) next.add(pLoc.id);
        if (pForn) next.add(pForn.id);
      }

      // Regra específica: Criar Movimentação exige ver Ativos e Locais
      if (perm.chave === 'movimentacoes:criar') {
        const pMovLer = todasPermissoes.find(p => p.chave === 'movimentacoes:ler');
        const pAtivLer = todasPermissoes.find(p => p.chave === 'equipamentos:ler');
        const pLocLer = todasPermissoes.find(p => p.chave === 'localizacoes:ler');
        const pUserLer = todasPermissoes.find(p => p.chave === 'usuarios:ler');
        if (pMovLer) next.add(pMovLer.id);
        if (pAtivLer) next.add(pAtivLer.id);
        if (pLocLer) next.add(pLocLer.id);
        if (pUserLer) next.add(pUserLer.id);
      }

      // Regra específica: Ler Movimentação exige ver Ativos
      if (perm.chave === 'movimentacoes:ler') {
        const pAtivLer = todasPermissoes.find(p => p.chave === 'equipamentos:ler');
        if (pAtivLer) next.add(pAtivLer.id);
      }

      // Regra específica: Assinar Movimentação exige ver as movimentações
      if (perm.chave === 'movimentacoes:assinar') {
        const pMovLer = todasPermissoes.find(p => p.chave === 'movimentacoes:ler');
        const pAtivLer = todasPermissoes.find(p => p.chave === 'equipamentos:ler');
        if (pMovLer) next.add(pMovLer.id);
        if (pAtivLer) next.add(pAtivLer.id);
      }

      // Regra específica: Gerar Relatórios exige ver Ativos, Locais, Fornecedores e Usuários
      if (perm.chave === 'relatorios:gerar') {
        const deps = ['equipamentos:ler', 'localizacoes:ler', 'fornecedores:ler', 'usuarios:ler'];
        deps.forEach(chave => {
          const p = todasPermissoes.find(p => p.chave === chave);
          if (p) next.add(p.id);
        });
      }
    }
    setSelectedPerms(next);
  };

  // Permissões que são dependências obrigatórias de outra permissão ativa
  const getLockedReason = (chave: string): string | null => {
    const rules = [
      { dep: 'movimentacoes:ler', refs: ['movimentacoes:criar', 'movimentacoes:assinar'] },
      { dep: 'equipamentos:ler',  refs: ['movimentacoes:criar', 'movimentacoes:ler', 'movimentacoes:assinar', 'relatorios:gerar'] },
      { dep: 'localizacoes:ler',  refs: ['movimentacoes:criar', 'relatorios:gerar', 'equipamentos:criar'] },
      { dep: 'usuarios:ler',      refs: ['movimentacoes:criar', 'relatorios:gerar'] },
      { dep: 'fornecedores:ler',  refs: ['relatorios:gerar', 'equipamentos:criar'] },
    ];

    const [prefix, action] = chave.split(':');
    
    // Regra geral: 'ler' é obrigatório se qualquer outra do grupo estiver ativa
    if (action === 'ler') {
      const pEscritaAtiva = todasPermissoes.find(p => p.chave.startsWith(`${prefix}:`) && p.chave !== chave && selectedPerms.has(p.id));
      if (pEscritaAtiva) return `Obrigatória para "${pEscritaAtiva.nome}"`;
    }

    // Regras específicas
    const rule = rules.find(r => r.dep === chave);
    if (rule) {
      for (const refChave of rule.refs) {
        const pRef = todasPermissoes.find(p => p.chave === refChave);
        if (pRef && selectedPerms.has(pRef.id)) {
          return `Obrigatória para "${pRef.nome}"`;
        }
      }
    }

    // Regra Perfis/Permissões
    if (chave === 'perfis:ler') {
      const pPermsLer = todasPermissoes.find(p => p.chave === 'permissoes:ler');
      if (pPermsLer && selectedPerms.has(pPermsLer.id)) return `Obrigatória para "${pPermsLer.nome}"`;
    }
    
    if (chave === 'permissoes:ler') {
      const pPerfisLer = todasPermissoes.find(p => p.chave === 'perfis:ler');
      if (pPerfisLer && selectedPerms.has(pPerfisLer.id)) return `Obrigatória para "${pPerfisLer.nome}"`;
    }

    return null;
  };

  if (isLoadingPerfis) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0000A0] border-t-transparent" /></div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* SIDEBAR: PERFIS */}
      <div className="lg:col-span-4 flex flex-col rounded-[32px] border border-slate-100 bg-white shadow-sm overflow-hidden">
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Perfis do Sistema</h2>
          <div className="flex items-center gap-2">
            {hasPermission('perfis:editar') && (
              <button 
                onClick={() => syncMutation.mutate()} 
                disabled={syncMutation.isPending}
                title="Sincronizar Chaves de Permissão"
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 transition-all",
                  syncMutation.isPending && "animate-spin"
                )}
              >
                <RefreshCw size={14} />
              </button>
            )}
            {hasPermission('perfis:criar') && (
              <button 
                onClick={() => { setPerfilToEdit(null); setModalOpen(true); }} 
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0000A0] text-white hover:scale-110 transition-transform"
              >
                <Plus size={16} />
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-col">
          {perfis.map(perfil => {
            const isSelected = selectedPerfil?.id === perfil.id;
            return (
              <div
                key={perfil.id}
                role="button"
                tabIndex={0}
                onClick={() => handleSelectPerfil(perfil)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelectPerfil(perfil); } }}
                className={cn(
                  "flex items-center gap-4 p-5 text-left border-b border-white transition-all group cursor-pointer",
                  isSelected ? "bg-blue-50/50" : "hover:bg-slate-50"
                )}
              >
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-2xl transition-colors", isSelected ? "bg-[#0000A0] text-white" : "bg-[#F8FAFC] text-slate-400")}>
                  <ShieldCheck size={20} />
                </div>
                <div className="flex-1">
                  <p className={cn("text-sm font-black transition-colors", isSelected ? "text-[#0000A0]" : "text-[#1E293B]")}>{perfil.nome}</p>
                  <p className="text-[10px] font-bold text-slate-400">{perfil.permissoes?.length || 0} permissões</p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  {hasPermission('perfis:editar') && perfil.nome !== 'Administrador' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setPerfilToEdit(perfil); setModalOpen(true); }}
                      className="rounded-full p-1.5 text-blue-400 hover:bg-blue-50 hover:text-blue-600"
                      title="Editar nome/descrição"
                    >
                      <Edit2 size={14} />
                    </button>
                  )}
                  {hasPermission('perfis:excluir') && perfil.nome !== 'Administrador' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteClick(perfil); }}
                      disabled={checkingDelete}
                      className="rounded-full p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                      title="Excluir perfil"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                {isSelected && <ChevronRight size={16} className="text-[#0000A0] shrink-0" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* CONTENT: PERMISSÕES */}
      <div className="lg:col-span-8 flex flex-col rounded-[32px] border border-slate-100 bg-white shadow-sm overflow-hidden min-h-[500px]">
        {!selectedPerfil ? (
          <div className="flex flex-col items-center justify-center p-20 text-center h-full">
            <ShieldCheck size={48} className="text-slate-200 mb-4" />
            <p className="text-sm font-bold text-slate-400 max-w-xs transition-opacity duration-300">
              Selecione um perfil à esquerda para gerenciar suas permissões.
            </p>
          </div>
        ) : (
          <>
            {/* CABEÇALHO DO PERFIL (SEMPRE VISÍVEL) */}
            <div className="p-6 border-b bg-slate-50/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <ShieldCheck size={20} className="text-[#0000A0]" />
                  <h2 className="text-[11px] font-black tracking-widest text-[#1E3A8A] uppercase">DETALHES DO PERFIL — {selectedPerfil.nome}</h2>
                </div>
                {hasPermission('permissoes:ler') && selectedPerfil.nome !== 'Administrador' && (
                  <div className="flex gap-2">
                    <button onClick={() => setSelectedPerms(new Set(todasPermissoes.map(p => p.id)))} className="text-[10px] font-black text-[#0000A0] hover:underline">SELECIONAR TUDO</button>
                    <div className="w-1 h-3 bg-slate-200 rounded-full my-auto mx-1" />
                    <button onClick={() => setSelectedPerms(new Set())} className="text-[10px] font-black text-slate-400 hover:underline">LIMPAR</button>
                  </div>
                )}
              </div>
              {selectedPerfil.descricao ? (
                <p className="text-[10px] font-bold text-slate-400 leading-relaxed max-w-2xl italic">
                  {selectedPerfil.descricao}
                </p>
              ) : (
                <p className="text-[10px] font-bold text-slate-200 tracking-widest uppercase italic">Sem descrição definida.</p>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
              {!hasPermission('permissoes:ler') ? (
                <div className="flex flex-col items-center justify-center flex-1 py-20 px-6 bg-slate-50/20 rounded-[24px] border border-dashed border-slate-200">
                  <Lock size={24} className="text-slate-300 mb-3" />
                  <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Acesso restrito às chaves de permissão</p>
                </div>
              ) : (
                GRUPOS_PERMISSAO.map(grupo => {
                  const permsDoGrupo = todasPermissoes.filter(p => p.chave.startsWith(grupo.prefixo + ':'));
                  if (!permsDoGrupo.length) return null;
                  const Icon = grupo.icon;
                  return (
                    <div key={grupo.prefixo}>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100">
                          <Icon size={12} className="text-slate-500" />
                        </div>
                        <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">{grupo.label}</span>
                        <div className="flex-1 h-px bg-slate-100" />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {permsDoGrupo.map(perm => {
                          const isActive = selectedPerms.has(perm.id);
                          const canEdit = hasPermission('permissoes:editar') && selectedPerfil.nome !== 'Administrador';
                          const lockedReason = getLockedReason(perm.chave);
                          const isLocked = !!lockedReason;
                          return (
                            <button
                              key={perm.id}
                              disabled={!canEdit || isLocked}
                              onClick={() => togglePerm(perm.id)}
                              title={isLocked ? lockedReason! : undefined}
                                className={cn(
                                  "flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all text-left w-full",
                                  isActive
                                    ? (isLocked ? "bg-blue-50 border-blue-200 text-blue-900 shadow-sm" : "bg-[#0000A0] border-[#0000A0] text-white shadow-lg shadow-[#0000A0]/20")
                                    : "bg-[#F8FAFC] border-slate-100 text-slate-600 hover:border-slate-300",
                                  !canEdit && "opacity-60 cursor-not-allowed",
                                  isLocked && "cursor-not-allowed"
                                )}
                            >
                              {isLocked
                                ? <Lock size={15} className={cn("shrink-0", isActive ? "text-blue-400" : "text-slate-300")} />
                                : isActive ? <CheckSquare size={15} className="shrink-0" /> : <Square size={15} className="shrink-0 text-slate-300" />
                              }
                              <div className="flex flex-col">
                                <span className="text-[11px] font-black leading-tight">{perm.nome}</span>
                                <span className={cn("text-[9px] font-bold", isActive ? (isLocked ? "text-blue-700" : "text-white/60") : "text-slate-400")}>
                                  {isLocked ? lockedReason : perm.chave}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {(hasPermission('perfis:editar') || hasPermission('permissoes:editar')) && hasPermission('permissoes:ler') && selectedPerfil.nome !== 'Administrador' && (
              <div className="p-6 border-t bg-slate-50/30 flex justify-end">
                <Button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                  className="h-12 px-8 flex items-center gap-2"
                >
                  <Save size={18} /> {saveMutation.isPending ? 'SALVANDO...' : 'SALVAR ALTERAÇÕES'}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {modalOpen && (
        <PerfilModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          perfil={perfilToEdit}
          onSaved={(isEdit, nome) => setFeedback({ 
            open: true, 
            success: true, 
            title: isEdit ? 'PERFIL ATUALIZADO' : 'PERFIL CRIADO', 
            message: isEdit 
              ? `O perfil <span class="text-slate-700 font-black">${nome}</span> foi atualizado.`
              : `O perfil <span class="text-slate-700 font-black">${nome}</span> foi cadastrado no sistema.` 
          })}
        />
      )}

      {/* Modal bloqueante — tem usuários com este perfil */}
      <Modal isOpen={deleteBlockOpen} onClose={() => setDeleteBlockOpen(false)} title="NÃO É POSSÍVEL EXCLUIR" icon={AlertTriangle} width="max-w-md">
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">
            O perfil <span className="font-black">{perfilToDelete?.nome}</span> está atribuído a {usuariosAssociados.length} usuário{usuariosAssociados.length > 1 ? 's' : ''} e não pode ser excluído.
          </div>
          <p className="text-xs font-black text-slate-400 tracking-widest uppercase">Usuários com este perfil</p>
          <div className="max-h-52 overflow-y-auto flex flex-col gap-2 pr-1">
            {usuariosAssociados.map(u => (
              <div key={u.id} className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
                <User size={14} className="shrink-0 text-slate-400" />
                <div className="flex flex-col">
                  <span className="text-sm font-black text-[#1E293B]">{u.nome}</span>
                  <span className="text-[10px] font-bold text-slate-400">Usuário {u.matricula}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end border-t border-slate-100 pt-4">
            <Button onClick={() => setDeleteBlockOpen(false)} className="font-black px-8">ENTENDIDO</Button>
          </div>
        </div>
      </Modal>

      {/* Modal de confirmação — sem usuários */}
      <Modal isOpen={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} title="EXCLUIR PERFIL" icon={AlertTriangle} width="max-w-sm">
        <div className="flex flex-col gap-4">
          <p className="font-bold text-[#1E293B]">
            Tem certeza que deseja excluir o perfil <span className="font-black text-red-600">{perfilToDelete?.nome}</span>?
          </p>
          <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700 font-bold">
            ⚠️ Esta ação é <span className="font-black">irreversível</span>.
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <Button variant="ghost" onClick={() => setDeleteConfirmOpen(false)} className="font-bold text-slate-400 hover:text-slate-600">CANCELAR</Button>
            <Button
              disabled={deleteMutation.isPending}
              onClick={() => { if (perfilToDelete) { deleteMutation.mutate(perfilToDelete.id); setDeleteConfirmOpen(false); } }}
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

const PerfilModal = ({ isOpen, onClose, perfil, onSaved }: { isOpen: boolean; onClose: () => void; perfil?: Perfil | null; onSaved?: (isEdit: boolean, nome: string) => void }) => {
  const { register, handleSubmit, reset } = useForm();

  // Atualizar form quando o perfil selecionado para edição mudar ou o modal abrir
  useEffect(() => {
    if (isOpen) {
      reset(perfil || { nome: '', descricao: '' });
    }
  }, [isOpen, perfil, reset]);

  const queryClient = useQueryClient();
  const saveMutation = useMutation({
    mutationFn: (data: any) => perfil 
      ? api.put(`/perfis/${perfil.id}/`, { ...data, permissoes_ids: perfil.permissoes?.map(p => p.id) || [] })
      : api.post('/perfis/', { ...data, permissoes_ids: [] }),
    onSuccess: (_res, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ['perfis'] });
      onClose();
      onSaved?.(!!perfil, variables.nome || '');
    },
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={perfil ? 'EDITAR PERFIL' : 'CRIAR NOVO PERFIL'} icon={ShieldCheck} width="max-w-md">
      <form onSubmit={handleSubmit(d => saveMutation.mutate(d))} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Nome do Perfil</label>
          <input {...register('nome', { required: true })} placeholder="Ex: Técnico N1" className="h-12 rounded-xl border-none bg-[#F8FAFC] px-4 text-sm font-bold outline-none ring-[#0000A0] focus:ring-2" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Descrição</label>
          <input {...register('descricao')} placeholder="Opcional..." className="h-12 rounded-xl border-none bg-[#F8FAFC] px-4 text-sm font-bold outline-none ring-[#0000A0] focus:ring-2" />
        </div>
        <div className="mt-4 flex justify-end gap-3 border-t pt-6">
          <Button type="button" variant="ghost" onClick={onClose}>CANCELAR</Button>
          <Button type="submit" disabled={saveMutation.isPending}>{perfil ? (saveMutation.isPending ? 'SALVANDO...' : 'SALVAR ALTERAÇÕES') : (saveMutation.isPending ? 'CRIANDO...' : 'CRIAR PERFIL')}</Button>
        </div>
      </form>
    </Modal>
  );
};
