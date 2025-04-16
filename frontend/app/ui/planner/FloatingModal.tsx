// FloatingModal.tsx
import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

interface FloatingModalProps {
  onClose: () => void;
  children: React.ReactNode;
}

export const FloatingModal: React.FC<FloatingModalProps> = ({ onClose, children }) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return ReactDOM.createPortal(
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-40">
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className="bg-transparent"
        style={{
          minWidth: 1200, // increased minimum width
          maxWidth: '98vw',
          minHeight: 500, // increased minimum height for more vertical space
          maxHeight: '90vh',
          overflow: 'auto',
          display: 'flex',
          padding: '20px', // extra padding for spacing
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {children}
      </div>
    </div>,
    document.body
  );
};
