import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Package } from 'lucide-react';
import { Ativo } from '@/pages/Ativos';

const statusMap: Record<string, { label: string; color: string }> = {
  ATIVO:   { label: 'Ativo',   color: 'bg-green-100 text-green-700' },
  INATIVO: { label: 'Inativo', color: 'bg-red-100 text-red-700' },
};

const conservacaoMap: Record<string, string> = {
  OTIMO:   'Ótimo',
  BOM:     'Bom',
  REGULAR: 'Regular',
  RUIM:    'Ruim',
  PESSIMO: 'Péssimo',
};

interface AtivoTooltipProps {
  ativo: Ativo;
  children: React.ReactNode;
}

export const AtivoTooltip = ({ ativo, children }: AtivoTooltipProps) => {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, above: true });
  const triggerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const tooltipHeight = 220;
    const above = rect.top > tooltipHeight + 8;
    setPos({
      top: above ? rect.top - 8 : rect.bottom + 8,
      left: Math.min(rect.left, window.innerWidth - 272),
      above,
    });
    setVisible(true);
  };

  const handleMouseLeave = () => setVisible(false);

  const patrimonio = ativo.numero_patrimonio || ativo.patrimonio || '--';
  const sigla = !ativo.is_proprio && ativo.fornecedor_sigla ? `${ativo.fornecedor_sigla} - ` : '';
  const statusKey = ativo.ativo !== false ? 'ATIVO' : 'INATIVO';
  const statusEntry = statusMap[statusKey];
  const conservacaoKey = (ativo.estado_conservacao || '').toUpperCase();
  const conservacao = conservacaoMap[conservacaoKey] || ativo.estado_conservacao || null;

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="flex items-center gap-2 cursor-default"
      >
        {children}
      </div>

      {visible && createPortal(
        <div
          style={{
            position: 'fixed',
            top: pos.above ? undefined : pos.top,
            bottom: pos.above ? window.innerHeight - pos.top : undefined,
            left: pos.left,
            zIndex: 9999,
          }}
          className="w-64 rounded-2xl bg-white border border-slate-100 shadow-xl p-4 pointer-events-none"
        >
          {/* Header */}
          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-50">
            <Package size={14} className="text-[#0000A0] shrink-0" />
            <div className="min-w-0">
              <p className="font-black text-[#1E293B] text-sm truncate">{sigla}{patrimonio}</p>
              {ativo.nome && (
                <p className="text-[10px] font-bold text-slate-400 truncate">{ativo.nome}</p>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="flex flex-col gap-1.5 text-[11px]">
            <div className="flex justify-between gap-2">
              <span className="font-black text-slate-400 uppercase tracking-wider shrink-0">Tipo</span>
              <span className="font-bold text-[#1E293B] text-right">{ativo.tipo || '--'}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="font-black text-slate-400 uppercase tracking-wider shrink-0">Marca / Modelo</span>
              <span className="font-bold text-[#1E293B] text-right">{ativo.marca || '--'} / {ativo.modelo || '--'}</span>
            </div>
            {ativo.numero_serie && (
              <div className="flex justify-between gap-2">
                <span className="font-black text-slate-400 uppercase tracking-wider shrink-0">N/S</span>
                <span className="font-bold text-[#1E293B] text-right">{ativo.numero_serie}</span>
              </div>
            )}
            {ativo.localizacao && (
              <div className="flex justify-between gap-2">
                <span className="font-black text-slate-400 uppercase tracking-wider shrink-0">Local</span>
                <span className="font-bold text-[#1E293B] text-right">
                  {ativo.localizacao.bloco
                    ? `${ativo.localizacao.bloco} — ${ativo.localizacao.sala}`
                    : ativo.localizacao.sala}
                </span>
              </div>
            )}
          </div>

          {/* Badges */}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-50 flex-wrap">
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${statusEntry.color}`}>
              {statusEntry.label}
            </span>
            {conservacao && (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-black text-slate-600">
                {conservacao}
              </span>
            )}
            {ativo.is_proprio === false && ativo.fornecedor && (
              <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-[10px] font-black text-purple-700">
                {ativo.fornecedor.nome_empresa}
              </span>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
