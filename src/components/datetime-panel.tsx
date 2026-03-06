import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

export function DateTimePanel() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  return (
    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100/80 border border-gray-200 text-sm">
      <Clock className="w-4 h-4 text-gray-500" />
      <div className="text-left">
        <div className="font-medium text-gray-800">{dateStr}</div>
        <div className="text-gray-600 tabular-nums">{timeStr}</div>
      </div>
    </div>
  );
}
