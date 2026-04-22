import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatLocal(l: { campus: string; bloco?: string | null; sala: string }): string {
  const parts = [`Campus ${l.campus}`];
  if (l.bloco) parts.push(`Bloco ${l.bloco}`);
  parts.push(`Sala ${l.sala}`);
  return parts.join(' | ');
}

export function safeParseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  let s = dateStr.trim();
  // Se contiver espaço (padrão SQL: 2026-04-08 14:11:00), troca por T
  if (s.includes(' ') && !s.includes('T')) s = s.replace(' ', 'T');
  
  // Se não tiver indicador de fuso, deixamos como está para o navegador tratar como Local
  const safeStr = s;
  
  const date = new Date(safeStr);
  if (!isNaN(date.getTime())) return date;

  // Fallback para formatos muito estranhos
  const fallback = new Date(dateStr);
  return isNaN(fallback.getTime()) ? null : fallback;
}

/**
 * Converte uma data (ISO string ou similar) para o formato YYYY-MM-DD
 * exigido pelos inputs do tipo 'date' do HTML.
 */
export function formatDateForInput(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  return dateStr.substring(0, 10);
}

export function matchesSearch(text: string | null | undefined, search: string): boolean {
  if (!search) return true;
  if (!text) return false;
  return text.toLowerCase().includes(search.toLowerCase());
}

export function matchesPatrimonio(patr: string | null | undefined, search: string): boolean {
  if (!search) return true;
  if (!patr) return false;

  const patrLower = patr.toLowerCase();
  const searchLower = search.toLowerCase();

  // Busca exata ou parcial padrão
  if (patrLower.includes(searchLower)) return true;

  // Busca inteligente (ignorando zeros à esquerda se for numérico)
  const searchNumeric = search.replace(/^0+/, '');
  const patrNumeric = patr.replace(/^0+/, '');

  if (searchNumeric !== '' && patrNumeric === searchNumeric) return true;

  return false;
}
