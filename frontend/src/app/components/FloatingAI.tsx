import { BookOpen } from 'lucide-react';
import { Link } from 'react-router';
import { buildAiRoute } from '../lib/routes';

export function FloatingAI() {
  return (
    <div className="group fixed bottom-28 right-6 z-30">
      <Link
        to={buildAiRoute()}
        aria-label="打开规划"
        className="relative flex h-12 w-12 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors active:bg-slate-100"
      >
        <BookOpen size={20} />
      </Link>
    </div>
  );
}
