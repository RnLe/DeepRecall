// literatureBannerCard.tsx
import React from 'react';
import { LiteratureType } from '../../helpers/literatureTypes';

export interface LiteratureBannerCardProps {
  type: LiteratureType;
  className?: string; // Additional Tailwind CSS classes
  onClick?: () => void;
  children?: React.ReactNode;
}

const backgroundImages: Record<LiteratureType, string> = {
  Script: '/banners/script_banner_bg.webp',
  Textbook: '/banners/textbook_banner_bg.webp',
  Paper: '/banners/paper_banner_bg.webp',
  Thesis: '/banners/thesis_banner_bg.webp',
  Manual: '/banners/manual_banner_bg.webp',
};

const LiteratureBannerCard: React.FC<LiteratureBannerCardProps> = ({ type, className = "", onClick, children }) => {
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
      <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50 text-white">
        {children}
      </div>
    </div>
  );
};

export default LiteratureBannerCard;
