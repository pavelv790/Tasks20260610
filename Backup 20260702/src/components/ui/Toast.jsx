import { useEffect } from 'react';
import { X, CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react';

const TYPES = {
  success: { bg: 'bg-green-500',  Icon: CheckCircle  },
  error:   { bg: 'bg-red-500',    Icon: XCircle      },
  warning: { bg: 'bg-orange-500', Icon: AlertCircle  },
  info:    { bg: 'bg-blue-500',   Icon: Info         },
};

export default function Toast({ message, type = 'info', onClose, duration = 3000 }) {
  useEffect(() => {
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [duration, onClose]);

  const { bg, Icon } = TYPES[type] ?? TYPES.info;

  return (
    <div className={`fixed top-4 right-4 ${bg} text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 z-50 animate-slide-in`}>
      <Icon className="w-5 h-5 flex-shrink-0" />
      <p className="font-semibold">{message}</p>
      <button
        onClick={onClose}
        className="ml-2 hover:bg-white hover:bg-opacity-20 rounded-lg p-1 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
