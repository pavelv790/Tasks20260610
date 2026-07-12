import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

export default function InstallPrompt() {
  const [prompt, setPrompt]   = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    const dismissed = localStorage.getItem('installPromptDismissed');
    if (dismissed && (Date.now() - parseInt(dismissed)) < 7 * 24 * 60 * 60 * 1000) return;

    const handler = (e) => { e.preventDefault(); setPrompt(e); setVisible(true); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!visible) return null;

  const handleInstall = async () => {
    if (!prompt) return;
    prompt.prompt();
    await prompt.userChoice;
    setVisible(false);
  };

  const handleDismiss = () => {
    localStorage.setItem('installPromptDismissed', Date.now().toString());
    setVisible(false);
  };

  return (
    <div className="fixed top-4 left-4 right-4 bg-gradient-to-r from-purple-500 to-orange-400 text-white rounded-2xl shadow-2xl p-4 z-50 animate-slide-down">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
          <Download className="w-6 h-6 flex-shrink-0" />
          <div>
            <p className="font-bold text-sm">Инсталирай приложението</p>
            <p className="text-xs opacity-90">Бърз достъп и офлайн работа</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleInstall} className="px-4 py-2 bg-white text-purple-600 rounded-lg font-bold text-sm">Инсталирай</button>
          <button onClick={handleDismiss} className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
      </div>
    </div>
  );
}
