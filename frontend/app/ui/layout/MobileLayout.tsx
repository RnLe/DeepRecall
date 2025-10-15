import React, { useEffect, useState } from 'react';
import { useCapacitorAnnotations } from '@/app/customHooks/useCapacitorAnnotations';

interface MobileLayoutProps {
  children: React.ReactNode;
}

/**
 * Mobile-optimized layout wrapper for Capacitor apps
 * Handles safe areas, status bars, and mobile-specific UI adjustments
 */
const MobileLayout: React.FC<MobileLayoutProps> = ({ children }) => {
  const { isNative, supportsPen } = useCapacitorAnnotations();
  const [safeAreaInsets, setSafeAreaInsets] = useState({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0
  });

  useEffect(() => {
    if (isNative) {
      // Get safe area insets for iOS devices with notches/home indicators
      const computeInsets = () => {
        const style = getComputedStyle(document.documentElement);
        setSafeAreaInsets({
          top: parseInt(style.getPropertyValue('--sat') || '0'),
          bottom: parseInt(style.getPropertyValue('--sab') || '0'),
          left: parseInt(style.getPropertyValue('--sal') || '0'),
          right: parseInt(style.getPropertyValue('--sar') || '0')
        });
      };

      computeInsets();
      window.addEventListener('resize', computeInsets);
      return () => window.removeEventListener('resize', computeInsets);
    }
  }, [isNative]);

  const containerStyle = isNative ? {
    paddingTop: `max(${safeAreaInsets.top}px, env(safe-area-inset-top))`,
    paddingBottom: `max(${safeAreaInsets.bottom}px, env(safe-area-inset-bottom))`,
    paddingLeft: `max(${safeAreaInsets.left}px, env(safe-area-inset-left))`,
    paddingRight: `max(${safeAreaInsets.right}px, env(safe-area-inset-right))`,
    height: '100vh',
    overflow: 'hidden'
  } : {};

  return (
    <div 
      className={`w-full h-full ${isNative ? 'mobile-app' : ''}`}
      style={containerStyle}
    >
      {/* Status indicator for development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed top-0 left-0 z-50 bg-blue-500 text-white text-xs px-2 py-1">
          {isNative ? 'Native App' : 'Web App'} 
          {supportsPen && ' + Pen Support'}
        </div>
      )}
      
      {children}
      
      <style jsx global>{`
        .mobile-app {
          /* Prevent bounce scrolling on iOS */
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: none;
        }
        
        .mobile-app * {
          /* Improve touch responsiveness */
          -webkit-tap-highlight-color: transparent;
          -webkit-touch-callout: none;
        }
        
        /* Apple Pencil optimizations */
        .mobile-app canvas {
          touch-action: manipulation;
        }
        
        /* Safe area support */
        :root {
          --sat: env(safe-area-inset-top);
          --sab: env(safe-area-inset-bottom);
          --sal: env(safe-area-inset-left);
          --sar: env(safe-area-inset-right);
        }
      `}</style>
    </div>
  );
};

export default MobileLayout;
