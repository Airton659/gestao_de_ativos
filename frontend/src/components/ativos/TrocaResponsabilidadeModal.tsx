import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserPlus, Search, CheckCircle2, AlertTriangle, ShieldCheck, Camera, RefreshCw, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { Ativo } from '@/pages/Ativos';
import { cn } from '@/lib/utils';

export const TrocaResponsabilidadeModal = ({
  isOpen,
  onClose,
  ativo,
  onSuccess
}: {
  isOpen: boolean;
  onClose: () => void;
  ativo: Ativo | null;
  onSuccess: (nome: string, loteId: string) => void;
}) => {
  const [step, setStep] = useState(1);
  const [gestorId, setGestorId] = useState<number | null>(null);
  const [gestor, setGestor] = useState<any>(null);
  const [searchGestor, setSearchGestor] = useState('');
  const [motivo, setMotivo] = useState('');
  const [senha, setSenha] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();

  const { data: responsaveis = [], isLoading } = useQuery({
    queryKey: ['responsaveis-movimentacao'],
    queryFn: async () => (await api.get('/usuarios/?permissao_chave=movimentacoes:assinar')).data,
    enabled: isOpen && step === 1,
  });

  // reset form when modal opens with different asset
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setGestorId(null);
      setGestor(null);
      setSearchGestor('');
      setMotivo('');
      setSenha('');
      setErrorMsg('');
      setCapturedPhoto(null);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  }, [isOpen, ativo?.id]);

  const handlePhotoSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setCapturedPhoto(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const refazerFoto = () => {
    setCapturedPhoto(null);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const verificarSenhaMutation = useMutation({
    mutationFn: async () => {
      await api.post('/movimentacoes/verificar-senha/', {
        gestor_matricula: gestor?.matricula || '',
        senha_confirmacao: senha,
      });
    },
    onSuccess: () => setStep(3),
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.detail || 'Senha incorreta.');
    }
  });

  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = (await api.post('/movimentacoes/troca-responsabilidade', payload)).data;
      const loteId = res.lote_id;

      try {
         await api.post(`/movimentacoes/gerar-termo-lote/${loteId}`, {}, { responseType: 'blob' });
      } catch (err) {
         console.warn("[TROCA] Erro na geração do Termo PDF:", err);
      }

      api.post(`/movimentacoes/enviar-termo/${loteId}`).catch(err => {
         console.error('[EMAIL] Falha no envio automático:', err);
      });

      return res;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ativos'] });
      queryClient.invalidateQueries({ queryKey: ['historico'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      onSuccess(ativo?.marca + ' ' + (ativo?.modelo || ''), data.lote_id);
      onClose();
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.detail || 'Erro ao realizar a troca de responsabilidade.');
    }
  });

  const handleSubmit = () => {
    setErrorMsg('');
    if (!gestor) return setErrorMsg("Selecione um gestor.");
    if (!senha) return setErrorMsg("A senha é obrigatória.");
    if (!capturedPhoto) return setErrorMsg("A foto de confirmação é obrigatória.");

    mutation.mutate({
      equipamento_id: ativo?.id,
      gestor_matricula: gestor.matricula,
      motivo,
      senha_confirmacao: senha,
      foto_base64: capturedPhoto
    });
  };

  if (!ativo) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="TROCAR RESPONSÁVEL DO ATIVO"
      icon={UserPlus}
      width="max-w-2xl"
    >
      <div className="flex flex-col min-h-[400px]">
        {/* Etapas Progress */}
        <div className="mb-6 flex items-center justify-center gap-4">
          <div className={cn("flex flex-col items-center gap-2", step === 1 ? "opacity-100" : "opacity-40")}>
            <div className={cn("flex h-8 w-8 items-center justify-center rounded-full font-black text-sm transition-colors", step === 1 ? "bg-[#0000A0] text-white" : "bg-slate-200 text-slate-500")}>1</div>
            <span className="text-[10px] font-black tracking-widest text-[#1E293B]">SELECIONAR</span>
          </div>
          <div className="h-1 w-16 bg-slate-100"></div>
          <div className={cn("flex flex-col items-center gap-2", step >= 2 ? "opacity-100" : "opacity-40")}>
            <div className={cn("flex h-8 w-8 items-center justify-center rounded-full font-black text-sm transition-colors", step >= 2 ? "bg-[#0000A0] text-white" : "bg-slate-200 text-slate-500")}>2</div>
            <span className="text-[10px] font-black tracking-widest text-[#1E293B]">CONFIRMAR</span>
          </div>
          <div className="h-1 w-16 bg-slate-100"></div>
          <div className={cn("flex flex-col items-center gap-2", step === 3 ? "opacity-100" : "opacity-40")}>
            <div className={cn("flex h-8 w-8 items-center justify-center rounded-full font-black text-sm transition-colors", step === 3 ? "bg-[#0000A0] text-white" : "bg-slate-200 text-slate-500")}>3</div>
            <span className="text-[10px] font-black tracking-widest text-[#1E293B]">REGISTRAR FOTO</span>
          </div>
        </div>

        {step === 1 && (
          <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-4 duration-300 flex-1">
            <div className="rounded-2xl bg-blue-50 p-4 flex flex-col gap-2">
               <h4 className="font-black text-[#0000A0] text-sm tracking-wide">Resumo do Ativo</h4>
               <p className="text-xs text-[#1E3A8A] font-medium">Equipamento: <strong>{ativo?.marca} {ativo?.modelo} ({ativo?.patrimonio || ativo?.numero_patrimonio || 'S/N'})</strong></p>
               <p className="text-xs text-[#1E3A8A] font-medium">Localização Mantida: <strong>{ativo?.localizacao?.sala} / Campus {ativo?.localizacao?.campus}</strong></p>
               <p className="text-xs text-[#1E3A8A] font-medium">Responsável Atual: <strong className="text-red-700 bg-red-100 px-1 py-0.5 rounded ml-1">{ativo?.responsavel?.nome || 'Não definido'}</strong></p>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black tracking-widest text-[#94A3B8]">NOVO GESTOR / RESPONSÁVEL</label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Pesquisar gestor por nome ou e-mail..."
                  value={searchGestor}
                  onChange={e => setSearchGestor(e.target.value)}
                  className="pl-10 font-bold text-sm bg-slate-50 border-slate-200 focus:bg-white focus:ring-[#0000A0] rounded-xl h-11"
                />
              </div>

              <div className="mt-2 grid grid-cols-2 gap-3 max-h-[160px] overflow-y-auto no-scrollbar pb-2">
                {isLoading ? (
                    <div className="col-span-2 text-center py-4 text-slate-400 font-bold text-xs">Carregando usuários...</div>
                ) : responsaveis.length === 0 ? (
                    <div className="col-span-2 text-center py-4 text-slate-400 font-bold text-xs">Nenhum usuário com permissão para assinar.</div>
                ) : responsaveis.filter((u: any) => !searchGestor || u.nome.toLowerCase().includes(searchGestor.toLowerCase()) || (u.email && u.email.toLowerCase().includes(searchGestor.toLowerCase()))).map((u: any) => (
                  <button
                    key={u.id}
                    onClick={() => { setGestor(u); setGestorId(u.id); }}
                    className={cn(
                      "flex flex-col items-start p-4 rounded-xl border-2 text-left transition-all",
                      gestorId === u.id
                        ? "border-[#0000A0] bg-[#EFF6FF] shadow-sm transform scale-[0.98]"
                        : "border-slate-100 bg-white hover:border-[#0000A0] hover:shadow-sm"
                    )}
                  >
                    <span className={cn("text-xs font-black", gestorId === u.id ? "text-[#0000A0]" : "text-[#1E293B]")}>{u.nome}</span>
                    <span className="text-[10px] font-bold text-slate-400 mt-1">{u.email || '--'}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-2">
              <label className="text-[10px] font-black tracking-widest text-[#94A3B8]">MOTIVO (OPCIONAL)</label>
              <Input
                placeholder="Exemplo: Férias do titular, remanejamento de equipe..."
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                className="font-bold text-sm bg-slate-50 border-slate-200 focus:bg-white rounded-xl"
              />
            </div>

            <div className="mt-auto pt-4 flex justify-end gap-3 border-t border-slate-100">
              <Button variant="ghost" onClick={onClose} className="font-bold text-slate-400 hover:text-slate-600 rounded-xl">
                CANCELAR
              </Button>
              <Button 
                disabled={!gestor || gestorId === ativo?.responsavel?.id} 
                onClick={() => setStep(2)} 
                className="bg-[#0000A0] hover:bg-blue-900 font-black tracking-wide px-8 shadow-lg shadow-[#0000A0]/20 rounded-xl"
              >
                AVANÇAR <UserPlus size={16} className="ml-2" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-6 flex-1 animate-in fade-in slide-in-from-right-4 duration-300">
             
            <div className="flex flex-col items-center justify-center text-center px-4">
              <div className="h-16 w-16 bg-[#EFF6FF] text-[#0000A0] rounded-2xl flex items-center justify-center mb-4">
                <ShieldCheck size={32} />
              </div>
              <h3 className="text-xl font-black text-[#1E293B]">Validação do Novo Gestor</h3>
              <p className="text-xs font-medium text-slate-500 max-w-md mt-2">
                A operação transfere a responsabilidade para <strong className="text-[#0000A0]">{gestor?.nome}</strong>. Será utilizada a assinatura registrada do gestor para selar o termo. Confirme com a senha de acesso.
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-50 text-red-600 text-xs font-bold flex gap-3 -mt-2 items-center max-w-sm mx-auto w-full">
                 <AlertTriangle size={18} className="shrink-0" />
                 <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex flex-col gap-2 items-center w-full max-w-sm mx-auto">
              <label className="text-[10px] font-black tracking-widest text-[#94A3B8] w-full text-left">SENHA DE CONFIRMAÇÃO DO GESTOR <span className="text-red-500">*</span></label>
              <Input
                type="password"
                placeholder="Insira a senha do gestor selecionado"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                className="font-black text-center h-12 text-lg tracking-[4px] placeholder:tracking-normal placeholder:font-bold bg-slate-50 border-slate-200 focus:bg-white rounded-xl focus:ring-[#0000A0]"
              />
            </div>

            <div className="mt-auto pt-4 flex justify-between gap-3 border-t border-slate-100">
              <Button variant="ghost" onClick={() => setStep(1)} className="font-bold text-slate-400 hover:text-slate-600 rounded-xl">
                VOLTAR
              </Button>
              <Button 
                disabled={verificarSenhaMutation.isPending || !senha}
                onClick={() => verificarSenhaMutation.mutate()} 
                className="bg-[#0000A0] hover:bg-blue-900 font-black px-8 shadow-lg shadow-[#0000A0]/20 rounded-xl"
              >
                {verificarSenhaMutation.isPending ? 'VALIDANDO...' : 'AVANÇAR'} {!verificarSenhaMutation.isPending && <ChevronRight size={18} className="ml-2" />}
              </Button>
            </div>

          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-6 flex-1 animate-in fade-in slide-in-from-right-4 duration-300 items-center justify-center">
            
            <div className="flex flex-col items-center justify-center text-center px-4 mb-2">
              <h3 className="text-xl font-black text-[#1E293B]">Foto de Confirmação</h3>
              <p className="text-xs font-medium text-slate-500 max-w-sm mt-2">
                Tire uma foto do recebedor com o equipamento para registro da passagem de responsabilidade.
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-50 text-red-600 text-xs font-bold flex gap-3 mb-2 items-center w-full">
                 <AlertTriangle size={18} className="shrink-0" />
                 <span>{errorMsg}</span>
              </div>
            )}

            {!capturedPhoto ? (
              <div className="w-full flex-1 flex flex-col items-center justify-center rounded-3xl bg-slate-50 border-2 border-dashed border-slate-200 py-10">
                <Camera size={48} className="text-slate-300 mb-4" />
                <Button onClick={() => photoInputRef.current?.click()} className="bg-[#0000A0] hover:bg-blue-900 text-sm font-black rounded-xl">
                  ABRIR CÂMERA
                </Button>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  ref={photoInputRef}
                  onChange={handlePhotoSelected}
                />
              </div>
            ) : (
              <div className="w-full flex-1 flex flex-col items-center">
                <img src={capturedPhoto} alt="Foto confirmação" className="max-h-[250px] w-auto rounded-2xl shadow-md border-2 border-slate-100 object-cover" />
                <Button variant="ghost" onClick={refazerFoto} className="mt-4 text-slate-500 font-bold hover:text-slate-700">
                  <RefreshCw size={16} className="mr-2" /> REFAZER FOTO
                </Button>
              </div>
            )}

            <div className="mt-auto pt-4 flex w-full justify-between gap-3 border-t border-slate-100">
              <Button variant="ghost" onClick={() => setStep(2)} className="font-bold text-slate-400 hover:text-slate-600 rounded-xl">
                VOLTAR
              </Button>
              <Button 
                disabled={mutation.isPending || !capturedPhoto}
                onClick={handleSubmit} 
                className="bg-green-600 hover:bg-green-700 font-black px-6 shadow-lg shadow-green-600/20 rounded-xl"
              >
                {mutation.isPending ? 'PROCESSANDO...' : 'CONFIRMAR OPERAÇÃO'} {!mutation.isPending && <CheckCircle2 size={18} className="ml-2" />}
              </Button>
            </div>

          </div>
        )}
      </div>
    </Modal>
  );
};
