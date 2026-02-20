import { useState } from 'react';
import { Plus, Table, ClipboardList, Trash2 } from 'lucide-react';

interface QueryItem {
  id: string;
  name: string;
  type: 'schedule' | 'quantity-takeoff';
  itemCount: number;
}

export function QueriesTab() {
  const [queries] = useState<QueryItem[]>([]);
  const [showPlaceholder, setShowPlaceholder] = useState(false);

  const handleAddQuery = () => {
    setShowPlaceholder(!showPlaceholder);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-end px-2 py-1 border-b border-cad-border">
        <div className="flex gap-1">
          <button
            onClick={handleAddQuery}
            className="p-1 rounded hover:bg-cad-border transition-colors"
            title="Add Query"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Placeholder for future new query form */}
      {showPlaceholder && (
        <div className="p-2 border-b border-cad-border bg-cad-surface-elevated">
          <div className="space-y-2">
            <div className="text-xs text-cad-text-dim">
              Query creation will be available in a future update.
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

      {/* Queries List */}
      <div className="flex-1 overflow-auto p-2">
        {queries.length === 0 ? (
          <div className="text-xs text-cad-text-dim text-center py-4">
            No queries yet.
            <br />
            Create a schedule or quantity takeoff.
          </div>
        ) : (
          <div className="space-y-1">
            {queries.map((query) => (
              <div
                key={query.id}
                className="group flex items-center gap-2 px-2 py-1.5 rounded cursor-default transition-colors hover:bg-cad-border/50 border border-transparent"
              >
                {/* Query type icon */}
                {query.type === 'schedule' ? (
                  <Table size={12} className="text-cad-text-dim shrink-0" />
                ) : (
                  <ClipboardList size={12} className="text-cad-text-dim shrink-0" />
                )}

                {/* Query info */}
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-cad-text truncate block">
                    {query.name}
                  </span>
                  <span className="text-[10px] text-cad-text-dim">
                    {query.type === 'schedule' ? 'Schedule' : 'Quantity Takeoff'} | {query.itemCount} items
                  </span>
                </div>

                {/* Delete button (visible on hover) */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-cad-border text-cad-text-dim hover:text-red-400 transition-all"
                  title="Delete Query"
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
