import { Modal } from './Modal';
import { Button } from './button';
import { CheckCircle2, XCircle } from 'lucide-react';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  success: boolean;
  title: string;
  message: string;
  extraButton?: { label: string; onClick: () => void };
}

export const FeedbackModal = ({ isOpen, onClose, success, title, message, extraButton }: FeedbackModalProps) => (
  <Modal isOpen={isOpen} onClose={onClose} title={title} width="max-w-sm">
    <div className="flex flex-col items-center gap-6 text-center">
      <div className={`flex h-16 w-16 items-center justify-center rounded-full ${success ? 'bg-green-100' : 'bg-red-100'}`}>
        {success
          ? <CheckCircle2 size={36} className="text-green-500" />
          : <XCircle size={36} className="text-red-500" />
        }
      </div>
      <p className="text-sm font-bold text-slate-400 leading-relaxed" dangerouslySetInnerHTML={{ __html: message }} />
      {extraButton && (
        <Button
          variant="outline"
          onClick={extraButton.onClick}
          className="w-full font-black border-[#0000A0] text-[#0000A0] hover:bg-blue-50"
        >
          {extraButton.label}
        </Button>
      )}
      <Button
        onClick={onClose}
        className={`w-full font-black ${success ? '' : 'bg-red-600 hover:bg-red-700'}`}
      >
        FECHAR
      </Button>
    </div>
  </Modal>
);
