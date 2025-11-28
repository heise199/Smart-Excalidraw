'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useMemo, useRef } from 'react';
import '@excalidraw/excalidraw/index.css';

// Dynamically import Excalidraw with no SSR
const Excalidraw = dynamic(
  async () => (await import('@excalidraw/excalidraw')).Excalidraw,
  { ssr: false }
);

// Dynamically import convertToExcalidrawElements
const getConvertFunction = async () => {
  const excalidrawModule = await import('@excalidraw/excalidraw');
  return excalidrawModule.convertToExcalidrawElements;
};

export default function ExcalidrawCanvas({ elements = [] }) {
  const [convertToExcalidrawElements, setConvertFunction] = useState(null);
  const [excalidrawAPI, setExcalidrawAPI] = useState(null);
  const isMountedRef = useRef(false);
  const initialElementsRef = useRef(null);

  // Track mount status using ref (doesn't trigger re-renders)
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Load convert function on mount
  useEffect(() => {
    getConvertFunction().then(fn => {
      setConvertFunction(() => fn);
    });
  }, []);

  // Convert custom format to ExcalidrawElementSkeleton format
  const convertToSkeletonFormat = (element, allElements) => {
    const converted = { ...element };
    
    // Convert color properties
    if (converted.fill) {
      converted.backgroundColor = converted.fill;
      delete converted.fill;
    }
    if (converted.stroke) {
      converted.strokeColor = converted.stroke;
      delete converted.stroke;
    }
    
    // Handle shapes (rectangle, ellipse, diamond) with text (convert to label)
    // All shape types support label property for displaying text
    if ((converted.type === 'rectangle' || converted.type === 'ellipse' || converted.type === 'diamond') && converted.text) {
      // Determine text color: prefer textColor or labelColor, then use strokeColor, default to black
      const textColor = converted.textColor || converted.labelColor || converted.strokeColor || '#000000';
      converted.label = {
        text: converted.text,
        fontSize: converted.fontSize || 16,
        strokeColor: textColor,
        textAlign: converted.textAlign || 'center',
        verticalAlign: converted.verticalAlign || 'middle'
      };
      delete converted.text;
      delete converted.fontSize;
      delete converted.textAlign;
      delete converted.verticalAlign;
      delete converted.textColor;
      delete converted.labelColor;
    }
    
    // Handle arrow with x1, y1, x2, y2 (convert to x, y, width, height)
    if (converted.type === 'arrow' && converted.x1 !== undefined && converted.y1 !== undefined) {
      const x1 = converted.x1;
      const y1 = converted.y1;
      const x2 = converted.x2 || x1;
      const y2 = converted.y2 || y1;
      
      // Try to find start and end elements by position
      // Check if arrow endpoints are near element edges (all four edges) or inside elements
      let startElement = null;
      let endElement = null;
      let startDistance = Infinity;
      let endDistance = Infinity;
      
      // Tolerance for matching (in pixels)
      const tolerance = 200; // Increased tolerance to catch more cases
      
      if (allElements) {
        for (const el of allElements) {
          // Skip if this is the arrow element itself
          if (el.id === converted.id || el.type === 'arrow' || el.type === 'line') {
            continue;
          }
          
          if ((el.type === 'rectangle' || el.type === 'ellipse' || el.type === 'diamond') && el.id) {
            const elLeft = el.x;
            const elRight = el.x + (el.width || 0);
            const elTop = el.y;
            const elBottom = el.y + (el.height || 0);
            const elCenterX = el.x + (el.width || 0) / 2;
            const elCenterY = el.y + (el.height || 0) / 2;
            
            // Check if start point is inside the element (with some margin)
            const isStartInside = x1 >= elLeft - tolerance && x1 <= elRight + tolerance &&
                                 y1 >= elTop - tolerance && y1 <= elBottom + tolerance;
            
            // Check if end point is inside the element (with some margin)
            const isEndInside = x2 >= elLeft - tolerance && x2 <= elRight + tolerance &&
                               y2 >= elTop - tolerance && y2 <= elBottom + tolerance;
            
            // Calculate distances to all four edges for start point
            const leftEdgeX = elLeft;
            const leftEdgeY = elCenterY;
            const distToLeft = Math.sqrt(Math.pow(x1 - leftEdgeX, 2) + Math.pow(y1 - leftEdgeY, 2));
            
            const rightEdgeX = elRight;
            const rightEdgeY = elCenterY;
            const distToRight = Math.sqrt(Math.pow(x1 - rightEdgeX, 2) + Math.pow(y1 - rightEdgeY, 2));
            
            const topEdgeX = elCenterX;
            const topEdgeY = elTop;
            const distToTop = Math.sqrt(Math.pow(x1 - topEdgeX, 2) + Math.pow(y1 - topEdgeY, 2));
            
            const bottomEdgeX = elCenterX;
            const bottomEdgeY = elBottom;
            const distToBottom = Math.sqrt(Math.pow(x1 - bottomEdgeX, 2) + Math.pow(y1 - bottomEdgeY, 2));
            
            // Find the closest edge for start point
            const minStartDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);
            // If point is inside or very close to an edge, consider it a match
            const startMatchDist = isStartInside ? 0 : minStartDist;
            if (startMatchDist < tolerance && startMatchDist < startDistance) {
              startElement = el;
              startDistance = startMatchDist;
            }
            
            // Calculate distances to all four edges for end point
            const distToLeftEnd = Math.sqrt(Math.pow(x2 - leftEdgeX, 2) + Math.pow(y2 - leftEdgeY, 2));
            const distToRightEnd = Math.sqrt(Math.pow(x2 - rightEdgeX, 2) + Math.pow(y2 - rightEdgeY, 2));
            const distToTopEnd = Math.sqrt(Math.pow(x2 - topEdgeX, 2) + Math.pow(y2 - topEdgeY, 2));
            const distToBottomEnd = Math.sqrt(Math.pow(x2 - bottomEdgeX, 2) + Math.pow(y2 - bottomEdgeY, 2));
            
            // Find the closest edge for end point
            const minEndDist = Math.min(distToLeftEnd, distToRightEnd, distToTopEnd, distToBottomEnd);
            // If point is inside or very close to an edge, consider it a match
            const endMatchDist = isEndInside ? 0 : minEndDist;
            if (endMatchDist < tolerance && endMatchDist < endDistance) {
              endElement = el;
              endDistance = endMatchDist;
            }
          }
        }
      }
      
      // If arrow has start/end element IDs, use binding (highest priority)
      if (converted.startId) {
        converted.start = { id: converted.startId };
        delete converted.startId;
      } else if (startElement && startElement.id) {
        converted.start = { id: startElement.id };
      }
      
      if (converted.endId) {
        converted.end = { id: converted.endId };
        delete converted.endId;
      } else if (endElement && endElement.id) {
        converted.end = { id: endElement.id };
      }
      
      // Set arrow position and size
      // Calculate width and height first (normalized: relative to start point)
      let width = x2 - x1;
      let height = y2 - y1;
      
      // Ensure minimum dimensions to avoid normalization errors
      const minDimension = 1; // Minimum 1 pixel (smaller than before to allow more flexibility)
      if (Math.abs(width) < minDimension && Math.abs(height) < minDimension) {
        // If both are too small, make it a small diagonal arrow
        width = width >= 0 ? minDimension : -minDimension;
        height = height >= 0 ? minDimension : -minDimension;
      } else if (Math.abs(width) < minDimension) {
        // Only width is too small, keep height but adjust width
        width = width >= 0 ? minDimension : -minDimension;
      } else if (Math.abs(height) < minDimension) {
        // Only height is too small, keep width but adjust height
        height = height >= 0 ? minDimension : -minDimension;
      }
      
      // Normalize arrow coordinates
      // In Excalidraw, arrows must be normalized: start at (x, y), end at (x + width, y + height)
      // When arrows have bindings, Excalidraw will automatically adjust, but we still need valid initial coordinates
      
      // Ensure width and height are valid before setting coordinates
      if (isNaN(width) || !isFinite(width)) width = 100;
      if (isNaN(height) || !isFinite(height)) height = 0;
      if (isNaN(x1) || !isFinite(x1)) x1 = 0;
      if (isNaN(y1) || !isFinite(y1)) y1 = 0;
      if (isNaN(x2) || !isFinite(x2)) x2 = x1 + width;
      if (isNaN(y2) || !isFinite(y2)) y2 = y1 + height;
      
      if (converted.start && converted.end) {
        // Both bound - Excalidraw will calculate position automatically
        // Use start point as base, with direction towards end
        // The actual connection points will be calculated by Excalidraw
        // Recalculate width/height based on actual points
        width = x2 - x1;
        height = y2 - y1;
        converted.x = x1;
        converted.y = y1;
        converted.width = width;
        converted.height = height;
      } else if (converted.start) {
        // Start is bound, end is free
        // Position at the free end, with negative dimensions pointing back to bound start
        // This tells Excalidraw that start is bound and end is at (x, y)
        converted.x = x2;
        converted.y = y2;
        converted.width = -(x2 - x1);
        converted.height = -(y2 - y1);
      } else if (converted.end) {
        // End is bound, start is free
        // Position at start point, pointing towards bound end
        converted.x = x1;
        converted.y = y1;
        converted.width = x2 - x1;
        converted.height = y2 - y1;
      } else {
        // No binding - simple normalized coordinates
        converted.x = x1;
        converted.y = y1;
        converted.width = width;
        converted.height = height;
      }
      
      // Final validation: ensure all values are valid numbers
      if (isNaN(converted.width) || !isFinite(converted.width)) {
        console.warn('ExcalidrawCanvas: Arrow has invalid width, using default', converted);
        converted.width = 100;
      }
      if (isNaN(converted.height) || !isFinite(converted.height)) {
        console.warn('ExcalidrawCanvas: Arrow has invalid height, using default', converted);
        converted.height = 0;
      }
      if (!isFinite(converted.x) || isNaN(converted.x)) {
        console.warn('ExcalidrawCanvas: Arrow has invalid x, using default', converted);
        converted.x = 0;
      }
      if (!isFinite(converted.y) || isNaN(converted.y)) {
        console.warn('ExcalidrawCanvas: Arrow has invalid y, using default', converted);
        converted.y = 0;
      }
      
      // Ensure arrow is not a point (both dimensions zero or too small)
      if (Math.abs(converted.width) < 0.1 && Math.abs(converted.height) < 0.1) {
        console.warn('ExcalidrawCanvas: Arrow has zero dimensions, adjusting', converted);
        if (Math.abs(converted.width) < 0.1) {
          converted.width = converted.width >= 0 ? 1 : -1;
        }
        if (Math.abs(converted.height) < 0.1) {
          converted.height = converted.height >= 0 ? 1 : -1;
        }
      }
      
      delete converted.x1;
      delete converted.y1;
      delete converted.x2;
      delete converted.y2;
      
      // Convert head to endArrowhead
      if (converted.head) {
        converted.endArrowhead = converted.head === 'arrow' ? 'arrow' : null;
        delete converted.head;
      } else {
        converted.endArrowhead = 'arrow'; // Default arrow head
      }
    }
    
    // Handle text element
    if (converted.type === 'text') {
      // Ensure text property exists and is a valid string
      if (!converted.text || typeof converted.text !== 'string') {
        // If text is missing or invalid, use a default or skip this element
        console.warn('ExcalidrawCanvas: Text element missing or invalid text property:', converted);
        converted.text = converted.text || ''; // Set to empty string as fallback
      }
      if (converted.fill) {
        converted.strokeColor = converted.fill;
        delete converted.fill;
      }
      // fontSize is valid for text elements
    }
    
    return converted;
  };

  // Convert elements to Excalidraw format
  const convertedElements = useMemo(() => {
    console.log('ExcalidrawCanvas: Received elements:', elements?.length || 0, elements);
    console.log('ExcalidrawCanvas: convertToExcalidrawElements available:', !!convertToExcalidrawElements);
    
    // Ensure elements is an array
    const safeElements = Array.isArray(elements) ? elements : [];
    
    if (!safeElements || safeElements.length === 0) {
      console.log('ExcalidrawCanvas: No elements to render');
      return [];
    }
    
    if (!convertToExcalidrawElements) {
      console.log('ExcalidrawCanvas: convertToExcalidrawElements not loaded yet');
      return [];
    }

    try {
      // Filter out unsupported element types before conversion
      // Valid types: rectangle, ellipse, diamond, text, line, arrow
      const validTypes = new Set(['rectangle', 'ellipse', 'diamond', 'text', 'line', 'arrow']);
      const filteredElements = safeElements.filter((element) => {
        // More strict validation
        if (!element || typeof element !== 'object' || Array.isArray(element)) {
          console.warn('ExcalidrawCanvas: Invalid element (not an object):', element);
          return false;
        }
        // Check if element has a type property
        if (!('type' in element)) {
          console.warn('ExcalidrawCanvas: Element missing type property:', element);
          return false;
        }
        const elementType = element.type;
        if (!elementType || typeof elementType !== 'string' || !validTypes.has(elementType)) {
          console.warn(`ExcalidrawCanvas: Skipping unsupported element type: ${elementType}`, element);
          return false;
        }
        // Special validation for text elements: must have valid text property
        if (elementType === 'text') {
          if (!('text' in element) || element.text === null || element.text === undefined) {
            console.warn('ExcalidrawCanvas: Text element missing or invalid text property:', element);
            return false; // Skip invalid text elements
          }
          // Ensure text is a string (convert if needed)
          if (typeof element.text !== 'string') {
            console.warn('ExcalidrawCanvas: Text element text property is not a string, converting:', element);
            element.text = String(element.text || '');
          }
        }
        return true;
      });

      console.log('ExcalidrawCanvas: Filtered elements:', filteredElements.length, 'out of', elements.length);

      if (filteredElements.length === 0) {
        console.warn('ExcalidrawCanvas: No valid elements after filtering. Original elements:', elements);
        return [];
      }

      // Convert custom format to Skeleton format
      // Pass all elements to conversion function so arrows can find their bindings
      const skeletonElements = filteredElements
        .map(el => convertToSkeletonFormat(el, filteredElements))
        .filter(el => {
          if (!el || el == null) {
            return false;
          }
          
          // Final validation: ensure text elements have valid text
          if (el.type === 'text') {
            if (!el.text || typeof el.text !== 'string') {
              console.warn('ExcalidrawCanvas: Filtering out text element with invalid text:', el);
              return false;
            }
          }
          
          // Final validation: ensure arrow/line elements have valid coordinates
          if (el.type === 'arrow' || el.type === 'line') {
            if (el.x === undefined || el.y === undefined || 
                el.width === undefined || el.height === undefined ||
                !isFinite(el.x) || !isFinite(el.y) ||
                !isFinite(el.width) || !isFinite(el.height)) {
              console.warn('ExcalidrawCanvas: Filtering out arrow/line element with invalid coordinates:', el);
              return false;
            }
            // Ensure width and height are not both zero (or too small)
            if (Math.abs(el.width) < 0.1 && Math.abs(el.height) < 0.1) {
              console.warn('ExcalidrawCanvas: Filtering out arrow/line element with zero dimensions:', el);
              return false;
            }
          }
          
          return true;
        });
      console.log('ExcalidrawCanvas: Converted to skeleton format:', skeletonElements);

      // Convert to Excalidraw elements
      const converted = convertToExcalidrawElements(skeletonElements);
      console.log('ExcalidrawCanvas: Converted elements:', converted.length);
      
      // Ensure all converted elements are valid (not undefined or null)
      const validConverted = converted.filter(el => el != null && typeof el === 'object');
      if (validConverted.length !== converted.length) {
        console.warn('ExcalidrawCanvas: Some converted elements were invalid, filtered out', 
          converted.length - validConverted.length, 'invalid elements');
      }
      
      return validConverted;
    } catch (error) {
      console.error('ExcalidrawCanvas: Failed to convert elements:', error);
      console.error('ExcalidrawCanvas: Error details:', error.stack);
      console.error('ExcalidrawCanvas: Elements that caused error:', elements);
      return [];
    }
  }, [elements, convertToExcalidrawElements]);

  // Update scene when elements change (after initial mount)
  useEffect(() => {
    if (isMountedRef.current && excalidrawAPI && convertedElements.length > 0) {
      console.log('ExcalidrawCanvas: Updating scene with', convertedElements.length, 'elements');
      // Use updateScene to update the canvas with new elements
      try {
        excalidrawAPI.updateScene({
          elements: convertedElements,
        });
        
        // Then scroll to content
        setTimeout(() => {
          if (isMountedRef.current && excalidrawAPI) {
            console.log('ExcalidrawCanvas: Scrolling to content');
            try {
              excalidrawAPI.scrollToContent(convertedElements, {
                fitToContent: true,
                animate: true,
                duration: 300,
              });
            } catch (error) {
              console.error('ExcalidrawCanvas: Error scrolling to content:', error);
            }
          }
        }, 100);
      } catch (error) {
        console.error('ExcalidrawCanvas: Error updating scene:', error);
      }
    }
  }, [excalidrawAPI, convertedElements]);

  // Handle initial elements when API is first set
  useEffect(() => {
    if (isMountedRef.current && excalidrawAPI && initialElementsRef.current) {
      const initialElements = initialElementsRef.current;
      initialElementsRef.current = null; // Clear after use
      
      console.log('ExcalidrawCanvas: Initial update with', initialElements.length, 'elements');
      setTimeout(() => {
        if (isMountedRef.current && excalidrawAPI) {
          try {
            excalidrawAPI.updateScene({
              elements: initialElements,
            });
            excalidrawAPI.scrollToContent(initialElements, {
              fitToContent: true,
              animate: false,
            });
          } catch (error) {
            console.error('ExcalidrawCanvas: Error in initial update:', error);
          }
        }
      }, 50);
    }
  }, [excalidrawAPI]);

  // Generate unique key when elements change to force remount (only for initial mount)
  const canvasKey = useMemo(() => {
    // Use a stable key to avoid unnecessary remounts
    // The key will change when elements go from empty to non-empty or vice versa
    if (convertedElements.length === 0) return 'empty';
    return 'canvas';
  }, [convertedElements.length]);

  // Debug: Log when convertedElements changes
  useEffect(() => {
    console.log('ExcalidrawCanvas: convertedElements changed:', convertedElements.length);
    if (convertedElements.length > 0) {
      console.log('ExcalidrawCanvas: First element:', convertedElements[0]);
    }
  }, [convertedElements]);

  return (
    <div className="w-full h-full" style={{ position: 'relative' }}>
      <Excalidraw
        key={canvasKey}
        excalidrawAPI={(api) => {
          console.log('ExcalidrawCanvas: API received:', !!api);
          if (api) {
            setExcalidrawAPI(api);
            // Store initial elements if we have them, will be handled in useEffect
            if (convertedElements.length > 0) {
              initialElementsRef.current = convertedElements;
            }
          }
        }}
        initialData={{
          elements: (convertedElements && convertedElements.length > 0) ? convertedElements : [],
          appState: {
            viewBackgroundColor: '#ffffff',
            currentItemFontFamily: 1,
          },
          scrollToContent: (convertedElements && convertedElements.length > 0),
        }}
        onChange={(elements, appState, files) => {
          // Optional: Log changes for debugging
          if (elements.length !== convertedElements.length) {
            console.log('ExcalidrawCanvas: Elements changed in Excalidraw:', elements.length, 'vs', convertedElements.length);
          }
        }}
      />
    </div>
  );
}

