import { ActiveView } from '../types';

interface TopBarProps {
  activeView: ActiveView;
  onSelectView: (view: ActiveView) => void;
  onQuickImport: () => void;
}

const NAV_ITEMS: { id: ActiveView; label: string }[] = [
  { id: 'draw', label: '隨機抽籤' },
  { id: 'group', label: '自動分組' },
  { id: 'roster', label: '學生名單' },
];

export function TopBar({ activeView, onSelectView, onQuickImport }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-8">
        {/* Zone 1: Brand wordmark (single text element) */}
        <button
          type="button"
          onClick={() => onSelectView('draw')}
          className="text-base sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 rounded"
        >
          課堂抽籤與分組
        </button>

        {/* Zone 2: Clean single-line text navigation links */}
        <nav
          aria-label="主要功能導覽"
          className="flex items-center gap-5 sm:gap-8 h-full overflow-x-auto"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectView(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`h-full inline-flex items-center text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 ${
                  isActive
                    ? 'border-sky-600 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single primary action */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={onQuickImport}
            className="px-4 py-2 text-xs sm:text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 active:bg-sky-800 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
          >
            匯入名單
          </button>
        </div>
      </div>
    </header>
  );
}
