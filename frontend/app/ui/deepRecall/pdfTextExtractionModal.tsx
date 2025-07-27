import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Check, RotateCcw, Plus, Clock, Edit2, Trash2, AlertTriangle, Calendar, Pencil, ZoomIn, ZoomOut } from 'lucide-react';
import { pdfDocumentService } from '../../services/pdfDocumentService';
import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';

interface PdfTextExtractionModalProps {
  file: File | null;
  isOpen: boolean;
  onClose: () => void;
  fields: Array<{ key: string; label: string; value: any }>;
  onFieldUpdate: (key: string, value: string) => void;
}

interface TextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName: string;
  fontSize: number;
}

interface RecentSelection {
  id: string;
  text: string;
  timestamp: number;
  fieldKey?: string;
}

interface Author {
  id: string;
  name: string;
}

interface ExtractedDate {
  id: string;
  originalText: string;
  parsedDate: string;
  confidence: 'high' | 'medium' | 'low';
  format: string;
}

const PdfTextExtractionModal: React.FC<PdfTextExtractionModalProps> = ({
  file,
  isOpen,
  onClose,
  fields,
  onFieldUpdate
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [textItems, setTextItems] = useState<TextItem[]>([]);
  const [isPdfLoaded, setIsPdfLoaded] = useState(false);
  const [pageViewport, setPageViewport] = useState<any>(null); // Store the actual viewport
  const [recentSelections, setRecentSelections] = useState<RecentSelection[]>([]);
  const [showSelectionHistory, setShowSelectionHistory] = useState(false);
  const [extractedAuthors, setExtractedAuthors] = useState<Author[]>([]);
  const [editingAuthor, setEditingAuthor] = useState<string | null>(null);
  const [extractedDates, setExtractedDates] = useState<ExtractedDate[]>([]);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [fieldWarnings, setFieldWarnings] = useState<Record<string, string>>({});
  const [editingTextField, setEditingTextField] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);
  const [hoveredSection, setHoveredSection] = useState<number | null>(null);
  const [textLines, setTextLines] = useState<TextItem[][]>([]);
  const [textSections, setTextSections] = useState<TextItem[][][]>([]);
  const [selectionMode, setSelectionMode] = useState<'sections' | 'lines' | 'selection'>('sections');
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null);

  // Helper function to clean and fix common text extraction issues
  const cleanExtractedText = (text: string): string => {
    return text
      // Fix common encoding issues with accented characters
      .replace(/Ã¡/g, 'á')
      .replace(/Ã©/g, 'é')
      .replace(/Ã­/g, 'í')
      .replace(/Ã³/g, 'ó')
      .replace(/Ãº/g, 'ú')
      .replace(/Ã /g, 'à')
      .replace(/Ã¨/g, 'è')
      .replace(/Ã¬/g, 'ì')
      .replace(/Ã²/g, 'ò')
      .replace(/Ã¹/g, 'ù')
      .replace(/Ã¢/g, 'â')
      .replace(/Ãª/g, 'ê')
      .replace(/Ã®/g, 'î')
      .replace(/Ã´/g, 'ô')
      .replace(/Ã»/g, 'û')
      .replace(/Ã¤/g, 'ä')
      .replace(/Ã«/g, 'ë')
      .replace(/Ã¯/g, 'ï')
      .replace(/Ã¶/g, 'ö')
      .replace(/Ã¼/g, 'ü')
      .replace(/Ã¿/g, 'ÿ')
      .replace(/Ã§/g, 'ç')
      .replace(/Ã±/g, 'ñ')
      .replace(/Ã/g, 'Á')
      .replace(/Ã‰/g, 'É')
      .replace(/Ã/g, 'Í')
      .replace(/Ã"/g, 'Ó')
      .replace(/Ãš/g, 'Ú')
      .replace(/Ã€/g, 'À')
      .replace(/Ãˆ/g, 'È')
      .replace(/ÃŒ/g, 'Ì')
      .replace(/Ã'/g, 'Ò')
      .replace(/Ã™/g, 'Ù')
      .replace(/Ã‚/g, 'Â')
      .replace(/ÃŠ/g, 'Ê')
      .replace(/ÃŽ/g, 'Î')
      .replace(/Ã"/g, 'Ô')
      .replace(/Ã›/g, 'Û')
      .replace(/Ã„/g, 'Ä')
      .replace(/Ã‹/g, 'Ë')
      .replace(/Ã/g, 'Ï')
      .replace(/Ã–/g, 'Ö')
      .replace(/Ãœ/g, 'Ü')
      .replace(/Ã‡/g, 'Ç')
      .replace(/Ã'/g, 'Ñ')
      // Fix specific cases where acute accents appear as separate characters
      .replace(/([a-zA-Z])´\s*([aeiou])/g, (match, letter, vowel) => {
        const accentMap: Record<string, string> = {
          'a': 'á', 'e': 'é', 'i': 'í', 'o': 'ó', 'u': 'ú',
          'A': 'Á', 'E': 'É', 'I': 'Í', 'O': 'Ó', 'U': 'Ú'
        };
        return letter + (accentMap[vowel] || vowel);
      })
      // Fix cases like "Moir´ e" -> "Moiré"
      .replace(/([a-zA-Z])´\s+([aeiouAEIOU])/g, (match, letter, vowel) => {
        const accentMap: Record<string, string> = {
          'a': 'á', 'e': 'é', 'i': 'í', 'o': 'ó', 'u': 'ú',
          'A': 'Á', 'E': 'É', 'I': 'Í', 'O': 'Ó', 'U': 'Ú'
        };
        return letter + (accentMap[vowel] || vowel);
      })
      // Fix cases where acute accent comes after the vowel: "e´" -> "é"
      .replace(/([aeiouAEIOU])´/g, (match, vowel) => {
        const accentMap: Record<string, string> = {
          'a': 'á', 'e': 'é', 'i': 'í', 'o': 'ó', 'u': 'ú',
          'A': 'Á', 'E': 'É', 'I': 'Í', 'O': 'Ó', 'U': 'Ú'
        };
        return accentMap[vowel] || vowel;
      })
      // Fix other common diacritic separations
      .replace(/([a-zA-Z])\s*`\s*([aeiouAEIOU])/g, (match, letter, vowel) => {
        const graveMap: Record<string, string> = {
          'a': 'à', 'e': 'è', 'i': 'ì', 'o': 'ò', 'u': 'ù',
          'A': 'À', 'E': 'È', 'I': 'Ì', 'O': 'Ò', 'U': 'Ù'
        };
        return letter + (graveMap[vowel] || vowel);
      })
      // Fix circumflex separations: "o^ " -> "ô"
      .replace(/([aeiouAEIOU])\s*\^\s*/g, (match, vowel) => {
        const circumflexMap: Record<string, string> = {
          'a': 'â', 'e': 'ê', 'i': 'î', 'o': 'ô', 'u': 'û',
          'A': 'Â', 'E': 'Ê', 'I': 'Î', 'O': 'Ô', 'U': 'Û'
        };
        return circumflexMap[vowel] || vowel;
      })
      // Fix common punctuation issues
      .replace(/â€™/g, "'")
      .replace(/â€œ/g, '"')
      .replace(/â€/g, '"')
      .replace(/â€"/g, '–')
      .replace(/â€"/g, '—')
      .replace(/â€¦/g, '…')
      .replace(/â€¢/g, '•')
      // Fix spacing issues - normalize multiple spaces to single space
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Helper function to format field labels
  const formatFieldLabel = (label: string): string => {
    return label
      // Remove redundant words like "version Version Number" -> "Version Number"
      .replace(/\b(\w+)\s+\1\b/gi, '$1')
      // Capitalize each word
      .replace(/\b\w+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      // Handle special cases
      .replace(/\bId\b/g, 'ID')
      .replace(/\bUrl\b/g, 'URL')
      .replace(/\bApi\b/g, 'API')
      .replace(/\bPdf\b/g, 'PDF')
      .trim();
  };

  // Group text items into lines based on their Y coordinates
  const groupTextIntoLines = (items: TextItem[]): TextItem[][] => {
    if (items.length === 0) return [];

    // Sort items by Y coordinate first, then by X coordinate
    const sortedItems = [...items].sort((a, b) => {
      const yDiff = a.y - b.y;
      if (Math.abs(yDiff) < 5) { // Items on the same line (within 5px tolerance)
        return a.x - b.x;
      }
      return yDiff;
    });

    const lines: TextItem[][] = [];
    let currentLine: TextItem[] = [];
    let currentY = sortedItems[0]?.y;

    for (const item of sortedItems) {
      // Check if this item belongs to the current line
      if (Math.abs(item.y - currentY) < 5) {
        currentLine.push(item);
      } else {
        // Start a new line
        if (currentLine.length > 0) {
          lines.push(currentLine);
        }
        currentLine = [item];
        currentY = item.y;
      }
    }

    // Add the last line
    if (currentLine.length > 0) {
      lines.push(currentLine);
    }

    return lines;
  };

  // Group lines into sections based on larger gaps (paragraphs/sections)
  const groupLinesIntoSections = (lines: TextItem[][]): TextItem[][][] => {
    if (lines.length === 0) return [];

    const sections: TextItem[][][] = [];
    let currentSection: TextItem[][] = [];
    let lastLineY = lines[0]?.[0]?.y || 0;
    let lastLineFontSize = lines[0]?.[0]?.fontSize || 12;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.length === 0) continue;
      
      const currentLineY = line[0].y;
      const currentLineFontSize = line[0].fontSize;
      const gap = currentLineY - lastLineY;
      
      // Calculate dynamic threshold based on font size
      // Normal line spacing is typically 1.2-1.5x font size
      // Section breaks are typically 2-3x font size or more
      const normalLineSpacing = Math.max(lastLineFontSize, currentLineFontSize) * 1.5;
      const sectionBreakThreshold = Math.max(lastLineFontSize, currentLineFontSize) * 2.2;
      
      // If gap is significantly larger than normal line spacing, start new section
      if (gap > sectionBreakThreshold && currentSection.length > 0) {
        sections.push(currentSection);
        currentSection = [line];
      } else {
        currentSection.push(line);
      }
      
      lastLineY = currentLineY;
      lastLineFontSize = currentLineFontSize;
    }

    // Add the last section
    if (currentSection.length > 0) {
      sections.push(currentSection);
    }

    return sections;
  };

  // Load PDF when modal opens
  useEffect(() => {
    const loadPdf = async () => {
      if (!file || !isOpen) {
        setIsPdfLoaded(false);
        return;
      }

      try {
        setIsLoading(true);
        setIsPdfLoaded(false);
        const fileUrl = URL.createObjectURL(file);
        const document = await pdfDocumentService.loadDocument(fileUrl);
        const info = pdfDocumentService.getDocumentInfo();
        setTotalPages(info.numPages);
        setCurrentPage(1);
        setIsPdfLoaded(true);
        console.log('PDF loaded successfully, pages:', info.numPages);
      } catch (error) {
        console.error('Failed to load PDF:', error);
        setIsPdfLoaded(false);
      } finally {
        setIsLoading(false);
      }
    };

    loadPdf();
  }, [file, isOpen]);

  // Render page and extract text when page changes or zoom changes
  useEffect(() => {
    console.log('Render effect triggered:', { 
      isDocumentLoaded: pdfDocumentService.isDocumentLoaded(), 
      isPdfLoaded,
      totalPages,
      currentPage,
      zoomLevel
    });
    
    if (!pdfDocumentService.isDocumentLoaded() || !isPdfLoaded || totalPages === 0) {
      console.log('Skipping render: document not loaded or no pages');
      return;
    }

    let isCancelled = false; // Flag to handle component unmounting or effect re-runs

    const renderAndExtract = async () => {
      if (isCancelled) return;
      
      // Add a small delay to ensure DOM is ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (isCancelled) return;
      
      setIsLoading(true);
      
      try {
        console.log('Starting render for page:', currentPage, 'zoom:', zoomLevel);
        
        if (!canvasRef.current) {
          console.error('Canvas ref not available');
          return;
        }
        
        // Get the page first to determine proper dimensions
        const page = await pdfDocumentService.getPage(currentPage);
        if (!page) {
          console.error('Failed to get page');
          return;
        }
        
        // Calculate scale to fit the preview area properly
        const containerWidth = 800; // Fixed width for the preview container
        const containerHeight = 600; // Fixed height for the preview container
        
        // Get the page's default viewport (scale 1.0)
        const defaultViewport = page.getViewport({ scale: 1.0 });
        
        // Calculate scale to fit container while maintaining aspect ratio
        const scaleX = containerWidth / defaultViewport.width;
        const scaleY = containerHeight / defaultViewport.height;
        const baseScale = Math.min(scaleX, scaleY, 1.5); // Cap at 1.5 for performance
        const scale = baseScale * zoomLevel; // Apply zoom
        
        console.log('Calculated scale:', scale, 'base:', baseScale, 'zoom:', zoomLevel, 'from viewport:', defaultViewport.width, 'x', defaultViewport.height);
        
        // Get the scaled viewport
        const viewport = page.getViewport({ scale });
        setPageViewport(viewport); // Store for text positioning
        
        // Create a temporary canvas for rendering
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = viewport.width;
        tempCanvas.height = viewport.height;
        
        const tempContext = tempCanvas.getContext('2d');
        if (!tempContext) {
          console.error('Failed to get temp canvas context');
          return;
        }
        
        // Render the page
        const renderContext = {
          canvasContext: tempContext,
          viewport: viewport,
        };
        
        await page.render(renderContext).promise;
        
        if (isCancelled) {
          console.log('Rendering cancelled after page render');
          return;
        }
        
        // Copy to display canvas - check if canvas is still available
        const displayCanvas = canvasRef.current;
        if (!displayCanvas) {
          console.error('Display canvas ref not available after render');
          return;
        }
        
        displayCanvas.width = tempCanvas.width;
        displayCanvas.height = tempCanvas.height;
        
        const displayContext = displayCanvas.getContext('2d');
        if (!displayContext) {
          console.error('Failed to get display canvas context');
          return;
        }
        
        displayContext.drawImage(tempCanvas, 0, 0);
        
        console.log('Canvas rendered with dimensions:', displayCanvas.width, 'x', displayCanvas.height);
        
        // Extract text content
        console.log('Extracting text content...');
        const textContent = await page.getTextContent();
        console.log('Text content extracted, items count:', textContent.items.length);
        
        if (isCancelled) return;
        
        // Process text items with proper coordinate transformation
        const items = textContent.items.map((item: any) => {
          if (!item.transform || item.transform.length < 6) {
            return null;
          }
          
          // Use the viewport transform to convert PDF coordinates to canvas coordinates
          const tx = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
          
          // Calculate font size from the transform matrix
          const fontSize = Math.sqrt(item.transform[0] * item.transform[0] + item.transform[1] * item.transform[1]);
          
          return {
            str: cleanExtractedText(item.str), // Apply text cleaning here
            x: tx[0],
            y: tx[1],
            width: item.width * scale,
            height: fontSize * scale, // Use fontSize for height
            fontSize: fontSize * scale,
            fontName: item.fontName || 'default'
          };
        }).filter((item): item is TextItem => item !== null);
        
        if (!isCancelled) {
          setTextItems(items);
          // Group items into lines for line-based selection
          const lines = groupTextIntoLines(items);
          setTextLines(lines);
          // Group lines into sections for section-based selection
          const sections = groupLinesIntoSections(lines);
          setTextSections(sections);
          console.log('Text items processed:', items.length, 'Lines:', lines.length, 'Sections:', sections.length);
        }
        
      } catch (error) {
        console.error('Error rendering page or extracting text:', error);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    renderAndExtract();

    // Cleanup function to cancel ongoing rendering when effect re-runs or component unmounts
    return () => {
      isCancelled = true;
    };
  }, [currentPage, isPdfLoaded, totalPages, zoomLevel]);

  // Extract dates from text using intelligent parsing
  const extractDatesFromText = (text: string): ExtractedDate[] => {
    const dates: ExtractedDate[] = [];
    
    // Clean and normalize the text
    const cleanText = text
      .replace(/\s+/g, ' ')
      .trim();

    // Various date patterns to match (ordered by confidence)
    const datePatterns = [
      // Full ISO format: 2023-12-25, 2023/12/25
      { regex: /\b(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/g, format: 'YYYY-MM-DD', confidence: 'high' as const },
      // US format: 12/25/2023, 12-25-2023
      { regex: /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/g, format: 'MM/DD/YYYY', confidence: 'high' as const },
      // European format: 25.12.2023, 25/12/2023
      { regex: /\b(\d{1,2})[\.\/](\d{1,2})[\.\/](\d{4})\b/g, format: 'DD/MM/YYYY', confidence: 'medium' as const },
      // Month name formats: December 25, 2023; 25 December 2023; Dec 25, 2023
      { regex: /\b(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2},?\s+\d{4}\b/gi, format: 'Month DD, YYYY', confidence: 'high' as const },
      { regex: /\b\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{4}\b/gi, format: 'DD Month YYYY', confidence: 'high' as const },
      // Month and year: December 2023, Dec 2023
      { regex: /\b(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{4}\b/gi, format: 'Month YYYY', confidence: 'medium' as const },
      // Year only: 2023 (but be more selective)
      { regex: /\b(19|20)\d{2}\b/g, format: 'YYYY', confidence: 'medium' as const },
      // Short year: 23, 01/23, 12/23
      { regex: /\b(\d{1,2})[\/\-](\d{2})\b/g, format: 'MM/YY', confidence: 'low' as const },
      // Partial dates with just month/day: 12/25, 25.12
      { regex: /\b(\d{1,2})[\/\.](\d{1,2})\b/g, format: 'MM/DD', confidence: 'low' as const },
    ];

    datePatterns.forEach((pattern, index) => {
      let match;
      while ((match = pattern.regex.exec(cleanText)) !== null) {
        const originalText = match[0];
        let actualConfidence = pattern.confidence;
        
        // Enhanced filtering for year-only patterns
        if (pattern.format === 'YYYY') {
          const year = parseInt(originalText);
          const currentYear = new Date().getFullYear();
          
          // Skip if this looks like a non-date number
          const context = cleanText.substring(Math.max(0, match.index - 20), match.index + originalText.length + 20).toLowerCase();
          
          if (
            year < 1900 || year > currentYear + 10 || // Unreasonable year range
            context.includes('page') || context.includes('pp.') || 
            context.includes('vol') || context.includes('issue') ||
            context.includes('chapter') || context.includes('section') ||
            /\b\d+\.\d+\b/.test(context) || // Decimal numbers nearby
            /isbn|issn|doi/i.test(context) // Identifier contexts
          ) {
            continue;
          }
          
          // If it's just a bare year without date context, lower confidence
          if (!/(date|year|publish|copyright|©)/i.test(context)) {
            actualConfidence = 'low';
          }
        }

        // Try to parse and validate the date
        let parsedDate = '';
        
        try {
          let dateToParseDate: Date;
          
          if (pattern.format === 'YYYY') {
            // For year-only, create January 1st of that year
            dateToParseDate = new Date(parseInt(originalText), 0, 1);
            parsedDate = `${originalText}-01-01`;
          } else if (pattern.format === 'Month YYYY') {
            dateToParseDate = new Date(originalText);
            if (!isNaN(dateToParseDate.getTime())) {
              parsedDate = dateToParseDate.toISOString().split('T')[0];
            } else {
              parsedDate = originalText;
              actualConfidence = 'low';
            }
          } else if (pattern.format === 'MM/DD' || pattern.format === 'MM/YY') {
            // For partial dates, assume current year or add 20 prefix for 2-digit years
            const parts = originalText.split(/[\/\.-]/);
            if (pattern.format === 'MM/YY') {
              const year = parseInt(parts[1]) < 50 ? 2000 + parseInt(parts[1]) : 1900 + parseInt(parts[1]);
              dateToParseDate = new Date(year, parseInt(parts[0]) - 1, 1);
              parsedDate = `${year}-${parts[0].padStart(2, '0')}-01`;
            } else {
              const currentYear = new Date().getFullYear();
              dateToParseDate = new Date(currentYear, parseInt(parts[0]) - 1, parseInt(parts[1]));
              parsedDate = `${currentYear}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
            }
            actualConfidence = 'low'; // Always low confidence for partial dates
          } else {
            dateToParseDate = new Date(originalText);
            if (!isNaN(dateToParseDate.getTime()) && dateToParseDate.getFullYear() > 1900 && dateToParseDate.getFullYear() < 2100) {
              parsedDate = dateToParseDate.toISOString().split('T')[0];
            } else {
              parsedDate = originalText;
              actualConfidence = 'low';
            }
          }
        } catch (error) {
          parsedDate = originalText;
          actualConfidence = 'low';
        }

        // Avoid duplicate entries
        const isDuplicate = dates.some(d => 
          d.originalText === originalText || 
          d.parsedDate === parsedDate
        );
        
        if (!isDuplicate) {
          dates.push({
            id: `date-${Date.now()}-${index}-${Math.random()}`,
            originalText,
            parsedDate,
            confidence: actualConfidence,
            format: pattern.format
          });
        }
      }
    });

    // Sort by confidence and limit results
    return dates
      .sort((a, b) => {
        const confidenceOrder = { high: 3, medium: 2, low: 1 };
        return confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
      })
      .slice(0, 5);
  };

  // Handle date extraction for date fields
  const handleDateExtraction = (text: string, fieldKey: string) => {
    const dates = extractDatesFromText(text);
    setExtractedDates(dates);
    
    // Generate warnings for unusual formats
    const warnings: string[] = [];
    
    if (dates.length === 0) {
      warnings.push('No valid dates detected in the selected text.');
    } else {
      const lowConfidenceDates = dates.filter(d => d.confidence === 'low');
      if (lowConfidenceDates.length > 0) {
        warnings.push(`${lowConfidenceDates.length} date(s) have low confidence. Please verify.`);
      }
    }
    
    // Update warnings
    setFieldWarnings(prev => ({
      ...prev,
      [fieldKey]: warnings.length > 0 ? warnings.join(' ') : ''
    }));
    
    // Update the field with the best date found
    if (dates.length > 0) {
      const bestDate = dates.find(d => d.confidence === 'high') || dates[0];
      onFieldUpdate(fieldKey, bestDate.parsedDate);
    }
  };

  // Handle adding a new date manually
  const handleAddDate = () => {
    const newDate: ExtractedDate = {
      id: `date-${Date.now()}-${Math.random()}`,
      originalText: '',
      parsedDate: new Date().toISOString().split('T')[0],
      confidence: 'high',
      format: 'Manual'
    };
    const updatedDates = [...extractedDates, newDate];
    setExtractedDates(updatedDates);
    setEditingDate(newDate.id);
  };

  // Handle editing a date
  const handleEditDate = (dateId: string, newDate: string) => {
    const updatedDates = extractedDates.map(date => 
      date.id === dateId ? { ...date, parsedDate: newDate, originalText: newDate } : date
    );
    setExtractedDates(updatedDates);
    
    // Update the field with the new date
    const dateField = fields.find(f => f.key.toLowerCase().includes('date') || f.key.toLowerCase().includes('publish'));
    if (dateField && updatedDates.length > 0) {
      onFieldUpdate(dateField.key, updatedDates[0].parsedDate);
    }
  };

  // Handle removing a date
  const handleRemoveDate = (dateId: string) => {
    const updatedDates = extractedDates.filter(date => date.id !== dateId);
    setExtractedDates(updatedDates);
    
    // Update the field with the remaining dates
    const dateField = fields.find(f => f.key.toLowerCase().includes('date') || f.key.toLowerCase().includes('publish'));
    if (dateField) {
      const newValue = updatedDates.length > 0 ? updatedDates[0].parsedDate : '';
      onFieldUpdate(dateField.key, newValue);
    }
  };
  const extractAuthorsFromText = (text: string): Author[] => {
    // Clean the text first
    let cleanText = text
      // Remove common prefixes and suffixes
      .replace(/^(authors?:?\s*)/i, '')
      .replace(/\s*(et\s+al\.?|and\s+others?)\s*$/i, '')
      // Remove "and" at the end of the list (e.g., "Smith, Jones, and Brown" -> "Smith, Jones, Brown")
      .replace(/,?\s+and\s*$/i, '')
      // Remove footnote markers and affiliations (numbers, asterisks, superscripts)
      .replace(/[\d\*\†\‡\§\¶\#]+/g, '')
      // Remove common separators that aren't part of names
      .replace(/[\(\)\[\]]/g, '')
      // Fix missing spaces between concatenated names (e.g., "ClarenceAugustine" -> "Clarence Augustine")
      // Look for lowercase followed by uppercase (common when line breaks remove spaces)
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      // Fix cases where multiple capital letters are stuck together inappropriately
      .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim();

    // Split by common author separators, including "and"
    const authorCandidates = cleanText
      .split(/[,;]|\sand\s|\s&\s/)
      .map(author => author.trim())
      .filter(author => author.length > 0);

    const authors: Author[] = [];
    
    authorCandidates.forEach(candidate => {
      // Clean each candidate
      const cleanCandidate = candidate
        // Remove "and" from the beginning of individual names
        .replace(/^and\s+/i, '')
        // Remove leading/trailing punctuation except hyphens in names
        .replace(/^[^\w\u00C0-\u017F\u0100-\u024F\u1E00-\u1EFF-]+|[^\w\u00C0-\u017F\u0100-\u024F\u1E00-\u1EFF-]+$/g, '')
        .trim();

      // Validate if it looks like a name (has at least 2 parts, reasonable length)
      if (cleanCandidate.length >= 3 && 
          cleanCandidate.length <= 60 && 
          /^[\w\u00C0-\u017F\u0100-\u024F\u1E00-\u1EFF\s.-]+$/.test(cleanCandidate) &&
          cleanCandidate.split(/\s+/).length >= 2) {
        
        authors.push({
          id: `author-${Date.now()}-${Math.random()}`,
          name: cleanCandidate
        });
      }
    });

    return authors;
  };

  // Handle author extraction for author fields
  const handleAuthorExtraction = (text: string, fieldKey: string) => {
    const authors = extractAuthorsFromText(text);
    setExtractedAuthors(authors);
    
    // Generate warnings for unusual formats
    const warnings: string[] = [];
    
    if (authors.length === 0) {
      warnings.push('No valid authors detected. Check if names are properly separated.');
    } else {
      // Check if authors seem to be properly comma-separated
      const hasCommas = text.includes(',');
      const hasMultipleWords = authors.some(a => a.name.split(/\s+/).length < 2);
      
      if (!hasCommas && authors.length > 1) {
        warnings.push('Authors may not be properly comma-separated.');
      }
      
      if (hasMultipleWords) {
        warnings.push('Some entries may be incomplete names or affiliations.');
      }
      
      // Check for unusual characters that might indicate formatting issues
      if (text.match(/[0-9\*\†\‡\§\¶\#]{3,}/)) {
        warnings.push('Text contains many numbers/symbols. Verify author extraction.');
      }
    }
    
    // Update warnings
    setFieldWarnings(prev => ({
      ...prev,
      [fieldKey]: warnings.length > 0 ? warnings.join(' ') : ''
    }));
    
    // Update the field with author names
    const authorNames = authors.map(a => a.name).join(', ');
    onFieldUpdate(fieldKey, authorNames);
  };

  // Handle adding a new author manually
  const handleAddAuthor = () => {
    const newAuthor: Author = {
      id: `author-${Date.now()}-${Math.random()}`,
      name: 'New Author'
    };
    const updatedAuthors = [...extractedAuthors, newAuthor];
    setExtractedAuthors(updatedAuthors);
    setEditingAuthor(newAuthor.id);
  };

  // Handle editing an author
  const handleEditAuthor = (authorId: string, newName: string) => {
    const updatedAuthors = extractedAuthors.map(author => 
      author.id === authorId ? { ...author, name: newName } : author
    );
    setExtractedAuthors(updatedAuthors);
    
    // Update the field with the new author list
    const authorField = fields.find(f => f.key.toLowerCase().includes('author'));
    if (authorField) {
      const authorNames = updatedAuthors.map(a => a.name).join(', ');
      onFieldUpdate(authorField.key, authorNames);
    }
  };

  // Handle removing an author
  const handleRemoveAuthor = (authorId: string) => {
    const updatedAuthors = extractedAuthors.filter(author => author.id !== authorId);
    setExtractedAuthors(updatedAuthors);
    
    // Update the field with the new author list
    const authorField = fields.find(f => f.key.toLowerCase().includes('author'));
    if (authorField) {
      const authorNames = updatedAuthors.map(a => a.name).join(', ');
      onFieldUpdate(authorField.key, authorNames);
    }
  };
  const handleTextSelection = () => {
    if (!selectedField) return;

    const selection = window.getSelection();
    const newText = cleanExtractedText(selection?.toString().trim() || '');

    if (newText) {
      const currentField = fields.find(f => f.key === selectedField);
      const existingText = currentField?.value || '';
      
      // Check field type for special handling
      const isAuthorField = selectedField.toLowerCase().includes('author');
      const isDateField = selectedField.toLowerCase().includes('date') || 
                         selectedField.toLowerCase().includes('publish') ||
                         selectedField.toLowerCase().includes('year');
      
      if (isAuthorField) {
        // For author fields, extract and parse authors
        handleAuthorExtraction(newText, selectedField);
      } else if (isDateField) {
        // For date fields, extract and parse dates
        handleDateExtraction(newText, selectedField);
      } else {
        // For regular fields, check if text is already present to avoid doubling
        let updatedText = newText;
        if (existingText && !existingText.includes(newText)) {
          updatedText = `${existingText} ${newText}`;
        } else if (!existingText) {
          updatedText = newText;
        } else {
          // Text already exists, don't add it again
          updatedText = existingText;
        }
        
        onFieldUpdate(selectedField, updatedText);
        
        // Clear any warnings for non-special fields
        setFieldWarnings(prev => ({
          ...prev,
          [selectedField]: ''
        }));
      }
      
      // Add to recent selections
      const newSelection: RecentSelection = {
        id: `${Date.now()}-${Math.random()}`,
        text: newText,
        timestamp: Date.now(),
        fieldKey: selectedField
      };
      
      setRecentSelections(prev => [newSelection, ...prev.slice(0, 9)]); // Keep last 10 selections
      
      selection?.removeAllRanges();
    }
  };

  // Handle line-based selection
  const handleLineClick = (lineIndex: number) => {
    if (!selectedField || lineIndex >= textLines.length) return;

    const line = textLines[lineIndex];
    const lineText = cleanExtractedText(line.map(item => item.str).join(' ').trim());

    if (lineText) {
      const currentField = fields.find(f => f.key === selectedField);
      const existingText = currentField?.value || '';
      
      // Check field type for special handling
      const isAuthorField = selectedField.toLowerCase().includes('author');
      const isDateField = selectedField.toLowerCase().includes('date') || 
                         selectedField.toLowerCase().includes('publish') ||
                         selectedField.toLowerCase().includes('year');
      
      if (isAuthorField) {
        handleAuthorExtraction(lineText, selectedField);
      } else if (isDateField) {
        handleDateExtraction(lineText, selectedField);
      } else {
        // For regular fields, check if text is already present to avoid doubling
        let updatedText = lineText;
        if (existingText && !existingText.includes(lineText)) {
          updatedText = `${existingText} ${lineText}`;
        } else if (!existingText) {
          updatedText = lineText;
        } else {
          // Text already exists, don't add it again
          updatedText = existingText;
        }
        
        onFieldUpdate(selectedField, updatedText);
        
        // Clear any warnings for non-special fields
        setFieldWarnings(prev => ({
          ...prev,
          [selectedField]: ''
        }));
      }
      
      // Add to recent selections
      const newSelection: RecentSelection = {
        id: `${Date.now()}-${Math.random()}`,
        text: lineText,
        timestamp: Date.now(),
        fieldKey: selectedField
      };
      
      setRecentSelections(prev => [newSelection, ...prev.slice(0, 9)]);
    }
  };

  // Handle section-based selection
  const handleSectionClick = (sectionIndex: number) => {
    if (!selectedField || sectionIndex >= textSections.length) return;

    const section = textSections[sectionIndex];
    // Flatten section lines and join with spaces, preserving line breaks
    const sectionText = cleanExtractedText(
      section
        .map(line => line.map(item => item.str).join(' ').trim())
        .filter(lineText => lineText.length > 0)
        .join(' ')
        .trim()
    );

    if (sectionText) {
      const currentField = fields.find(f => f.key === selectedField);
      const existingText = currentField?.value || '';
      
      // Check field type for special handling
      const isAuthorField = selectedField.toLowerCase().includes('author');
      const isDateField = selectedField.toLowerCase().includes('date') || 
                         selectedField.toLowerCase().includes('publish') ||
                         selectedField.toLowerCase().includes('year');
      
      if (isAuthorField) {
        handleAuthorExtraction(sectionText, selectedField);
      } else if (isDateField) {
        handleDateExtraction(sectionText, selectedField);
      } else {
        // For regular fields, check if text is already present to avoid doubling
        let updatedText = sectionText;
        if (existingText && !existingText.includes(sectionText)) {
          updatedText = `${existingText} ${sectionText}`;
        } else if (!existingText) {
          updatedText = sectionText;
        } else {
          // Text already exists, don't add it again
          updatedText = existingText;
        }
        
        onFieldUpdate(selectedField, updatedText);
        
        // Clear any warnings for non-special fields
        setFieldWarnings(prev => ({
          ...prev,
          [selectedField]: ''
        }));
      }
      
      // Add to recent selections
      const newSelection: RecentSelection = {
        id: `${Date.now()}-${Math.random()}`,
        text: sectionText,
        timestamp: Date.now(),
        fieldKey: selectedField
      };
      
      setRecentSelections(prev => [newSelection, ...prev.slice(0, 9)]);
    }
  };

  // Handle adding text from recent selections
  const handleAddRecentSelection = (recentSelection: RecentSelection) => {
    if (!selectedField) return;
    
    const currentField = fields.find(f => f.key === selectedField);
    const existingText = currentField?.value || '';
    const updatedText = existingText ? `${existingText} ${recentSelection.text}` : recentSelection.text;
    
    onFieldUpdate(selectedField, updatedText);
  };

  // Handle resetting a field's value
  const handleResetField = (fieldKey: string) => {
    onFieldUpdate(fieldKey, '');
    
    // Clear extracted data and warnings for this field
    const isAuthorField = fieldKey.toLowerCase().includes('author');
    const isDateField = fieldKey.toLowerCase().includes('date') || 
                       fieldKey.toLowerCase().includes('publish') ||
                       fieldKey.toLowerCase().includes('year');
    
    if (isAuthorField) {
      setExtractedAuthors([]);
    }
    
    if (isDateField) {
      setExtractedDates([]);
    }
    
    setFieldWarnings(prev => ({
      ...prev,
      [fieldKey]: ''
    }));
  };

  // Handle page navigation
  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  // Handle zoom functionality
  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.25, 3)); // Max 3x zoom
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.25, 0.5)); // Min 0.5x zoom
  };

  const handleZoomReset = () => {
    setZoomLevel(1);
  };

  // Handle wheel zoom with Ctrl key
  const handleWheel = useCallback((event: WheelEvent) => {
    if (event.ctrlKey) {
      event.preventDefault();
      const delta = event.deltaY > 0 ? -0.1 : 0.1;
      setZoomLevel(prev => Math.max(0.5, Math.min(3, prev + delta)));
    }
  }, []);

  // Add wheel event listener for zoom
  useEffect(() => {
    const container = pdfContainerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => {
        container.removeEventListener('wheel', handleWheel);
      };
    }
  }, [handleWheel]);

  // Handle modal close
  const handleClose = () => {
    setSelectedField(null);
    setCurrentPage(1);
    onClose();
  };

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        handleClose();
      }
    };

    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscKey);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscKey);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div 
        ref={modalRef}
        className="bg-slate-900 border border-slate-700/50 rounded-2xl w-full max-w-6xl h-[90vh] shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-bold text-slate-100">Extract Text from PDF</h2>
            <div className="text-sm text-slate-400">
              Page {currentPage} of {totalPages}
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition-all duration-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Fields Sidebar */}
          <div className="w-[480px] border-r border-slate-700/50 p-4 overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-200">Fields to Fill</h3>
              <button
                onClick={() => setShowSelectionHistory(!showSelectionHistory)}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  showSelectionHistory 
                    ? 'bg-blue-600/20 text-blue-400' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                }`}
                title="Toggle selection history"
              >
                <Clock className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 space-y-3">
              {fields.map((field) => {
                const isAuthorField = field.key.toLowerCase().includes('author');
                const isDateField = field.key.toLowerCase().includes('date') || 
                                   field.key.toLowerCase().includes('publish') ||
                                   field.key.toLowerCase().includes('year');
                const isSelected = selectedField === field.key;
                const hasWarning = fieldWarnings[field.key];
                const isEditingText = editingTextField === field.key;
                const formattedLabel = formatFieldLabel(field.label);
                
                return (
                  <div
                    key={field.key}
                    onClick={() => setSelectedField(field.key)}
                    className={`p-3 rounded-xl border transition-all duration-200 cursor-pointer group ${
                      isSelected
                        ? 'bg-gradient-to-br from-blue-900/40 to-blue-800/20 border-blue-500/50 shadow-lg shadow-blue-500/10'
                        : 'bg-slate-700/20 border-slate-600/30 hover:border-slate-500/50 hover:bg-slate-700/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <div className={`text-sm font-medium transition-colors ${
                          isSelected ? 'text-blue-200' : 'text-slate-300 group-hover:text-slate-200'
                        }`}>
                          {formattedLabel}
                        </div>
                        {hasWarning && (
                          <div title={hasWarning}>
                            <AlertTriangle className="w-4 h-4 text-amber-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {isSelected && (
                          <div className="flex items-center space-x-1">
                            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                            <Check className="w-4 h-4 text-blue-400" />
                          </div>
                        )}
                        {!isAuthorField && !isDateField && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingTextField(isEditingText ? null : field.key);
                            }}
                            className={`p-1.5 rounded-lg transition-all duration-200 ${
                              isEditingText 
                                ? 'text-blue-400 bg-blue-600/20'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-600/50 opacity-0 group-hover:opacity-100'
                            }`}
                            title={`${isEditingText ? 'Finish' : 'Edit'} ${formattedLabel}`}
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResetField(field.key);
                            setEditingTextField(null);
                          }}
                          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-600/50 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100"
                          title={`Reset ${formattedLabel}`}
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Warning Display */}
                    {hasWarning && (
                      <div className="mb-2 p-2 bg-amber-900/20 border border-amber-600/30 rounded text-xs text-amber-300">
                        {hasWarning}
                      </div>
                    )}

                    {/* Author Tag Display */}
                    {isAuthorField && extractedAuthors.length > 0 ? (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-1">
                          {extractedAuthors.map((author) => (
                            <div
                              key={author.id}
                              className="inline-flex items-center bg-blue-600/20 text-blue-300 px-2 py-1 rounded-md text-xs border border-blue-500/30 group/tag"
                            >
                              {editingAuthor === author.id ? (
                                <input
                                  type="text"
                                  value={author.name}
                                  onChange={(e) => handleEditAuthor(author.id, e.target.value)}
                                  onBlur={() => setEditingAuthor(null)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') setEditingAuthor(null);
                                  }}
                                  className="bg-transparent border-none outline-none text-blue-300 min-w-0 w-full"
                                  autoFocus
                                />
                              ) : (
                                <>
                                  <span 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingAuthor(author.id);
                                    }}
                                    className="cursor-pointer hover:text-blue-200"
                                  >
                                    {author.name}
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveAuthor(author.id);
                                    }}
                                    className="ml-1 text-blue-400 hover:text-red-400 opacity-0 group-hover/tag:opacity-100 transition-opacity"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </>
                              )}
                            </div>
                          ))}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddAuthor();
                            }}
                            className="inline-flex items-center text-slate-400 hover:text-blue-400 px-2 py-1 rounded-md text-xs border border-slate-600/30 hover:border-blue-500/30 transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ) : isDateField && extractedDates.length > 0 ? (
                      /* Date Display */
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-1">
                          {extractedDates.map((date) => (
                            <div
                              key={date.id}
                              className={`inline-flex items-center px-2 py-1 rounded-md text-xs border group/tag ${
                                date.confidence === 'high' 
                                  ? 'bg-green-600/20 text-green-300 border-green-500/30' 
                                  : date.confidence === 'medium'
                                  ? 'bg-yellow-600/20 text-yellow-300 border-yellow-500/30'
                                  : 'bg-red-600/20 text-red-300 border-red-500/30'
                              }`}
                            >
                              <Calendar className="w-3 h-3 mr-1" />
                              {editingDate === date.id ? (
                                <input
                                  type="date"
                                  value={date.parsedDate}
                                  onChange={(e) => handleEditDate(date.id, e.target.value)}
                                  onBlur={() => setEditingDate(null)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') setEditingDate(null);
                                  }}
                                  className="bg-transparent border-none outline-none text-current min-w-0 w-full"
                                  autoFocus
                                />
                              ) : (
                                <>
                                  <span 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingDate(date.id);
                                    }}
                                    className="cursor-pointer hover:opacity-80"
                                    title={`Original: ${date.originalText} (${date.format})`}
                                  >
                                    {date.parsedDate}
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveDate(date.id);
                                    }}
                                    className="ml-1 hover:text-red-400 opacity-0 group-hover/tag:opacity-100 transition-opacity"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </>
                              )}
                            </div>
                          ))}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddDate();
                            }}
                            className="inline-flex items-center text-slate-400 hover:text-green-400 px-2 py-1 rounded-md text-xs border border-slate-600/30 hover:border-green-500/30 transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ) : !isAuthorField && !isDateField ? (
                      /* Regular field display */
                      <div>
                        {isEditingText ? (
                          <textarea
                            value={typeof field.value === 'string' ? field.value : JSON.stringify(field.value) || ''}
                            onChange={(e) => onFieldUpdate(field.key, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onBlur={() => setEditingTextField(null)}
                            className="w-full bg-slate-800/60 border border-blue-500/50 rounded-lg p-2 text-sm text-slate-200 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all duration-200 resize-none"
                            rows={3}
                            placeholder="Type here..."
                            autoFocus
                          />
                        ) : (
                          <div className={`text-xs transition-colors ${
                            isSelected ? 'text-slate-300' : 'text-slate-400'
                          }`}>
                            {field.value ? (
                              <div className="truncate">
                                {typeof field.value === 'string' ? field.value.split('\n')[0] : JSON.stringify(field.value)}
                              </div>
                            ) : (
                              <div className="italic">
                                {isSelected ? "Select text or click pencil to edit..." : "Empty"}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Special field placeholders */
                      <div className={`text-xs italic transition-colors ${
                        isSelected ? 'text-slate-300' : 'text-slate-400'
                      }`}>
                        {isSelected ? 
                          (isAuthorField ? "Select author text to extract..." : "Select date text to extract...") : 
                          (isAuthorField ? "No authors extracted" : "No dates extracted")
                        }
                      </div>
                    )}

                    {/* Hidden textarea for editing when field is selected */}
                    {isSelected && !isAuthorField && !isDateField && !isEditingText && (
                      <textarea
                        value={typeof field.value === 'string' ? field.value : JSON.stringify(field.value) || ''}
                        onChange={(e) => onFieldUpdate(field.key, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full mt-2 bg-slate-800/60 border border-blue-500/50 rounded-lg p-2 text-sm text-slate-200 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all duration-200 resize-none"
                        rows={3}
                        placeholder="Select text or type here..."
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Selection History at Bottom */}
            {showSelectionHistory && recentSelections.length > 0 && (
              <div className="mt-4 p-3 bg-slate-800/40 border border-slate-600/30 rounded-lg">
                <h4 className="text-sm font-medium text-slate-300 mb-3">Recent Selections</h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {recentSelections.map((selection) => (
                    <button
                      key={selection.id}
                      onClick={() => handleAddRecentSelection(selection)}
                      disabled={!selectedField}
                      className="w-full text-left p-2 text-xs text-slate-400 bg-slate-700/30 hover:bg-slate-600/40 rounded border border-slate-600/20 hover:border-slate-500/40 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                      <div className="flex items-center space-x-2">
                        <Plus className="w-3 h-3 text-slate-500 group-hover:text-blue-400 transition-colors" />
                        <span className="truncate group-hover:text-slate-300 transition-colors">
                          {selection.text}
                        </span>
                      </div>
                      {selection.fieldKey && (
                        <div className="text-xs text-slate-500 mt-1">
                          From: {fields.find(f => f.key === selection.fieldKey)?.label}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* PDF Viewer */}
          <div className="flex-1 flex flex-col">
            
            {/* Page Navigation */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
              <div className="flex items-center space-x-2">
                <button
                  onClick={goToPreviousPage}
                  disabled={currentPage <= 1}
                  className="flex items-center space-x-2 px-3 py-2 bg-slate-700 text-slate-300 rounded hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>

                <button
                  onClick={goToNextPage}
                  disabled={currentPage >= totalPages}
                  className="flex items-center space-x-2 px-3 py-2 bg-slate-700 text-slate-300 rounded hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center space-x-4">
                <div className="text-slate-300 font-medium">
                  Page {currentPage} of {totalPages}
                </div>
                
                {/* Selection Mode Toggle */}
                <div className="flex items-center space-x-2 bg-slate-800/50 rounded-lg p-1">
                  <button
                    onClick={() => setSelectionMode('sections')}
                    className={`px-3 py-1 text-xs font-medium rounded transition-all duration-200 ${
                      selectionMode === 'sections'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Click entire sections to select"
                  >
                    Sections
                  </button>
                  <button
                    onClick={() => setSelectionMode('lines')}
                    className={`px-3 py-1 text-xs font-medium rounded transition-all duration-200 ${
                      selectionMode === 'lines'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Click entire lines to select"
                  >
                    Lines
                  </button>
                  <button
                    onClick={() => setSelectionMode('selection')}
                    className={`px-3 py-1 text-xs font-medium rounded transition-all duration-200 ${
                      selectionMode === 'selection'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Select text by dragging"
                  >
                    Selection
                  </button>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleZoomOut}
                  disabled={zoomLevel <= 0.5}
                  className="p-2 bg-slate-700 text-slate-300 rounded hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Zoom out (Ctrl+Scroll)"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                
                <button
                  onClick={handleZoomReset}
                  className="px-3 py-2 bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition-colors text-sm font-medium min-w-[60px]"
                  title="Reset zoom"
                >
                  {Math.round(zoomLevel * 100)}%
                </button>
                
                <button
                  onClick={handleZoomIn}
                  disabled={zoomLevel >= 3}
                  className="p-2 bg-slate-700 text-slate-300 rounded hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Zoom in (Ctrl+Scroll)"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* PDF Content */}
            <div 
              ref={pdfContainerRef}
              className="flex-1 overflow-auto p-4 bg-gradient-to-br from-gray-50 to-gray-100"
              style={{ cursor: 'grab' }}
            >
              <div className="flex justify-center">
                <div 
                  className="relative inline-block bg-white shadow-xl border border-gray-200 rounded-lg overflow-hidden"
                >
                  {selectedField && (
                    <div className="absolute top-0 left-0 right-0 z-10 bg-blue-600/90 text-white px-3 py-1 text-xs font-medium">
                      Selecting for: {formatFieldLabel(fields.find(f => f.key === selectedField)?.label || '')}
                      <span className="ml-2 text-blue-200">
                        ({selectionMode === 'sections' ? 'Click sections' : selectionMode === 'lines' ? 'Click lines' : 'Drag to select'})
                      </span>
                    </div>
                  )}
                  
                  <canvas 
                    ref={canvasRef} 
                    className="block"
                    style={{ 
                      cursor: selectedField ? (selectionMode === 'sections' || selectionMode === 'lines' ? 'pointer' : 'crosshair') : 'default',
                      display: 'block',
                      maxWidth: '100%',
                      height: 'auto',
                      opacity: isLoading ? 0.5 : 1,
                      transition: 'opacity 0.2s, transform 0.2s',
                      transform: `scale(${zoomLevel}) ${selectedField ? 'scale(1.02)' : 'scale(1)'}`,
                      transformOrigin: 'center top',
                      marginTop: selectedField ? '24px' : '0'
                    }}
                  />
                  
                  {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm">
                      <div className="flex flex-col items-center space-y-3">
                        <div className="relative">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                          <div className="absolute inset-0 animate-ping rounded-full h-8 w-8 border-b-2 border-blue-300 opacity-30"></div>
                        </div>
                        <span className="text-slate-600 text-sm font-medium">Loading page {currentPage}...</span>
                      </div>
                    </div>
                  )}

                  {/* Zoom hint */}
                  {!isLoading && !selectedField && (
                    <div className="absolute bottom-4 right-4 bg-black/60 text-white px-3 py-1 rounded text-xs backdrop-blur-sm">
                      Ctrl + Scroll to zoom
                    </div>
                  )}
                  
                  {/* Text overlay for selection */}
                  {selectedField && pageViewport && !isLoading && (
                    <div 
                      ref={overlayRef}
                      className="absolute inset-0"
                      style={{ 
                        pointerEvents: 'auto',
                        userSelect: selectionMode === 'selection' ? 'text' : 'none',
                        background: 'linear-gradient(45deg, rgba(59, 130, 246, 0.03) 0%, rgba(147, 51, 234, 0.03) 100%)',
                        marginTop: selectedField ? '24px' : '0',
                        transform: `scale(${zoomLevel})`,
                        transformOrigin: 'top left'
                      }}
                      onMouseUp={selectionMode === 'selection' ? handleTextSelection : undefined}
                    >
                      {selectionMode === 'sections' ? (
                        textSections.map((section, sectionIndex) => (
                          <div
                            key={`section-${sectionIndex}`}
                            className={`absolute border-2 border-blue-500 bg-blue-500 bg-opacity-20 rounded cursor-pointer transition-opacity duration-200 ${
                              hoveredSection === sectionIndex ? 'opacity-100' : 'opacity-50'
                            }`}
                            style={{
                              left: `${Math.min(...section.flatMap(line => line.map(item => item.x)))}px`,
                              top: `${Math.min(...section.flatMap(line => line.map(item => item.y - (item.fontSize * 0.8))))}px`,
                              width: `${Math.max(...section.flatMap(line => line.map(item => item.x + item.width))) - Math.min(...section.flatMap(line => line.map(item => item.x)))}px`,
                              height: `${Math.max(...section.flatMap(line => line.map(item => item.y))) - Math.min(...section.flatMap(line => line.map(item => item.y - (item.fontSize * 0.8))))}px`,
                            }}
                            onMouseEnter={() => setHoveredSection(sectionIndex)}
                            onMouseLeave={() => setHoveredSection(null)}
                            onClick={() => handleSectionClick(sectionIndex)}
                          />
                        ))
                      ) : selectionMode === 'lines' ? (
                        textLines.map((line, lineIndex) => (
                          <div
                            key={`line-${lineIndex}`}
                            className={`absolute border border-green-500 bg-green-500 bg-opacity-15 rounded cursor-pointer transition-all duration-200 ${
                              hoveredLine === lineIndex ? 'opacity-100 border-2 bg-opacity-25' : 'opacity-0 hover:opacity-60'
                            }`}
                            style={{
                              left: `${Math.min(...line.map(item => item.x))}px`,
                              top: `${Math.min(...line.map(item => item.y - (item.fontSize * 0.8)))}px`,
                              width: `${Math.max(...line.map(item => item.x + item.width)) - Math.min(...line.map(item => item.x))}px`,
                              height: `${Math.max(...line.map(item => item.y)) - Math.min(...line.map(item => item.y - (item.fontSize * 0.8)))}px`,
                            }}
                            onMouseEnter={() => setHoveredLine(lineIndex)}
                            onMouseLeave={() => setHoveredLine(null)}
                            onClick={() => handleLineClick(lineIndex)}
                            title={line.map(item => item.str).join(' ')}
                          />
                        ))
                      ) : (
                        /* Traditional text selection overlay */
                        textItems.map((item, index) => (
                          <div
                            key={index}
                            style={{
                              position: 'absolute',
                              left: `${item.x}px`,
                              top: `${item.y - item.fontSize * 0.8}px`,
                              width: `${item.width}px`,
                              height: `${item.fontSize}px`,
                              fontSize: `${item.fontSize}px`,
                              lineHeight: `${item.fontSize}px`,
                              color: 'transparent',
                              background: 'linear-gradient(90deg, rgba(255, 235, 59, 0.15) 0%, rgba(255, 193, 7, 0.1) 100%)',
                              cursor: 'text',
                              border: '1px solid rgba(255, 193, 7, 0.2)',
                              borderRadius: '2px',
                              whiteSpace: 'nowrap',
                              overflow: 'visible',
                              transition: 'all 0.15s ease',
                              WebkitUserSelect: 'text',
                              MozUserSelect: 'text',
                              msUserSelect: 'text',
                              userSelect: 'text',
                            }}
                            className="hover:shadow-sm hover:bg-opacity-25"
                            title={item.str}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'linear-gradient(90deg, rgba(255, 235, 59, 0.25) 0%, rgba(255, 193, 7, 0.2) 100%)';
                              e.currentTarget.style.borderColor = 'rgba(255, 193, 7, 0.4)';
                              e.currentTarget.style.transform = 'scale(1.02)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'linear-gradient(90deg, rgba(255, 235, 59, 0.15) 0%, rgba(255, 193, 7, 0.1) 100%)';
                              e.currentTarget.style.borderColor = 'rgba(255, 193, 7, 0.2)';
                              e.currentTarget.style.transform = 'scale(1)';
                            }}
                          >
                            <span style={{ 
                              color: 'transparent',
                              position: 'absolute',
                              left: 0,
                              top: 0,
                              WebkitUserSelect: 'text',
                              MozUserSelect: 'text',
                              msUserSelect: 'text',
                              userSelect: 'text',
                            }}>
                              {item.str}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-slate-700/50">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-slate-400 hover:text-slate-200 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default PdfTextExtractionModal;
