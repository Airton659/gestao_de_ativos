import { useEffect, useState, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/Combobox';
import { Package, ImagePlus, X } from 'lucide-react';
import { Ativo } from '@/pages/Ativos';
import { formatLocal, formatDateForInput } from '@/lib/utils';
import { FeedbackModal } from '@/components/ui/FeedbackModal';
import { useAuth } from '@/contexts/AuthContext';

interface AtivoModalProps {
  isOpen: boolean;
  onClose: () => void;
  ativo: Ativo | null;
  onSaved?: (isEdit: boolean, nome: string) => void;
}

interface AtivoForm extends Partial<Ativo> {
  categoria_id?: string | number;
  localizacao_id?: string | number;
  fornecedor_id?: string | number;
  tipo_aquisicao?: string;
  status_form?: string;
  processador?: string;
  memoria_ram?: string;
  armazenamento?: string;
  tamanho_tela?: string;
  sistema_operacional?: string;
  numero_serie?: string;
  data_aquisicao?: string;
  valor?: number;
  observacoes?: string;
}

export const AtivoModal = ({ isOpen, onClose, ativo, onSaved }: AtivoModalProps) => {
  const queryClient = useQueryClient();
  const isEditing = !!ativo;
  const [fotos, setFotos] = useState<string[]>([]);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const savedNomeRef = useRef<string>('');
  const [valorDisplay, setValorDisplay] = useState('');
  const [feedback, setFeedback] = useState<{ open: boolean; success: boolean; title: string; message: string }>({
    open: false,
    success: true,
    title: '',
    message: '',
  });

  const { register, handleSubmit, watch, reset, setValue, control, formState: { errors } } = useForm<AtivoForm>({
    defaultValues: (ativo as any) || { ativo: true },
  });

  const { hasPermission } = useAuth();

  const { data: categorias = [] } = useQuery({
    queryKey: ['categorias'],
    queryFn: async () => (await api.get('/categorias/')).data,
    enabled: isOpen,
  });

  const { data: localizacoes = [] } = useQuery({
    queryKey: ['localizacoes'],
    queryFn: async () => (await api.get('/localizacoes/')).data,
    enabled: isOpen && hasPermission('localizacoes:ler'),
  });

  const { data: fornecedores = [] } = useQuery({
    queryKey: ['fornecedores'],
    queryFn: async () => (await api.get('/fornecedores/')).data,
    enabled: isOpen && hasPermission('fornecedores:ler'),
  });

  const tipoAquisicao = watch('tipo_aquisicao');
  const fornecedorId = watch('fornecedor_id');
  const isProprio = tipoAquisicao !== 'TERCEIRO';
  const fornecedorSigla = !isProprio && fornecedorId
    ? (fornecedores as any[]).find((f) => f.id === Number(fornecedorId))?.sigla
    : null;

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const catNome = categorias.find((c: any) => c.id === Number(data.categoria_id))?.nome || data.tipo || '';
      const isProprio = data.tipo_aquisicao !== 'TERCEIRO';
      const paddedPatrimonio = data.numero_patrimonio ? data.numero_patrimonio.toString().padStart(6, '0') : '';
      
      // Definir o nome do equipamento para o payload e para o feedback
      const nomeEquipamento = `${data.marca || ''} ${data.modelo || ''}`.trim() || paddedPatrimonio || 'Equipamento';
      savedNomeRef.current = nomeEquipamento;

      const payload: any = {
        numero_patrimonio: paddedPatrimonio,
        nome: nomeEquipamento,
        tipo: catNome,
        marca: data.marca || null,
        modelo: data.modelo || null,
        numero_serie: data.numero_serie || null,
        is_proprio: isProprio,
        localizacao_id: data.localizacao_id ? Number(data.localizacao_id) : null,
        fornecedor_id: !isProprio && data.fornecedor_id ? Number(data.fornecedor_id) : null,
        ativo: data.ativo === 'true' || data.ativo === true,
        estado_conservacao: data.estado_conservacao || null,
        data_aquisicao: data.data_aquisicao || null,
        valor: isProprio && data.valor ? Number(data.valor) : null,
        observacoes: data.observacoes || null,
        fotos: fotos,
        especificacoes: (() => {
          const esp: any = {};
          const specFields: any[] = (() => {
            try { return JSON.parse(selectedCat?.campos_especificacoes || '[]'); } catch { return []; }
          })();
          specFields.forEach(f => {
            if (data[f.key]) esp[f.key] = data[f.key];
          });
          return esp;
        })(),
      };

      if (isEditing) {
        return api.put(`/equipamentos/${ativo.id}/`, payload);
      } else {
        return api.post('/equipamentos/', payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ativos'] });
      onClose();
      onSaved?.(isEditing, savedNomeRef.current);
    },
    onError: (err: any) => {
      const detail = err.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map((e: any) => `${e.loc?.slice(-1)[0]}: ${e.msg}`).join('<br/>')
        : detail || 'Erro ao salvar ativo';
      setFeedback({ open: true, success: false, title: 'ERRO AO SALVAR', message: msg });
    }
  });

  const handleFotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingFoto(true);
    try {
      for (const file of files) {
        const form = new FormData();
        form.append('file', file);
        const res = await api.post('/equipamentos/upload-foto/', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setFotos((prev) => [...prev, res.data.url]);
      }
    } catch {
      setFeedback({ open: true, success: false, title: 'ERRO NO UPLOAD', message: 'Erro ao fazer upload da foto.' });
    } finally {
      setUploadingFoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const formatValorDisplay = (raw: number | string | null | undefined): string => {
    if (raw === null || raw === undefined || raw === '') return '';
    const cents = Math.round(Number(raw) * 100);
    return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '');
    if (!digits) {
      setValorDisplay('');
      setValue('valor', undefined as any);
      return;
    }
    const cents = parseInt(digits, 10);
    const numeric = cents / 100;
    setValorDisplay(numeric.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    setValue('valor', numeric);
  };

  // Busca dados completos do ativo (incluindo fotos) no modo edição
  const { data: fullAtivo, isLoading: isLoadingFull } = useQuery<Ativo>({
    queryKey: ['equipamento', ativo?.id],
    queryFn: async () => (await api.get(`/equipamentos/${ativo?.id}`)).data,
    enabled: isOpen && isEditing,
  });

  useEffect(() => {
    const targetAtivo = fullAtivo || ativo;
    if (targetAtivo) {
      const catId = categorias.find((c: any) => c.nome?.toUpperCase() === targetAtivo.tipo?.toUpperCase())?.id || '';
      const esp = targetAtivo.especificacoes || {};
      setFotos(targetAtivo.fotos || []);
      setValorDisplay(formatValorDisplay(targetAtivo.valor));
      reset({
        ...targetAtivo,
        categoria_id: catId,
        localizacao_id: (targetAtivo as any).localizacao_id || '',
        ativo: targetAtivo.ativo !== false,
        tipo_aquisicao: targetAtivo.is_proprio === false ? 'TERCEIRO' : 'PROPRIO',
        fornecedor_id: targetAtivo.fornecedor?.id || '',
        ...esp, // Spread all specs direct to form fields
        data_aquisicao: formatDateForInput(targetAtivo.data_aquisicao),
        valor: targetAtivo.valor ?? undefined,
        observacoes: targetAtivo.observacoes || '',
      });
    } else {
      setFotos([]);
      setValorDisplay('');
      reset({ ativo: true, tipo_aquisicao: 'PROPRIO' } as any);
    }
  }, [ativo, fullAtivo, reset, categorias]);

  const onSubmit = (data: any) => {
    saveMutation.mutate(data);
  };

  const selectedCategoriaId = watch('categoria_id');
  const isAtivo = watch('ativo');
  const selectedCat = categorias.find((c: any) => c.id === Number(selectedCategoriaId));
  
  const specFields: {key: string, label: string}[] = (() => {
    const jsonStr = (selectedCat as any)?.campos_especificacoes || 
                    (selectedCat as any)?.camposEspecificacoes || 
                    (selectedCat as any)?.CamposEspecificacoes;
                    
    if (!jsonStr) return [];
    try { return JSON.parse(jsonStr); } catch { return []; }
  })();

  const isTerceiro = tipoAquisicao === 'TERCEIRO';


  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'EDITAR ATIVO' : 'CADASTRAR NOVO ATIVO'}
      icon={Package}
      width="max-w-4xl"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className={isLoadingFull ? "opacity-50 pointer-events-none transition-opacity" : "transition-opacity"}>


        {/* ROW 1 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black tracking-wide text-slate-400">CATEGORIA DO ATIVO *</label>
            <select
              {...register('categoria_id', { required: true })}
              className="h-10 rounded-xl bg-[#F8FAFC] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0000A0]"
            >
              <option value="">Selecione...</option>
              {categorias.map((c: any) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black tracking-wide text-slate-400">TIPO DE AQUISIÇÃO *</label>
            <select
              {...register('tipo_aquisicao', { required: true })}
              className="h-10 rounded-xl bg-[#F8FAFC] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0000A0]"
            >
              <option value="PROPRIO">PRÓPRIO (COMPRA/DOAÇÃO)</option>
              <option value="TERCEIRO">TERCEIRO (ALUGUEL/COMODATO)</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black tracking-wide text-slate-400">STATUS OPERACIONAL</label>
            <select
              {...register('ativo')}
              className={`h-10 rounded-xl px-3 py-2 text-sm font-black outline-none focus:ring-2 focus:ring-[#0000A0] ${
                String(isAtivo) === 'true' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
              }`}
            >
              <option value="true">ATIVO</option>
              <option value="false">INATIVO</option>
            </select>
          </div>
        </div>

        {/* ESPECIFICAÇÕES TÉCNICAS DINÂMICAS */}
        {specFields.length > 0 && (
          <div className="rounded-2xl bg-blue-50/50 p-4 grid grid-cols-1 md:grid-cols-2 gap-4 border border-blue-100/50 animate-in fade-in slide-in-from-top-2 duration-300">
            {specFields.map((field) => (
              <div key={field.key} className="flex flex-col gap-2">
                <label className="text-[10px] font-black tracking-wide text-slate-400 uppercase">{field.label}</label>
                <Input {...register(field.key as any)} placeholder={`Informe ${field.label.toLowerCase()}...`} />
              </div>
            ))}
          </div>
        )}

        {/* MARCA / MODELO */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black tracking-wide text-slate-400">MARCA *</label>
            <Input {...register('marca', { required: true })} placeholder="ex: Dell" />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black tracking-wide text-slate-400">MODELO *</label>
            <Input {...register('modelo', { required: true })} placeholder="ex: Latitude 3420" />
          </div>
        </div>

        {/* PATRIMÔNIO / SÉRIE */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black tracking-wide text-slate-400">PATRIMÔNIO / TOMBAMENTO</label>
            <div className="flex items-center">
              {!isProprio && fornecedorSigla && (
                <span className="text-slate-500 font-bold mr-2">{fornecedorSigla} -</span>
              )}
              <Input {...register('numero_patrimonio')} placeholder="ex: 001234" className="flex-1" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black tracking-wide text-slate-400">NÚMERO DE SÉRIE (SN)</label>
            <Input {...register('numero_serie')} placeholder="ex: ABC123XYZ" />
          </div>
        </div>

        {/* ESTADO DE CONSERVAÇÃO */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-black tracking-wide text-slate-400">ESTADO DE CONSERVAÇÃO</label>
          <select
            {...register('estado_conservacao')}
            className="h-10 rounded-xl bg-[#F8FAFC] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0000A0]"
          >
            <option value="">Não informado</option>
            <option value="OTIMO">Ótimo</option>
            <option value="BOM">Bom</option>
            <option value="REGULAR">Regular</option>
            <option value="RUIM">Ruim</option>
            <option value="PESSIMO">Péssimo</option>
          </select>
        </div>

        <div className="h-px w-full bg-slate-100" />

        {/* LOCALIZAÇÃO + FORNECEDOR */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black tracking-wide text-slate-400">
              LOCALIZAÇÃO ATUAL {!isEditing && '*'}
              {isEditing && <span className="ml-2 text-slate-300">(altere via movimentação)</span>}
            </label>
            <Controller
              name="localizacao_id"
              control={control}
              rules={{ required: !isEditing }}
              render={({ field }) => (
                <Combobox
                  options={localizacoes.map((l: any) => ({ id: l.id, label: formatLocal(l) }))}
                  value={field.value}
                  onChange={field.onChange}
                  disabled={isEditing}
                  placeholder="Selecione a localização..."
                />
              )}
            />
          </div>
          {isTerceiro && (
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black tracking-wide text-slate-400">FORNECEDOR</label>
              <Controller
                name="fornecedor_id"
                control={control}
                render={({ field }) => (
                  <Combobox
                    options={fornecedores.map((f: any) => ({ id: f.id, label: f.nome_empresa }))}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Selecione o fornecedor..."
                  />
                )}
              />
            </div>
          )}
        </div>

        {/* DATA + VALOR (condicional) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black tracking-wide text-slate-400">
              {isTerceiro ? 'DATA DE INÍCIO DO CONTRATO' : 'DATA DE AQUISIÇÃO'}
            </label>
            <Input {...register('data_aquisicao')} type="date" />
          </div>
          {!isTerceiro && (
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black tracking-wide text-slate-400">VALOR (R$)</label>
              <Input
                type="text"
                inputMode="numeric"
                value={valorDisplay}
                onChange={handleValorChange}
                placeholder="0,00"
              />
            </div>
          )}
        </div>

        {/* OBSERVAÇÕES */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-black tracking-wide text-slate-400">OBSERVAÇÕES</label>
          <textarea
            {...register('observacoes')}
            rows={3}
            placeholder="Informações adicionais sobre o ativo..."
            className="w-full rounded-xl bg-[#F8FAFC] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0000A0] resize-none"
          />
        </div>

        {/* FOTOS */}
        <div className="flex flex-col gap-3">
          <label className="text-[10px] font-black tracking-wide text-slate-400">FOTOS DO ATIVO</label>
          <div className="flex flex-wrap gap-3">
            {fotos.map((url, i) => (
              <div key={i} className="relative h-20 w-20 rounded-xl overflow-hidden border border-slate-200 group">
                <img src={url} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setFotos((prev) => prev.filter((_, idx) => idx !== i))}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={16} className="text-white" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingFoto}
              className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-[#0000A0] hover:text-[#0000A0] transition-colors disabled:opacity-50"
            >
              <ImagePlus size={20} />
              <span className="text-[9px] font-black">{uploadingFoto ? '...' : 'FOTO'}</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFotoUpload}
            />
          </div>
        </div>

        </div>
        {/* FOOTER */}
        <div className="flex justify-end gap-4 border-t border-slate-100 pt-4">
          <Button type="button" variant="ghost" onClick={onClose} className="font-bold text-slate-400 hover:text-slate-600">
            CANCELAR
          </Button>
          <Button type="submit" disabled={saveMutation.isPending} className="font-black px-8">
            {saveMutation.isPending ? 'SALVANDO...' : 'SALVAR ATIVO'}
          </Button>
        </div>

        {Object.keys(errors).length > 0 && (
          <div className="rounded-xl bg-red-50 p-3 text-[11px] font-bold text-red-600 animate-in fade-in slide-in-from-top-1">
            ⚠️ Por favor, preencha todos os campos obrigatórios (*) para salvar.
          </div>
        )}
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
