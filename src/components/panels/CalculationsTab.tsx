import { useState } from 'react';
import { Plus, Calculator, Trash2 } from 'lucide-react';

type CalculationStatus = 'draft' | 'verified';
type CalculationType = 'beam' | 'column' | 'slab' | 'foundation' | 'connection' | 'other';

interface CalculationItem {
  id: string;
  name: string;
  status: CalculationStatus;
  type: CalculationType;
}

const STATUS_CONFIG: Record<CalculationStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-amber-500/30 text-amber-300' },
  verified: { label: 'Verified', color: 'bg-green-500/30 text-green-300' },
};

const TYPE_LABELS: Record<CalculationType, string> = {
  beam: 'Beam',
  column: 'Column',
  slab: 'Slab',
  foundation: 'Foundation',
  connection: 'Connection',
  other: 'Other',
};

export function CalculationsTab() {
  const [calculations] = useState<CalculationItem[]>([]);
  const [showPlaceholder, setShowPlaceholder] = useState(false);

  const handleAddCalculation = () => {
    setShowPlaceholder(!showPlaceholder);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-end px-2 py-1 border-b border-cad-border">
        <div className="flex gap-1">
          <button
            onClick={handleAddCalculation}
            className="p-1 rounded hover:bg-cad-border transition-colors"
            title="Add Calculation"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Placeholder for future new calculation form */}
      {showPlaceholder && (
        <div className="p-2 border-b border-cad-border bg-cad-surface-elevated">
          <div className="space-y-2">
            <div className="text-xs text-cad-text-dim">
              Calculation creation will be available in a future update.
            </div>
            <button
              onClick={() => setShowPlaceholder(false)}
              className="w-full px-2 py-1 text-xs bg-cad-border text-cad-text rounded hover:bg-cad-border/80"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Calculations List */}
      <div className="flex-1 overflow-auto p-2">
        {calculations.length === 0 ? (
          <div className="text-xs text-cad-text-dim text-center py-4">
            No calculations yet.
            <br />
            Add a structural calculation.
          </div>
        ) : (
          <div className="space-y-1">
            {calculations.map((calc) => (
              <div
                key={calc.id}
                className="group flex items-center gap-2 px-2 py-1.5 rounded cursor-default transition-colors hover:bg-cad-border/50 border border-transparent"
              >
                {/* Calculator icon */}
                <Calculator size={12} className="text-cad-text-dim shrink-0" />

                {/* Calculation info */}
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-cad-text truncate block">
                    {calc.name}
                  </span>
                  <span className="text-[10px] text-cad-text-dim">
                    {TYPE_LABELS[calc.type]}
                  </span>
                </div>

                {/* Status badge */}
                <span
                  className={`text-[9px] font-medium px-1 rounded shrink-0 ${STATUS_CONFIG[calc.status].color}`}
                >
                  {STATUS_CONFIG[calc.status].label}
                </span>

                {/* Delete button (visible on hover) */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-cad-border text-cad-text-dim hover:text-red-400 transition-all"
                  title="Delete Calculation"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
