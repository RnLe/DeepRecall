// PlannerLeftSidebar.tsx

import React from 'react';
import { CardId } from './PlannerMainContainer';

// Extend SidebarProps with collapse props
interface SidebarProps {
  selectedCard: CardId | null;
  onSelectCard: (cardId: CardId) => void;
  onDoubleClickCard: (cardId: CardId) => void;
  onCenterView: () => void;
  collapsed: boolean;
  toggleCollapse: () => void;
}

const sidebarItems: { id: CardId; label: string }[] = [
  { id: 'quartal', label: 'Quartal' },
  { id: 'month-1', label: 'Month 1' },
  { id: 'month-2', label: 'Month 2' },
  { id: 'month-3', label: 'Month 3' },
  ...Array.from({ length: 12 }, (_, i) => ({ id: `week-${i + 1}`, label: `Week ${i + 1}` })),
];

export const PlannerLeftSidebar: React.FC<SidebarProps> = ({
  selectedCard,
  onSelectCard,
  onDoubleClickCard,
  onCenterView,
  collapsed,
  toggleCollapse,
}) => {
  return (
    <div className={`box-border transition-all duration-300 h-full relative ${collapsed ? 'w-8' : 'w-40 p-4'} bg-gray-800 overflow-y-auto overflow-x-hidden`}>
      {/* Collapse/Expand Button */}
      <button
        className="absolute -right-8 top-1/2 -translate-y-1/2 w-8 h-10 bg-gray-700 hover:bg-gray-600 flex items-center justify-center rounded-r z-20 border border-gray-600"
        onClick={() => { console.log('Left sidebar toggle clicked'); toggleCollapse(); }}
        tabIndex={0}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <span className="text-white text-lg">{collapsed ? '⮞' : '⮜'}</span>
      </button>
      {!collapsed && (
        <>
          {/* Top area: Square button for global centering */}
          <button
            className="w-10 h-10 bg-gray-700 hover:bg-gray-600 mb-4 flex items-center justify-center"
            onClick={onCenterView}
            title="Center View"
          >
            <div className="w-5 h-5 bg-white"></div>
          </button>
          {sidebarItems.map((item) => (
            <div
              key={item.id}
              className={`p-2 cursor-pointer rounded mb-2 ${selectedCard === item.id ? 'bg-blue-500' : 'hover:bg-gray-700'}`}
              onClick={() => onSelectCard(item.id)}
              onDoubleClick={() => onDoubleClickCard(item.id)}
            >
              {item.label}
            </div>
          ))}
        </>
      )}
    </div>
  );
};

export default PlannerLeftSidebar;
