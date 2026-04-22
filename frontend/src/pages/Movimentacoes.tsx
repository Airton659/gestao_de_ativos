import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  ChevronRight,
  ChevronLeft,
  MapPin,
  Package,
  Trash2,
  User,
  ShieldCheck,
  CheckCircle2,
  Layers,
  FileDown,
  Camera,
  CameraOff,
  RefreshCw,
  Search,
  Mail,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn, matchesPatrimonio } from '@/lib/utils';
import { FeedbackModal } from '@/components/ui/FeedbackModal';
import { useTabletMode } from '@/contexts/TabletModeContext';

// ─── LocalSelectorTablet ────────────────────────────────────────────────────
const LocalSelectorTablet = ({ localizacoes, onSelect, excludeId }: {
  localizacoes: any[];
  onSelect: (loc: any) => void;
  excludeId?: number;
}) => {
  const [campus, setCampus] = useState<string | null>(null);
  const [bloco, setBloco] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const active = localizacoes.filter((l: any) => l.ativo !== false && l.id !== excludeId);
  const campuses = [...new Set(active.map((l: any) => l.campus))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })) as string[];

  const campusLocs = campus ? active.filter((l: any) => l.campus === campus) : [];
  const blocos = [...new Set(campusLocs.map((l: any) => l.bloco).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })) as string[];
  
  const salas = (bloco
    ? campusLocs.filter((l: any) => l.bloco === bloco)
    : blocos.length === 0 ? campusLocs : [])
    .sort((a, b) => a.sala.localeCompare(b.sala, undefined, { numeric: true, sensitivity: 'base' }));

  const filteredCampuses = campuses.filter(c => 
    !search || c.toLowerCase().includes(search.toLowerCase())
  );

  const filteredBlocos = blocos.filter(b => 
    !search || b.toLowerCase().includes(search.toLowerCase())
  );

  const filteredSalas = search
    ? salas.filter((l: any) => 
        l.sala.toLowerCase().includes(search.toLowerCase()) ||
        (l.bloco && l.bloco.toLowerCase().includes(search.toLowerCase()))
      )
    : salas;

  const handleBack = () => {
    setSearch('');
    if (bloco) setBloco(null);
    else setCampus(null);
  };

  // Campus selection
  if (!campus) {
    return (
      <div className="flex flex-col gap-6">
        <div className="text-center">
          <p className="text-[10px] font-black tracking-[2px] text-slate-400 mb-1">PASSO 1 DE {blocos.length > 0 ? 3 : 2}</p>
          <h3 className="text-2xl font-black text-[#1E293B]">Selecione o campus</h3>
        </div>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <Input
            placeholder="Buscar campus..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-14 pl-12 rounded-2xl bg-slate-50 border-none font-bold text-base"
          />
        </div>
        <div className="grid grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
          {filteredCampuses.map((c) => (
            <button
              key={c}
              onClick={() => { setCampus(c); setSearch(''); }}
              className="group flex flex-col items-center justify-center gap-4 rounded-3xl border-2 border-slate-100 bg-[#F8FAFC] p-10 text-center transition-all active:scale-95 hover:border-[#0000A0] hover:bg-white hover:shadow-xl hover:shadow-[#0000A0]/5"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-slate-400 group-hover:bg-[#0000A0] group-hover:text-white transition-colors shadow-sm">
                <Building2 size={28} />
              </div>
              <span className="text-lg font-black text-[#1E293B] group-hover:text-[#0000A0]">
                {c}
              </span>
              <span className="text-xs font-bold text-slate-400">
                {active.filter((l: any) => l.campus === c).length} locais
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Bloco selection
  if (blocos.length > 0 && !bloco) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
          >
            <ChevronLeft size={22} />
          </button>
          <div>
            <p className="text-[10px] font-black tracking-[2px] text-slate-400">CAMPUS {campus.toUpperCase()} · PASSO 2 DE 3</p>
            <h3 className="text-2xl font-black text-[#1E293B]">Selecione o bloco</h3>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <Input
            placeholder="Buscar bloco..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-14 pl-12 rounded-2xl bg-slate-50 border-none font-bold text-base"
          />
        </div>
        <div className="grid grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
          {filteredBlocos.map((b) => (
            <button
              key={b}
              onClick={() => { setBloco(b); setSearch(''); }}
              className="group flex flex-col items-center justify-center gap-4 rounded-3xl border-2 border-slate-100 bg-[#F8FAFC] p-10 text-center transition-all active:scale-95 hover:border-[#0000A0] hover:bg-white hover:shadow-xl hover:shadow-[#0000A0]/5"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-slate-400 group-hover:bg-[#0000A0] group-hover:text-white transition-colors shadow-sm">
                <Layers size={28} />
              </div>
              <span className="text-lg font-black text-[#1E293B] group-hover:text-[#0000A0]">Bloco {b}</span>
              <span className="text-xs font-bold text-slate-400">
                {campusLocs.filter((l: any) => l.bloco === b).length} salas
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Sala selection
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <button
          onClick={handleBack}
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
        >
          <ChevronLeft size={22} />
        </button>
        <div>
          <p className="text-[10px] font-black tracking-[2px] text-slate-400">
            {campus.toUpperCase()}{bloco ? ` · BLOCO ${bloco}` : ''}
          </p>
          <h3 className="text-2xl font-black text-[#1E293B]">Selecione a sala</h3>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <Input
          placeholder="Buscar sala ou bloco..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-14 pl-12 rounded-2xl bg-slate-50 border-none font-bold text-base"
        />
      </div>

      <div className="grid grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
        {filteredSalas.map((loc: any) => (
          <button
            key={loc.id}
            onClick={() => onSelect(loc)}
            className="group flex flex-col items-center justify-center gap-4 rounded-3xl border-2 border-slate-100 bg-[#F8FAFC] p-10 text-center transition-all active:scale-95 hover:border-[#0000A0] hover:bg-white hover:shadow-xl hover:shadow-[#0000A0]/5"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-slate-400 group-hover:bg-[#0000A0] group-hover:text-white transition-colors shadow-sm">
              <MapPin size={28} />
            </div>
            <span className="text-lg font-black text-[#1E293B] group-hover:text-[#0000A0]">{loc.sala}</span>
            {loc.andar && <span className="text-xs font-bold text-slate-400">{loc.andar}º andar</span>}
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────
export const Movimentacoes = () => {
  const [step, setStep] = useState(0);
  const [origem, setOrigem] = useState<any>(null);
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [destino, setDestino] = useState<any>(null);
  const [recebedor, setRecebedor] = useState<any>(null);
  const [isAceiteChecked, setIsAceiteChecked] = useState(false);
  const [password, setPassword] = useState('');
  const [obs, setObs] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tabletSubStep, setTabletSubStep] = useState(0);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [searchOrigem, setSearchOrigem] = useState('');
  const [searchAtivos, setSearchAtivos] = useState('');
  const [searchDestino, setSearchDestino] = useState('');
  const [searchRecebedor, setSearchRecebedor] = useState('');
  const [termoUrl, setTermoUrl] = useState<string | null>(null);
  const [currentLoteId, setCurrentLoteId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ open: boolean; success: boolean; title: string; message: string }>({ open: false, success: true, title: '', message: '' });

  // ── Câmera ────────────────────────────────────────────────────────────────
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  const [cameraAvailable, setCameraAvailable] = useState<boolean | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // TEMPORÁRIO: câmera desabilitada para testes — restaurar depois
  useEffect(() => {
    setIsMobile(true);
    setCameraAvailable(true);
  }, []);

  const handleCameraGateContinue = () => setStep(1);

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

  const navigate = useNavigate();
  const { tabletMode } = useTabletMode();

  // Queries
  const { data: localizacoes = [] } = useQuery({
    queryKey: ['localizacoes'],
    queryFn: async () => (await api.get('/localizacoes/')).data,
  });

  const { data: ativosOrigem = [], isFetching: isAtivosLoading } = useQuery({
    queryKey: ['ativos-origem', origem?.id],
    queryFn: async () => {
      if (!origem) return [];
      const res = await api.get(`/equipamentos/?localizacao_id=${origem.id}`);
      return res.data || [];
    },
    enabled: !!origem && step === 2,
  });

  const { data: responsaveis = [] } = useQuery({
    queryKey: ['responsaveis-movimentacao'],
    queryFn: async () => (await api.get('/usuarios/?permissao_chave=movimentacoes:assinar')).data,
    enabled: step === 3,
  });

  const resetWizard = () => {
    setStep(1);
    setOrigem(null);
    setSelectedItems([]);
    setDestino(null);
    setRecebedor(null);
    setPassword('');
    setIsAceiteChecked(false);
    setTabletSubStep(0);
    setTypeFilter(null);
    setTermoUrl(null);
    setCurrentLoteId(null);
    setCapturedPhoto(null);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  // Step 4 → verifica senha → vai para câmera (step 5)
  const handleVerificarSenha = async () => {
    try {
      setIsSubmitting(true);
      await api.post('/movimentacoes/verificar-senha/', {
        gestor_matricula: recebedor?.matricula || '',
        senha_confirmacao: password,
      });
      setStep(5);
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'Senha incorreta.';
      setFeedback({ open: true, success: false, title: 'SENHA INCORRETA', message: detail });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 5 → foto capturada → cria movimentações + upload foto + PDF → step 6
  const handleConfirm = async () => {
    if (!capturedPhoto) return;
    try {
      setIsSubmitting(true);
      const novoLoteId = typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
          });
      setCurrentLoteId(novoLoteId);

      for (const ativo of selectedItems) {
        await api.post('/movimentacoes/', {
          equipamento_id: ativo.id,
          loc_origem_id: origem?.id,
          loc_destino_id: destino?.id,
          gestor_matricula: recebedor?.matricula || '',
          motivo: obs || 'Movimentação via sistema',
          senha_confirmacao: password,
          lote_id: novoLoteId,
        });
      }

      // Upload da foto de confirmação
      const blob = await (await fetch(capturedPhoto)).blob();
      const formData = new FormData();
      formData.append('file', blob, `foto_${novoLoteId}.jpg`);
      await api.post(`/movimentacoes/foto-confirmacao/${novoLoteId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // Gera o PDF do lote
      try {
        const pdfRes = await api.post(`/movimentacoes/gerar-termo-lote/${novoLoteId}`, {}, { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([pdfRes.data], { type: 'application/pdf' }));
        setTermoUrl(url);

        // Envio automático de e-mail (background)
        api.post(`/movimentacoes/enviar-termo/${novoLoteId}`).catch(err => {
          console.error('[EMAIL] Falha no envio automático:', err);
        });
      } catch (err) {
        console.error('Erro ao gerar PDF:', err);
        setTermoUrl(null);
      }

      setStep(6);
    } catch (err: any) {
      console.error('[MOVIMENTAÇÃO] Erro:', err);
      console.error('[MOVIMENTAÇÃO] Response:', err.response?.status, err.response?.data);
      const detail = err.response?.data?.detail || 'Erro ao processar movimentação.';
      setFeedback({ open: true, success: false, title: 'ERRO NA MOVIMENTAÇÃO', message: detail });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Step indicator: desktop=5, tablet=6 (step 3 split em 3a/3b) ──────────
  const totalSteps = tabletMode ? 6 : 5;
  const displayStep = tabletMode && step === 3 ? (tabletSubStep === 0 ? 3 : 4) : step;

  const renderStepIndicator = () => (
    <div className="mb-6 sm:mb-12 flex items-center justify-center gap-2 sm:gap-4">
      {Array.from({ length: totalSteps }, (_, i) => i + 1).map(s => (
        <div key={s} className="flex items-center gap-2 sm:gap-4">
          <div className="flex flex-col items-center gap-2">
            <div
              className={cn(
                "flex items-center justify-center rounded-2xl font-black transition-all shadow-sm",
                tabletMode ? "h-14 w-14 text-lg" : "h-8 w-8 sm:h-10 sm:w-10 text-sm",
                displayStep === s ? "bg-[#0000A0] text-white scale-110 shadow-[#0000A0]/20" :
                displayStep > s ? "bg-green-500 text-white" : "bg-white text-slate-300 border border-slate-200"
              )}
            >
              {displayStep > s ? <CheckCircle2 size={tabletMode ? 22 : 16} /> : s}
            </div>
          </div>
          {s < totalSteps && (
            <div className={cn("h-1 rounded-full", tabletMode ? "w-10" : "w-4 sm:w-12", displayStep > s ? "bg-green-500" : "bg-slate-100")} />
          )}
        </div>
      ))}
    </div>
  );

  // Tipos disponíveis na origem para o filtro
  const tiposDisponiveisOrigem = [...new Set(ativosOrigem.map((a: any) => a.tipo).filter(Boolean))] as string[];
  const ativosFiltrados = typeFilter
    ? ativosOrigem.filter((a: any) => a.tipo === typeFilter)
    : ativosOrigem;

  const finalFilteredAtivos = ativosFiltrados.filter((a: any) => 
    !searchAtivos || 
    a.marca.toLowerCase().includes(searchAtivos.toLowerCase()) ||
    a.modelo.toLowerCase().includes(searchAtivos.toLowerCase()) ||
    matchesPatrimonio(a.patrimonio || a.numero_patrimonio, searchAtivos)
  );

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className={cn("mx-auto w-full flex flex-col items-center", tabletMode ? "max-w-4xl" : "max-w-5xl")}>
      {step >= 1 && step < 6 && renderStepIndicator()}

      {/* ── STEP 0: VERIFICAÇÃO DE CÂMERA ─────────────────────────────── */}
      {step === 0 && (
        <div className="w-full rounded-[40px] border border-slate-100 bg-white p-5 sm:p-12 shadow-[0_20px_60px_rgba(0,0,0,0.03)] text-center">
          <div className="flex flex-col items-center gap-6">
            {cameraAvailable === null && (
              <>
                <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-blue-50 text-[#0000A0]">
                  <Camera size={44} strokeWidth={2} className="animate-pulse" />
                </div>
                <h2 className="text-2xl font-black text-[#1E293B]">Verificando câmera…</h2>
                <p className="text-slate-400 max-w-xs sm:max-w-sm">Aguarde enquanto verificamos o acesso à câmera do dispositivo. Autorize o acesso quando solicitado pelo navegador.</p>
              </>
            )}
            {cameraAvailable === true && (
              <>
                <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-green-50 text-green-600">
                  <Camera size={44} strokeWidth={2} />
                </div>
                <h2 className="text-2xl font-black text-[#1E293B]">Câmera disponível</h2>
                <p className="text-slate-400 max-w-xs sm:max-w-sm">Acesso à câmera confirmado. Você pode prosseguir com a movimentação.</p>
                <Button
                  onClick={handleCameraGateContinue}
                  className="mt-2 rounded-2xl bg-[#0000A0] px-10 py-6 text-base font-black text-white hover:bg-blue-900"
                >
                  Iniciar Movimentação <ChevronRight size={20} className="ml-2" />
                </Button>
              </>
            )}
            {cameraAvailable === false && (
              <>
                <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-red-50 text-red-500">
                  <CameraOff size={44} strokeWidth={2} />
                </div>
                {isMobile === false ? (
                  <>
                    <h2 className="text-2xl font-black text-[#1E293B]">Dispositivo não permitido</h2>
                    <p className="text-slate-400 max-w-xs sm:max-w-sm">
                      Movimentações só podem ser realizadas a partir de um tablet ou celular institucional.
                    </p>
                  </>
                ) : (
                  <>
                    <h2 className="text-2xl font-black text-[#1E293B]">Câmera indisponível</h2>
                    <p className="text-slate-400 max-w-xs sm:max-w-sm">
                      Nenhuma câmera foi encontrada neste dispositivo. A câmera é obrigatória para registrar a confirmação da movimentação.
                    </p>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── STEP 1: ORIGEM ────────────────────────────────────────────── */}
      {step === 1 && (
        <>
          {tabletMode ? (
            <div className="w-full rounded-[40px] border border-slate-100 bg-white p-12 shadow-[0_20px_60px_rgba(0,0,0,0.03)]">
              <LocalSelectorTablet
                localizacoes={localizacoes}
                onSelect={(loc) => { setOrigem(loc); setStep(2); }}
              />
            </div>
          ) : (
            <div className="w-full rounded-[40px] border border-slate-100 bg-white p-5 sm:p-12 shadow-[0_20px_60px_rgba(0,0,0,0.03)] text-center">
              <div className="mb-8 flex flex-col items-center">
                <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-50 text-[#0000A0]">
                  <Building2 size={40} strokeWidth={2.5} />
                </div>
                <h2 className="text-2xl font-black text-[#1E293B]">Onde estão os ativos agora?</h2>
                <p className="mt-2 text-slate-400">Selecione o local de origem para listar os equipamentos disponíveis.</p>
              </div>

              <div className="mb-8 relative w-full max-w-md mx-auto">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <Input
                  placeholder="Pesquisar bloco ou sala..."
                  value={searchOrigem}
                  onChange={(e) => setSearchOrigem(e.target.value)}
                  className="h-12 pl-11 rounded-xl bg-slate-50 border-none font-bold text-sm"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin">
                {localizacoes
                  .filter((loc: any) => 
                    !searchOrigem || 
                    loc.sala.toLowerCase().includes(searchOrigem.toLowerCase()) || 
                    loc.campus.toLowerCase().includes(searchOrigem.toLowerCase()) ||
                    (loc.bloco && loc.bloco.toLowerCase().includes(searchOrigem.toLowerCase()))
                  )
                  .map((loc: any) => (
                    <button
                      key={loc.id}
                      onClick={() => { setOrigem(loc); setStep(2); }}
                      className="group flex flex-col items-start rounded-3xl border border-slate-100 bg-[#F8FAFC] p-6 text-left transition-all hover:border-[#0000A0] hover:bg-white hover:shadow-xl hover:shadow-[#0000A0]/5"
                    >
                      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-400 group-hover:bg-[#0000A0] group-hover:text-white transition-colors">
                        <MapPin size={20} />
                      </div>
                      <span className="text-[11px] font-black tracking-widest text-[#94A3B8]">CAMPUS {loc.campus.toUpperCase()}</span>
                      <span className="mt-1 text-base font-black text-[#1E293B] group-hover:text-[#0000A0]">{loc.sala}</span>
                      {loc.bloco && <span className="text-xs font-bold text-slate-400">Bloco {loc.bloco}</span>}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── STEP 2: SELEÇÃO DE ITENS ──────────────────────────────────── */}
      {step === 2 && (
        <div className={cn("w-full rounded-[40px] border border-slate-100 bg-white shadow-[0_20px_60px_rgba(0,0,0,0.03)]", tabletMode ? "p-10" : "p-5 sm:p-10")}>
          <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-5">
              <button
                onClick={() => setStep(1)}
                className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200"
              >
                {tabletMode ? <ChevronLeft size={22} /> : <Trash2 size={18} />}
              </button>
              <div>
                <h2 className={cn("font-black text-[#1E293B]", tabletMode ? "text-2xl" : "text-xl")}>Selecionar Ativos</h2>
                <p className="text-xs font-bold text-slate-400">
                  Origem: <span className="text-[#0000A0]">Campus {origem.campus} — {origem.sala}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className={cn("font-black text-[#0000A0]", tabletMode ? "text-sm" : "text-xs")}>{selectedItems.length} SELECIONADOS</span>
              <Button
                disabled={selectedItems.length === 0}
                onClick={() => { setTabletSubStep(0); setStep(3); }}
                className={cn("shadow-lg shadow-[#0000A0]/20", tabletMode && "h-14 px-6 text-base")}
              >
                PRÓXIMO <ChevronRight size={18} className="ml-2" />
              </Button>
            </div>
          </div>

          {/* Tablet: SELECIONAR TODOS + filtro por tipo + PESQUISA */}
          {!isAtivosLoading && ativosOrigem.length > 0 && (
            <div className="mb-8 flex flex-col gap-6">
              <div className="relative w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <Input
                  placeholder="Pesquisar por patrimônio, marca ou modelo..."
                  value={searchAtivos}
                  onChange={(e) => setSearchAtivos(e.target.value)}
                  className="h-14 pl-12 rounded-2xl bg-slate-50 border-none font-bold text-base shadow-sm focus:ring-2 focus:ring-[#0000A0]/20"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => {
                    const toSelect = searchAtivos || typeFilter ? finalFilteredAtivos : ativosOrigem;
                    if (selectedItems.length === toSelect.length && toSelect.length > 0) setSelectedItems([]);
                    else setSelectedItems(toSelect);
                  }}
                  className={cn(
                    "rounded-2xl px-5 py-3 text-sm font-black tracking-wide transition-all border-2",
                    selectedItems.length > 0 && selectedItems.length === (searchAtivos || typeFilter ? finalFilteredAtivos : ativosOrigem).length
                      ? "border-[#0000A0] bg-[#0000A0] text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-[#0000A0]"
                  )}
                >
                  {selectedItems.length > 0 && selectedItems.length === (searchAtivos || typeFilter ? finalFilteredAtivos : ativosOrigem).length ? 'DESMARCAR TODOS' : 'SELECIONAR TODOS'}
                </button>
                {tiposDisponiveisOrigem.length > 1 && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setTypeFilter(null)}
                      className={cn(
                        "rounded-full px-4 py-2 text-xs font-black tracking-wide transition-all",
                        !typeFilter ? "bg-[#0000A0] text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      )}
                    >
                      TODOS
                    </button>
                    {tiposDisponiveisOrigem.map(tipo => (
                      <button
                        key={tipo}
                        onClick={() => setTypeFilter(tipo === typeFilter ? null : tipo)}
                        className={cn(
                          "rounded-full px-4 py-2 text-xs font-black tracking-wide transition-all",
                          typeFilter === tipo ? "bg-[#0000A0] text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        )}
                      >
                        {tipo.toUpperCase()}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {isAtivosLoading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0000A0] border-t-transparent" />
            </div>
          ) : ativosOrigem.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center rounded-3xl bg-slate-50 border-2 border-dashed border-slate-200 p-8 text-center">
              <Package size={48} className="mb-4 text-slate-300" />
              <p className="font-bold text-slate-400 text-sm">Não há ativos disponíveis neste local.</p>
              <Button variant="outline" className="mt-4" onClick={() => setStep(1)}>VOLTAR E ESCOLHER OUTRO</Button>
            </div>
          ) : (
            <div className={cn("grid gap-4", tabletMode ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2")}>
              {finalFilteredAtivos.map((item: any) => {
                const isSelected = !!selectedItems.find(i => i.id === item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (isSelected) setSelectedItems(selectedItems.filter(i => i.id !== item.id));
                      else setSelectedItems([...selectedItems, item]);
                    }}
                    className={cn(
                      "flex items-center gap-4 rounded-2xl border text-left transition-all active:scale-[0.98]",
                      tabletMode ? "p-6" : "p-4",
                      isSelected ? "border-[#0000A0] bg-blue-50/50 shadow-md" : "border-slate-100 bg-[#F8FAFC] hover:border-slate-300"
                    )}
                  >
                    <div className={cn(
                      "flex items-center justify-center rounded-xl flex-shrink-0",
                      tabletMode ? "h-16 w-16" : "h-12 w-12",
                      isSelected ? "bg-[#0000A0] text-white" : "bg-white text-slate-300"
                    )}>
                      <Package size={tabletMode ? 28 : 22} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black tracking-widest text-[#94A3B8]">{item.marca} {item.modelo}</p>
                      <p className={cn("font-black text-[#1E293B] truncate", tabletMode ? "text-base" : "text-sm")}>
                        {!item.is_proprio && item.fornecedor_sigla ? `${item.fornecedor_sigla} - ` : ''}{item.patrimonio || item.numero_patrimonio || 'S/N'}
                      </p>
                      {tabletMode && item.tipo && (
                        <p className="text-xs font-bold text-slate-400 mt-0.5">{item.tipo}</p>
                      )}
                    </div>
                    {isSelected && (
                      <div className={cn(
                        "rounded-full bg-[#0000A0] flex items-center justify-center shadow-lg shadow-[#0000A0]/20 flex-shrink-0",
                        tabletMode ? "h-7 w-7" : "h-4 w-4"
                      )}>
                        <div className={cn("rounded-full bg-white", tabletMode ? "h-3 w-3" : "h-1.5 w-1.5")} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── STEP 3: DESTINO + RESPONSÁVEL ─────────────────────────────── */}
      {step === 3 && (
        <>
          {tabletMode ? (
            // Tablet: split into two sub-steps
            <div className="w-full rounded-[40px] border border-slate-100 bg-white p-12 shadow-[0_20px_60px_rgba(0,0,0,0.03)]">
              {tabletSubStep === 0 ? (
                // 3a: Destino
                <div className="flex flex-col gap-6">
                  <div className="flex items-center gap-4 mb-2">
                    <button
                      onClick={() => setStep(2)}
                      className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                    >
                      <ChevronLeft size={22} />
                    </button>
                    <div>
                      <p className="text-[10px] font-black tracking-[2px] text-slate-400">DESTINO DOS ATIVOS</p>
                      <h2 className="text-2xl font-black text-[#1E293B]">Para onde serão levados?</h2>
                    </div>
                  </div>
                  <LocalSelectorTablet
                    localizacoes={localizacoes}
                    onSelect={(loc) => { setDestino(loc); setTabletSubStep(1); }}
                    excludeId={origem?.id}
                  />
                </div>
              ) : (
                // 3b: Responsável
                <div className="flex flex-col gap-6">
                  <div className="flex items-center gap-4 mb-2">
                    <button
                      onClick={() => { setDestino(null); setTabletSubStep(0); }}
                      className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                    >
                      <ChevronLeft size={22} />
                    </button>
                    <div>
                      <p className="text-[10px] font-black tracking-[2px] text-slate-400">
                        DESTINO: <span className="text-[#0000A0]">{destino?.sala} — {destino?.campus}</span>
                      </p>
                      <h2 className="text-2xl font-black text-[#1E293B]">Quem vai receber?</h2>
                    </div>
                  </div>

                  {responsaveis.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-3xl bg-slate-50 border-2 border-dashed border-slate-200 p-16 text-center">
                      <ShieldCheck size={48} className="mb-4 text-slate-300" />
                      <p className="text-sm font-bold text-slate-400">Nenhum usuário com permissão para assinar movimentações.</p>
                      <p className="text-xs font-bold text-slate-300 mt-1">
                        Atribua <span className="font-black">movimentacoes:assinar</span> a um perfil em Acessos.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="mb-6 relative w-full">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <Input
                          placeholder="Pesquisar responsável..."
                          value={searchRecebedor}
                          onChange={(e) => setSearchRecebedor(e.target.value)}
                          className="h-14 pl-12 rounded-2xl bg-slate-50 border-none font-bold text-base shadow-sm focus:ring-2 focus:ring-[#0000A0]/20"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                        {responsaveis
                          .filter((u: any) => 
                            !searchRecebedor || 
                            u.nome.toLowerCase().includes(searchRecebedor.toLowerCase()) ||
                            (u.matricula || '').toLowerCase().includes(searchRecebedor.toLowerCase())
                          )
                          .map((u: any) => (
                            <button
                              key={u.id}
                              onClick={() => { setRecebedor(u); setStep(4); }}
                              className={cn(
                                "flex flex-col items-center justify-center gap-4 rounded-3xl border-2 p-10 text-center transition-all active:scale-95",
                                recebedor?.id === u.id
                                  ? "border-[#0000A0] bg-blue-50/50 shadow-lg"
                                  : "border-slate-100 bg-[#F8FAFC] hover:border-[#0000A0] hover:bg-white hover:shadow-xl hover:shadow-[#0000A0]/5"
                              )}
                            >
                              <div className={cn(
                                "flex h-16 w-16 items-center justify-center rounded-2xl shadow-sm transition-colors",
                                recebedor?.id === u.id ? "bg-[#0000A0] text-white" : "bg-white text-slate-300"
                              )}>
                                <User size={28} />
                              </div>
                              <div>
                                <p className="text-base font-black text-[#1E293B]">{u.nome}</p>
                                <p className="text-xs font-bold text-slate-400 mt-1">{u.perfil?.nome}</p>
                                <p className="text-[10px] font-bold text-slate-300">{u.matricula}</p>
                              </div>
                            </button>
                          ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            // Desktop: side by side
            <div className="w-full rounded-[40px] border border-slate-100 bg-white p-5 sm:p-12 shadow-[0_20px_60px_rgba(0,0,0,0.03)]">
              <div className="mb-6 sm:mb-10 flex items-center justify-between">
                <h2 className="text-2xl font-black text-[#1E293B]">Para onde serão levados?</h2>
                <Button variant="ghost" className="text-slate-400" onClick={() => setStep(2)}>VOLTAR</Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-10">
                <div className="flex flex-col gap-4">
                  <label className="text-[10px] font-black tracking-widest text-[#94A3B8]">LOCAL DE DESTINO</label>
                  
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <Input
                      placeholder="Pesquisar bloco ou sala..."
                      value={searchDestino}
                      onChange={(e) => setSearchDestino(e.target.value)}
                      className="h-10 pl-9 rounded-xl bg-slate-50 border-none font-bold text-xs shadow-sm focus:ring-1 focus:ring-[#0000A0]/10"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-2 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                    {localizacoes
                      .filter((loc: any) => 
                        loc.ativo !== false && 
                        loc.id !== origem?.id &&
                        (!searchDestino || 
                          loc.sala.toLowerCase().includes(searchDestino.toLowerCase()) || 
                          loc.campus.toLowerCase().includes(searchDestino.toLowerCase()) ||
                          (loc.bloco && loc.bloco.toLowerCase().includes(searchDestino.toLowerCase())))
                      )
                      .map((loc: any) => (
                        <button
                          key={loc.id}
                          onClick={() => setDestino(loc)}
                          className={cn(
                            "flex items-center gap-4 rounded-2xl border p-4 text-left transition-all",
                            destino?.id === loc.id ? "border-[#0000A0] bg-blue-50/50 shadow-sm" : "border-slate-100 bg-[#F8FAFC] hover:border-slate-300"
                          )}
                        >
                          <MapPin size={18} className={destino?.id === loc.id ? "text-[#0000A0]" : "text-slate-400"} />
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-[#1E293B]">Sala {loc.sala}</span>
                            <span className="text-[10px] font-bold text-slate-400">Campus {loc.campus} {loc.bloco ? `— ${loc.bloco}` : ''}</span>
                          </div>
                        </button>
                      ))}
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <label className="text-[10px] font-black tracking-widest text-[#94A3B8]">RESPONSÁVEL PELO RECEBIMENTO</label>
                  
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <Input
                      placeholder="Pesquisar responsável..."
                      value={searchRecebedor}
                      onChange={(e) => setSearchRecebedor(e.target.value)}
                      className="h-10 pl-9 rounded-xl bg-slate-50 border-none font-bold text-xs shadow-sm focus:ring-1 focus:ring-[#0000A0]/10"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-2 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                    {responsaveis.length === 0 ? (
                      <div className="flex flex-col items-center justify-center rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 p-8 text-center">
                        <ShieldCheck size={32} className="mb-3 text-slate-300" />
                        <p className="text-xs font-bold text-slate-400">Nenhum usuário com permissão para assinar movimentações.</p>
                        <p className="text-[10px] font-bold text-slate-300 mt-1">Atribua a permissão <span className="font-black">movimentacoes:assinar</span> a um perfil em Acessos.</p>
                      </div>
                    ) : (
                      responsaveis
                        .filter((u: any) => 
                          !searchRecebedor || 
                          u.nome.toLowerCase().includes(searchRecebedor.toLowerCase()) ||
                          (u.matricula || '').toLowerCase().includes(searchRecebedor.toLowerCase())
                        )
                        .map((u: any) => (
                          <button
                            key={u.id}
                            onClick={() => setRecebedor(u)}
                            className={cn(
                              "flex items-center gap-4 rounded-2xl border p-4 text-left transition-all",
                              recebedor?.id === u.id ? "border-[#0000A0] bg-blue-50/50 shadow-sm" : "border-slate-100 bg-[#F8FAFC] hover:border-slate-300"
                            )}
                          >
                            <User size={18} className={recebedor?.id === u.id ? "text-[#0000A0]" : "text-slate-400"} />
                            <div className="flex flex-col">
                              <span className="text-xs font-black text-[#1E293B]">{u.nome}</span>
                              <span className="text-[10px] font-bold text-slate-400">{u.matricula} — {u.perfil?.nome}</span>
                            </div>
                          </button>
                        ))
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-8 sm:mt-12 flex justify-end">
                <Button
                  disabled={!destino || !recebedor}
                  onClick={() => setStep(4)}
                  className="h-14 px-10 text-base shadow-xl shadow-[#0000A0]/20"
                >
                  REVISAR MOVIMENTAÇÃO <ChevronRight size={20} className="ml-2" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── STEP 4: RESUMO E ACEITE ───────────────────────────────────── */}
      {step === 4 && (
        <div className={cn("w-full grid gap-8", tabletMode ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-3")}>

          <div className={cn("flex flex-col gap-6", !tabletMode && "lg:col-span-2")}>
            <div className="rounded-[40px] border border-slate-100 bg-white p-5 sm:p-10 shadow-[0_20px_60px_rgba(0,0,0,0.03)]">
              <div className="flex items-center justify-between mb-8">
                <h2 className={cn("font-black text-[#1E293B]", tabletMode ? "text-3xl" : "text-2xl")}>Resumo da Operação</h2>
                {tabletMode && (
                  <button
                    onClick={() => { setTabletSubStep(1); setStep(3); }}
                    className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-slate-600"
                  >
                    <ChevronLeft size={16} />
                    CORRIGIR
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div className="flex flex-col gap-1.5 p-6 rounded-3xl bg-slate-50">
                  <span className="text-[10px] font-black tracking-widest text-slate-400">ORIGEM</span>
                  <span className={cn("font-black text-[#1E293B]", tabletMode ? "text-xl" : "text-base")}>{origem.sala}</span>
                  <span className="text-xs font-bold text-slate-400">Campus {origem.campus}</span>
                </div>
                <div className="flex flex-col gap-1.5 p-6 rounded-3xl bg-blue-50/50 border border-blue-100/50">
                  <span className="text-[10px] font-black tracking-widest text-blue-400">DESTINO</span>
                  <span className={cn("font-black text-[#0000A0]", tabletMode ? "text-xl" : "text-base")}>{destino.sala}</span>
                  <span className="text-xs font-bold text-[#0000A0]/60">Campus {destino.campus}</span>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <span className="text-[10px] font-black tracking-widest text-slate-400">ITENS A TRANSFERIR ({selectedItems.length})</span>
                <div className="grid grid-cols-1 gap-2">
                  {selectedItems.map((item, idx) => (
                    <div key={idx} className={cn("flex items-center gap-3 rounded-2xl border border-slate-100 bg-[#F8FAFC]", tabletMode ? "px-5 py-4" : "px-4 py-3")}>
                      <Package size={tabletMode ? 20 : 16} className="text-slate-400" />
                      <div className="flex flex-col">
                        <span className={cn("font-black text-[#1E293B]", tabletMode ? "text-sm" : "text-[13px]")}>
                          {!item.is_proprio && item.fornecedor_sigla ? `${item.fornecedor_sigla} - ` : ''}{item.patrimonio || item.numero_patrimonio}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">{item.marca} {item.modelo}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-3">
                <label className="text-[10px] font-black tracking-widest text-[#94A3B8]">MOTIVO / OBSERVAÇÕES</label>
                <Input
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                  placeholder="Ex: Mudança de setor, manutenção, etc."
                  className={cn(tabletMode ? "h-14 text-base" : "h-12")}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="rounded-[40px] border border-slate-100 bg-[#0000A0] p-5 sm:p-10 shadow-xl shadow-[#0000A0]/20 text-white">
              <div className={cn("mb-6 flex items-center justify-center rounded-2xl bg-white/10", tabletMode ? "h-16 w-16" : "h-14 w-14")}>
                <ShieldCheck size={tabletMode ? 32 : 28} className="text-[#7CFF6B]" />
              </div>
              <h3 className={cn("font-black mb-4", tabletMode ? "text-2xl" : "text-xl")}>Aceite Digital</h3>
              <p className={cn("font-medium text-white/70 mb-8 leading-relaxed", tabletMode ? "text-base" : "text-sm")}>
                <span className="text-[#7CFF6B] font-black">{recebedor.nome}</span>, confirme o recebimento dos equipamentos no destino selecionado inserindo sua senha abaixo.
              </p>

              <div className="space-y-6">
                <label className={cn("flex items-start gap-4 cursor-pointer group", tabletMode && "gap-5")}>
                  <input
                    type="checkbox"
                    checked={isAceiteChecked}
                    onChange={(e) => setIsAceiteChecked(e.target.checked)}
                    className={cn("mt-1 rounded-md border-transparent bg-white/20 accent-[#7CFF6B]", tabletMode ? "h-7 w-7" : "h-5 w-5")}
                  />
                  <span className={cn("font-bold text-white/80 group-hover:text-white transition-colors", tabletMode ? "text-sm" : "text-xs")}>
                    Estou ciente da transferência de responsabilidade sobre o patrimônio.
                  </span>
                </label>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black tracking-[1px] text-white/50">SENHA DO RESPONSÁVEL ({recebedor?.nome?.split(' ')[0]?.toUpperCase()})</label>
                  <Input
                    type="password"
                    placeholder="Senha do responsável..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={cn("bg-white/10 border-none text-white placeholder:text-white/30 focus:ring-white/20", tabletMode ? "h-16 text-lg" : "h-12")}
                  />
                </div>

                {cameraAvailable === false ? (
                  <div className="flex items-center gap-3 rounded-2xl bg-red-500/20 border border-red-400/30 px-5 py-4">
                    <CameraOff size={20} className="text-red-300 flex-shrink-0" />
                    <p className="text-xs font-bold text-red-200 leading-snug">
                      Câmera não detectada. A confirmação fotográfica é obrigatória — use um dispositivo com câmera.
                    </p>
                  </div>
                ) : (
                  <Button
                    disabled={!isAceiteChecked || !password || isSubmitting || cameraAvailable === null}
                    onClick={handleVerificarSenha}
                    className={cn(
                      "w-full !bg-[#7CFF6B] !text-[#0000A0] hover:!bg-[#7CFF6B]/90 font-black shadow-lg shadow-black/10 transition-all active:scale-95 whitespace-normal leading-tight", 
                      tabletMode ? "h-16 text-base px-6" : "h-14 text-[13px] px-3"
                    )}
                  >
                    {isSubmitting ? 'VERIFICANDO...' : cameraAvailable === null ? 'VERIFICANDO CÂMERA...' : (
                      <span className="flex items-center justify-center gap-2">
                        <Camera size={18} className="flex-shrink-0" /> 
                        <span>CONFIRMAR E FOTOGRAFAR</span>
                      </span>
                    )}
                  </Button>
                )}

                <button
                  onClick={() => setStep(3)}
                  className={cn("w-full py-2 font-bold text-white/40 hover:text-white transition-colors", tabletMode ? "text-sm" : "text-xs")}
                >
                  CORRIGIR INFORMAÇÕES
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 5: CÂMERA ────────────────────────────────────────────── */}
      {step === 5 && (
        <div className={cn("w-full flex flex-col items-center gap-8", tabletMode ? "max-w-2xl mx-auto" : "max-w-lg mx-auto")}>
          <div className="w-full rounded-[40px] border border-slate-100 bg-white p-5 sm:p-10 shadow-[0_20px_60px_rgba(0,0,0,0.03)]">
            <div className="mb-6 text-center">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-50 text-[#0000A0]">
                <Camera size={32} />
              </div>
              <h2 className={cn("font-black text-[#1E293B]", tabletMode ? "text-3xl" : "text-2xl")}>Foto de Confirmação</h2>
              <p className={cn("mt-2 text-slate-400 font-medium", tabletMode ? "text-base" : "text-sm")}>
                Tire uma foto de <span className="font-black text-[#1E293B]">{recebedor?.nome?.split(' ')[0]}</span> confirmando o recebimento.
              </p>
            </div>

            {!capturedPhoto ? (
              <div className="flex flex-col items-center gap-6">
                <div className="flex h-40 w-40 items-center justify-center rounded-3xl bg-slate-50 text-slate-300">
                  <Camera size={64} strokeWidth={1.5} />
                </div>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  className="hidden"
                  onChange={handlePhotoSelected}
                />
                <Button
                  onClick={() => photoInputRef.current?.click()}
                  className={cn("w-full font-black shadow-lg shadow-[#0000A0]/20", tabletMode ? "h-16 text-lg" : "h-14 text-base")}
                >
                  <Camera size={20} className="mr-2" />
                  ABRIR CÂMERA
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="relative w-full overflow-hidden rounded-3xl bg-slate-100 flex items-center justify-center min-h-[300px] max-h-[600px]">
                  <img
                    src={capturedPhoto}
                    alt="Foto de confirmação"
                    className="max-w-full max-h-full object-contain"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/5 transition-colors rounded-3xl" />
                </div>
                <div className="flex w-full gap-3">
                  <Button
                    variant="outline"
                    onClick={refazerFoto}
                    className={cn("flex-1 font-black border-slate-200", tabletMode ? "h-14 text-base" : "h-12")}
                  >
                    <RefreshCw size={16} className="mr-2" />
                    REFAZER
                  </Button>
                  <Button
                    onClick={handleConfirm}
                    disabled={isSubmitting}
                    className={cn("flex-1 font-black shadow-lg shadow-[#0000A0]/20", tabletMode ? "h-14 text-base" : "h-12")}
                  >
                    {isSubmitting ? 'PROCESSANDO...' : 'CONFIRMAR TRANSFERÊNCIA'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── STEP 6: SUCESSO ───────────────────────────────────────────── */}
      {step === 6 && (
        <div className="flex flex-col items-center justify-center py-10 sm:py-20 animate-in fade-in zoom-in duration-500">
          <div className="mb-8 flex h-32 w-32 items-center justify-center rounded-[48px] bg-green-50 text-green-500 shadow-xl shadow-green-100">
            <CheckCircle2 size={64} strokeWidth={2.5} />
          </div>
          <h2 className={cn("font-black text-[#1E293B] text-center mb-2", tabletMode ? "text-5xl" : "text-4xl")}>Transferência Realizada!</h2>
          <p className={cn("font-medium text-slate-400 mb-12 text-center max-w-xs sm:max-w-lg", tabletMode ? "text-xl" : "text-lg")}>
            Os ativos agora constam sob a responsabilidade de{' '}
            <span className="text-[#1E293B] font-bold">{recebedor.nome}</span> em{' '}
            <span className="text-[#0000A0] font-bold">{destino.sala}</span>.
          </p>

          <div className="flex flex-col items-center gap-6">
            <div className="flex items-center gap-2 text-amber-600 font-bold bg-amber-50 px-4 py-3 rounded-2xl border border-amber-100">
              <Mail size={20} />
              <span className="text-sm">O termo de responsabilidade será enviado para o e-mail do gestor.</span>
            </div>

            <div className="flex flex-wrap justify-center gap-4">
              {termoUrl && (
                <a
                  href={termoUrl}
                  download={`termo_${currentLoteId}.pdf`}
                  className={cn(
                    "flex items-center gap-2 rounded-2xl border-2 border-[#0000A0] font-black text-[#0000A0] transition-colors hover:bg-[#0000A0] hover:text-white",
                    tabletMode ? "h-16 px-10 text-base" : "h-14 px-8 text-sm"
                  )}
                >
                  <FileDown size={tabletMode ? 22 : 18} />
                  BAIXAR TERMO
                </a>
              )}
              <Button
                onClick={resetWizard}
                variant="outline"
                className={cn("rounded-2xl border-slate-200 text-slate-500 font-black", tabletMode ? "h-16 px-10 text-base" : "h-14 px-8")}
              >
                NOVA MOVIMENTAÇÃO
              </Button>
              <Button
                onClick={() => navigate('/')}
                className={cn("rounded-2xl font-black shadow-xl shadow-[#0000A0]/20", tabletMode ? "h-16 px-12 text-base" : "h-14 px-10")}
              >
                VOLTAR AO INÍCIO
              </Button>
            </div>
          </div>
        </div>
      )}

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
