import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon?: React.ElementType;
  children: React.ReactNode;
  width?: string;
}

export function Modal({ isOpen, onClose, title, icon: Icon, children, width = 'max-w-2xl' }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 pt-10 pb-10 sm:p-6 backdrop-blur-sm">
      <div 
        className={`relative flex max-h-[90vh] w-full flex-col rounded-3xl bg-white shadow-2xl ${width}`}
        role="dialog"
      >
        {/* HEADER */}
        <div className="flex shrink-0 items-center justify-between rounded-t-3xl bg-[#0000A0] px-8 py-6">
          <div className="flex items-center gap-3 text-white">
            {Icon && <Icon size={20} />}
            <h2 className="text-base font-black uppercase tracking-wide">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto px-8 py-8">
          {children}
        </div>
      </div>
    </div>
  );
}
