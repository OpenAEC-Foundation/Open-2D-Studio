import { PropertiesPanel } from './PropertiesPanel';

export function RightPanelLayout() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <PropertiesPanel />
      </div>
    </div>
  );
}
