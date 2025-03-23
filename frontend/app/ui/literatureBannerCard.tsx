// literatureBannerCard.tsx

import React from 'react';

export type literatureBannerType = "Script" | "Textbook" | "Paper";

export interface literatureBannerCardProps {
  type: literatureBannerType;
  className?: string; // Additional Tailwind CSS classes
  onClick?: () => void;
  children?: React.ReactNode;
}

const backgroundImages: Record<literatureBannerType, string> = {
  Script: '/banners/script_banner_bg.webp',
  Textbook: '/banners/textbook_banner_bg.webp',
  Paper: '/banners/paper_banner_bg.webp',
};

const LiteratureBannerCard: React.FC<literatureBannerCardProps> = ({ type, className = "", onClick, children }) => {
  return (
    <div
      onClick={onClick}
      className={`relative bg-cover bg-center hover:cursor-pointer hover:opacity-90 transition-opacity duration-200 ${className}`}
      style={{
        backgroundImage: `url(${backgroundImages[type]})`,
        // Provide a default minimum size with a wide aspect ratio:
        minWidth: '300px',
        minHeight: '150px',
      }}
    >
      {/* Optional overlay for children (e.g., title/text) */}
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
};

export default LiteratureBannerCard;
