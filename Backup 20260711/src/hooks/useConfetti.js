import { useCallback } from 'react';
import confetti from 'canvas-confetti';

export function useConfetti() {
  const fireConfetti = useCallback(() => {
    const duration  = 2000;
    const endTime   = Date.now() + duration;

    const tick = () => {
      const timeLeft     = endTime - Date.now();
      if (timeLeft <= 0) return;

      const particleCount = 50 * (timeLeft / duration);
      const rand = (min, max) => Math.random() * (max - min) + min;

      confetti({ particleCount, startVelocity: 30, spread: 360, ticks: 60, origin: { x: rand(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ particleCount, startVelocity: 30, spread: 360, ticks: 60, origin: { x: rand(0.7, 0.9), y: Math.random() - 0.2 } });

      setTimeout(tick, 250);
    };

    tick();
  }, []);

  const fireGoldenConfetti = useCallback(() => {
    const defaults = { origin: { y: 0.7 }, zIndex: 9999, colors: ['#FFD700', '#FFA500', '#FF8C00'] };
    const fire = (ratio, opts) =>
      confetti({ ...defaults, ...opts, particleCount: Math.floor(200 * ratio) });

    fire(0.25, { spread: 26, startVelocity: 55 });
    fire(0.20, { spread: 60 });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
    fire(0.10, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
    fire(0.10, { spread: 120, startVelocity: 45 });
  }, []);

  return { fireConfetti, fireGoldenConfetti };
}