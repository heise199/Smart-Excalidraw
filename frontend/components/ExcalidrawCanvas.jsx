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

export default function ExcalidrawCanvas({ elements = [], onElementsChange }) {
  const [convertToExcalidrawElements, setConvertFunction] = useState(null);
  const [excalidrawAPI, setExcalidrawAPI] = useState(null);
  const [libraryItems, setLibraryItems] = useState([]); // 存储加载的库项
  const isMountedRef = useRef(false);
  const initialElementsRef = useRef(null);
  const lastSyncedElementsRef = useRef(null); // 用于避免循环更新
  const isUpdatingFromPropsRef = useRef(false); // 标记是否正在从 props 更新
  const lastSyncedCustomElementsRef = useRef(null); // 用于跟踪上次同步的自定义格式元素
  const elementsIdMapRef = useRef(new Map()); // 用于跟踪元素ID，防止重复
  const lastHistoryStateRef = useRef(null); // 用于跟踪历史状态，检测撤销/重做
  const librariesLoadedRef = useRef(false); // 用于跟踪库项是否已加载，避免重复加载
  const libraryItemsUpdatedRef = useRef(null); // 用于跟踪已更新的库项 ID 列表，避免重复添加

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

  // 库文件分类映射（按优先级顺序检查，使用精确匹配）
  const getLibraryCategory = (fileName) => {
    const name = fileName.toLowerCase().trim();
    
    // 架构相关（优先检查，因为可能包含其他关键词）
    if (name.includes('architecture') || name.includes('system-design') || name.includes('aws-architecture')) {
      return '架构设计';
    }
    
    // 数据相关（精确匹配）
    if (name.includes('data-science') || name.includes('data-viz') || 
        (name.startsWith('data') && !name.includes('database'))) {
      return '数据科学';
    }
    
    // 开发运维（精确匹配）
    if (name.includes('dev_ops') || name.includes('dev-ops') || name.includes('devops') || 
        (name.includes('dev') && name.includes('ops')) || name === 'cloud' || name.includes('cloud')) {
      return '开发运维';
    }
    
    // UI/设计
    if (name.includes('logo') || name.includes('hearts') || 
        name.includes('stick-figure') || name.includes('stick-figures') || name.includes('stickfigure')) {
      return 'UI/设计';
    }
    
    // 电路/硬件
    if (name.includes('circuit')) {
      return '电路/硬件';
    }
    
    // 其他
    return '其他';
  };

  // 自动加载 libraries 目录下的所有库文件
  useEffect(() => {
    // 避免重复加载（在 React StrictMode 下可能会调用两次）
    if (librariesLoadedRef.current) {
      return;
    }

    const loadLibraries = async () => {
      try {
        // 通过 API 自动获取库文件列表
        const apiResponse = await fetch('/api/libraries');
        if (!apiResponse.ok) {
          console.warn('Failed to fetch library files list from API');
          return;
        }

        const apiData = await apiResponse.json();
        const libraryFiles = apiData.files || []; // 保持向后兼容
        const filesWithCategory = apiData.filesWithCategory || []; // 使用 API 返回的分类信息
        
        if (!libraryFiles || libraryFiles.length === 0) {
          console.log('ℹ️ No library files found in public/libraries directory');
          return;
        }

        console.log(`📂 Found ${libraryFiles.length} library file(s):`, libraryFiles);

        const allLibraryItems = [];
        let globalIndex = 0; // 全局索引，确保所有库项都有唯一 ID
        const baseTimestamp = Date.now(); // 使用时间戳作为基础，确保唯一性
        
        // 按分类组织库文件（使用 API 返回的分类信息，如果没有则使用前端分类函数）
        const categorizedFiles = {};
        if (filesWithCategory && filesWithCategory.length > 0) {
          // 使用 API 返回的分类信息
          filesWithCategory.forEach(file => {
            const category = file.category || getLibraryCategory(file.name);
            if (!categorizedFiles[category]) {
              categorizedFiles[category] = [];
            }
            categorizedFiles[category].push({ 
              filePath: file.path, 
              fileName: file.name,
              category: category
            });
          });
        } else {
          // 回退到前端分类（向后兼容）
          libraryFiles.forEach(filePath => {
            const fileName = filePath.split('/').pop().replace('.excalidrawlib', '');
            const category = getLibraryCategory(fileName);
            if (!categorizedFiles[category]) {
              categorizedFiles[category] = [];
            }
            categorizedFiles[category].push({ filePath, fileName, category });
          });
        }
        
        console.log('📁 Library files categorized:', Object.keys(categorizedFiles).map(cat => ({
          category: cat,
          count: categorizedFiles[cat].length,
          files: categorizedFiles[cat].map(f => f.fileName)
        })));
        
        // 检查是否有未分类的文件
        const allCategorizedFiles = Object.values(categorizedFiles).flat();
        if (allCategorizedFiles.length !== libraryFiles.length) {
          console.warn(`⚠️ Warning: Some files may not be categorized. Expected ${libraryFiles.length} files, got ${allCategorizedFiles.length}`);
        }
        
        // 按分类顺序处理库文件
        const categoryOrder = ['架构设计', '数据科学', '开发运维', 'UI/设计', '电路/硬件', '其他'];
        
        for (const category of categoryOrder) {
          const files = categorizedFiles[category];
          if (!files || files.length === 0) continue;
          
          console.log(`📂 Loading category: ${category} (${files.length} files)`);
          
          for (const { filePath, fileName, category: fileCategory } of files) {
            const fileCategoryName = fileCategory || category; // 使用文件级别的分类，如果没有则使用类别分类
            try {
              const response = await fetch(filePath);
              if (!response.ok) {
                console.warn(`Library file not found: ${filePath}`);
                continue;
              }
              
              const data = await response.json();
              
              // 处理不同版本的库文件格式
              let libraryItems = [];
              
              if (data.libraryItems && Array.isArray(data.libraryItems)) {
                // 新版本格式：libraryItems 已经是正确格式
                // 但需要确保每个项都有唯一的 ID，并添加分类信息
                libraryItems = data.libraryItems.map((item, index) => {
                  const currentGlobalIndex = globalIndex++;
                  const itemId = item.id || `library-item-${fileName}-${index}-${currentGlobalIndex}-${baseTimestamp}`;
                  
                  // 为库项添加分类前缀（如果名称中还没有）
                  let itemName = item.name || `Item ${index + 1}`;
                  if (!itemName.includes(fileCategoryName)) {
                    itemName = `[${fileCategoryName}] ${itemName}`;
                  }
                  
                  return {
                    ...item,
                    id: itemId,
                    name: itemName,
                    // 添加分类元数据（存储在库项中，虽然 Excalidraw 可能不使用，但我们可以保留）
                    category: fileCategoryName,
                    sourceFile: fileName,
                  };
                });
              } else if (data.library && Array.isArray(data.library)) {
                // 旧版本格式：library 是二维数组，每个子数组代表一个库项
                // 需要转换为正确的格式：每个库项应该是一个对象，包含 elements 数组
                console.log(`📦 Processing old format library: ${fileName}, ${data.library.length} items`);
                libraryItems = data.library.map((elements, index) => {
                  // 过滤掉已删除的元素
                  const validElements = elements.filter(el => el && !el.isDeleted);
                  
                  if (validElements.length === 0) {
                    return null;
                  }
                  
                  const currentGlobalIndex = globalIndex++;
                  const itemId = `library-item-${fileName}-${index}-${currentGlobalIndex}-${baseTimestamp}`;
                  
                  // 为库项添加分类前缀
                  const itemName = `[${fileCategoryName}] ${fileName} - Item ${index + 1}`;
                  
                  // 返回符合 Excalidraw libraryItems 格式的对象
                  return {
                    id: itemId,
                    name: itemName,
                    status: "published",
                    created: Date.now(),
                    elements: validElements,
                    category: fileCategoryName,
                    sourceFile: fileName,
                  };
                }).filter(item => item !== null); // 过滤掉空项
                console.log(`✅ Converted ${libraryItems.length} library items from old format`);
              } else {
                console.warn(`⚠️ Unknown library format in ${filePath}, expected 'libraryItems' or 'library' field`);
              }
              
              if (libraryItems.length > 0) {
                allLibraryItems.push(...libraryItems);
                const totalElements = libraryItems.reduce((sum, item) => sum + (item.elements?.length || 0), 0);
                console.log(`✅ Loaded library from ${filePath}: ${libraryItems.length} items, ${totalElements} elements`);
              } else {
                console.warn(`⚠️ No valid library items found in ${filePath}`);
              }
            } catch (error) {
              console.warn(`Failed to load library from ${filePath}:`, error);
            }
          }
        }

        if (allLibraryItems.length > 0) {
          // 确保所有库项都有唯一的 ID，避免重复 key 错误
          const idMap = new Map();
          let duplicateCount = 0;
          const uniqueLibraryItems = allLibraryItems.map((item, index) => {
            let uniqueId = item.id;
            
            // 如果 ID 不存在或已重复，生成新的唯一 ID
            if (!uniqueId || idMap.has(uniqueId)) {
              // 使用时间戳、索引和计数器生成唯一 ID
              duplicateCount++;
              uniqueId = `library-item-${Date.now()}-${index}-${duplicateCount}-${Math.random().toString(36).substr(2, 9)}`;
              console.warn(`⚠️ Duplicate or missing ID detected, generated new ID: ${uniqueId}`);
            }
            
            idMap.set(uniqueId, true);
            
            return {
              ...item,
              id: uniqueId,
            };
          });
          
          if (duplicateCount > 0) {
            console.warn(`⚠️ Found ${duplicateCount} duplicate library item IDs, regenerated`);
          }
          
          // 按分类排序库项，确保相同分类的库项聚集在一起
          const categoryOrder = ['架构设计', '数据科学', '开发运维', 'UI/设计', '电路/硬件', '其他'];
          const sortedLibraryItems = uniqueLibraryItems.sort((a, b) => {
            const categoryA = a.category || '其他';
            const categoryB = b.category || '其他';
            const indexA = categoryOrder.indexOf(categoryA);
            const indexB = categoryOrder.indexOf(categoryB);
            
            // 如果分类相同，按名称排序
            if (indexA === indexB) {
              return (a.name || '').localeCompare(b.name || '');
            }
            
            // 如果分类不在列表中，放到最后
            const finalIndexA = indexA === -1 ? categoryOrder.length : indexA;
            const finalIndexB = indexB === -1 ? categoryOrder.length : indexB;
            
            return finalIndexA - finalIndexB;
          });
          
          setLibraryItems(sortedLibraryItems);
          librariesLoadedRef.current = true; // 标记为已加载
          
          // 统计各分类的库项数量
          const categoryStats = {};
          sortedLibraryItems.forEach(item => {
            const category = item.category || '其他';
            categoryStats[category] = (categoryStats[category] || 0) + 1;
          });
          
          console.log(`✅ Total library items loaded: ${sortedLibraryItems.length}`);
          console.log('📊 Library items by category:', categoryStats);
          console.log('📚 Library items sorted by category. First few items:', sortedLibraryItems.slice(0, 10).map(item => ({
            name: item.name,
            category: item.category
          })));
        } else {
          console.warn('⚠️ No library items found after processing');
        }
      } catch (error) {
        console.error('Error loading libraries:', error);
      }
    };

    loadLibraries();
  }, []);

  // 当 API 和库项都准备好时，使用 updateLibrary 加载库到 Excalidraw
  // 使用 ref 跟踪已更新的库项 ID 列表，避免重复添加
  useEffect(() => {
    if (excalidrawAPI && libraryItems.length > 0) {
      // 检查库项是否已更新（通过比较 ID 列表）
      const currentIds = libraryItems.map(item => item.id).sort().join(',');
      const lastIds = libraryItemsUpdatedRef.current;
      
      if (lastIds === currentIds) {
        // 库项 ID 列表相同，已经更新过，跳过
        console.log('⏭️ Library items already updated (same IDs), skipping');
        return;
      }

      try {
        // 使用 updateLibrary 方法更新库项
        if (typeof excalidrawAPI.updateLibrary === 'function') {
          console.log('🔄 Updating library items via API:', libraryItems.length);
          // 使用 merge: false 来替换而不是合并，避免重复
          excalidrawAPI.updateLibrary({
            libraryItems: libraryItems,
            merge: false, // 替换而不是合并，避免重复
          });
          libraryItemsUpdatedRef.current = currentIds; // 记录已更新的 ID 列表
          console.log('✅ Library items updated successfully via API:', libraryItems.length);
        } else {
          console.log('ℹ️ Library items loaded via prop (updateLibrary not available):', libraryItems.length);
        }
      } catch (error) {
        console.error('❌ Failed to update library items:', error);
      }
    } else if (excalidrawAPI && libraryItems.length === 0) {
      console.log('ℹ️ Excalidraw API ready, but no library items to load yet');
    } else if (!excalidrawAPI && libraryItems.length > 0) {
      console.log('ℹ️ Library items ready, waiting for Excalidraw API');
    }
  }, [excalidrawAPI, libraryItems]);

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
    
    // For linear elements (arrow / line), ensure we don't carry over any stale `points`
    // coming from the generated JSON. `convertToExcalidrawElements` expects
    // Skeleton data (x, y, width, height, start, end, etc.) and will compute
    // normalized `points` internally. Passing inconsistent `points` can lead to
    // "Linear element is not normalized" runtime errors when editing.
    if (converted.type === 'arrow' || converted.type === 'line') {
      if (converted.points) {
        delete converted.points;
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

  // Convert Excalidraw elements back to custom JSON format
  const convertFromExcalidrawFormat = (excalidrawElements) => {
    if (!excalidrawElements || !Array.isArray(excalidrawElements)) {
      return [];
    }

    // 使用 Map 去重，确保每个 ID 只出现一次
    const elementsMap = new Map();
    
    excalidrawElements
      .filter(el => el && !el.isDeleted && el.id) // 过滤已删除的元素和没有ID的元素
      .forEach(el => {
        // 如果已存在相同ID的元素，保留最新的（后出现的）
        if (!elementsMap.has(el.id)) {
          elementsMap.set(el.id, el);
        }
      });

    // 分离形状和文本元素，用于后续处理 label
    const shapeElements = [];
    const textElements = [];
    const arrowElements = [];
    
    Array.from(elementsMap.values()).forEach(el => {
      if (el.type === 'text') {
        textElements.push(el);
      } else if (el.type === 'arrow' || el.type === 'line') {
        arrowElements.push(el);
      } else {
        shapeElements.push(el);
      }
    });
    
    // 处理形状元素，保留 label 格式
    return shapeElements
      .map(el => {
        const converted = {
          id: el.id,
          type: el.type
        };

        // 基础属性
        if (el.x !== undefined) converted.x = Math.round(el.x);
        if (el.y !== undefined) converted.y = Math.round(el.y);
        if (el.width !== undefined) converted.width = Math.round(el.width);
        if (el.height !== undefined) converted.height = Math.round(el.height);

        // 颜色转换：保持原始格式（backgroundColor/strokeColor 而不是 fill/stroke）
        // 但为了兼容，同时提供两种格式
        if (el.backgroundColor !== undefined) {
          converted.backgroundColor = el.backgroundColor;
          converted.fill = el.backgroundColor; // 兼容格式
        }
        if (el.strokeColor !== undefined) {
          converted.strokeColor = el.strokeColor;
          converted.stroke = el.strokeColor; // 兼容格式
        }

        // 保留所有样式属性
        if (el.strokeWidth !== undefined) {
          converted.strokeWidth = el.strokeWidth;
        }
        if (el.fillStyle !== undefined) {
          converted.fillStyle = el.fillStyle;
        }
        if (el.strokeStyle !== undefined) {
          converted.strokeStyle = el.strokeStyle;
        }
        if (el.roundness !== undefined && el.roundness !== null) {
          converted.roundness = el.roundness;
        }
        if (el.opacity !== undefined) {
          converted.opacity = el.opacity;
        }
        if (el.angle !== undefined) {
          converted.angle = el.angle;
        }

        // 处理形状（rectangle, ellipse, diamond）的 label
        // 保持 label 对象格式，而不是转换为独立的 text 元素
        if ((el.type === 'rectangle' || el.type === 'ellipse' || el.type === 'diamond') && el.label) {
          converted.label = {
            text: el.label.text || '',
          };
          if (el.label.fontSize !== undefined) {
            converted.label.fontSize = el.label.fontSize;
          }
          if (el.label.strokeColor !== undefined) {
            converted.label.strokeColor = el.label.strokeColor;
          }
          if (el.label.textAlign !== undefined) {
            converted.label.textAlign = el.label.textAlign;
          }
          if (el.label.verticalAlign !== undefined) {
            converted.label.verticalAlign = el.label.verticalAlign;
          }
          if (el.label.fontFamily !== undefined) {
            converted.label.fontFamily = el.label.fontFamily;
          }
        }

        return converted;
      })
      .concat(
        // 处理箭头和线条元素
        arrowElements.map(el => {
          const converted = {
            id: el.id,
            type: el.type
          };

          const x1 = el.x || 0;
          const y1 = el.y || 0;
          const x2 = x1 + (el.width || 0);
          const y2 = y1 + (el.height || 0);
          
          converted.x1 = Math.round(x1);
          converted.y1 = Math.round(y1);
          converted.x2 = Math.round(x2);
          converted.y2 = Math.round(y2);

          // 颜色和样式
          if (el.backgroundColor !== undefined) {
            converted.backgroundColor = el.backgroundColor;
            converted.fill = el.backgroundColor;
          }
          if (el.strokeColor !== undefined) {
            converted.strokeColor = el.strokeColor;
            converted.stroke = el.strokeColor;
          }
          if (el.strokeWidth !== undefined) {
            converted.strokeWidth = el.strokeWidth;
          }
          if (el.fillStyle !== undefined) {
            converted.fillStyle = el.fillStyle;
          }
          if (el.strokeStyle !== undefined) {
            converted.strokeStyle = el.strokeStyle;
          }
          if (el.roundness !== undefined && el.roundness !== null) {
            converted.roundness = el.roundness;
          }

          // 处理绑定关系
          if (el.startBinding && el.startBinding.elementId) {
            converted.startId = el.startBinding.elementId;
            converted.start = { id: el.startBinding.elementId };
          }
          if (el.endBinding && el.endBinding.elementId) {
            converted.endId = el.endBinding.elementId;
            converted.end = { id: el.endBinding.elementId };
          }

          // 箭头头部
          if (el.type === 'arrow') {
            if (el.endArrowhead !== undefined) {
              converted.endArrowhead = el.endArrowhead;
              if (el.endArrowhead === 'arrow') {
                converted.head = 'arrow';
              } else {
                converted.head = el.endArrowhead;
              }
            }
            if (el.startArrowhead !== undefined) {
              converted.startArrowhead = el.startArrowhead;
            }
          }

          // 保留箭头的 label
          if (el.label) {
            converted.label = {
              text: el.label.text || '',
            };
            if (el.label.fontSize !== undefined) {
              converted.label.fontSize = el.label.fontSize;
            }
            if (el.label.strokeColor !== undefined) {
              converted.label.strokeColor = el.label.strokeColor;
            }
            if (el.label.textAlign !== undefined) {
              converted.label.textAlign = el.label.textAlign;
            }
            if (el.label.verticalAlign !== undefined) {
              converted.label.verticalAlign = el.label.verticalAlign;
            }
          }

          return converted;
        }),
        // 处理独立的文本元素
        textElements.map(el => {
          const converted = {
            id: el.id,
            type: el.type
          };

          if (el.x !== undefined) converted.x = Math.round(el.x);
          if (el.y !== undefined) converted.y = Math.round(el.y);
          if (el.width !== undefined) converted.width = Math.round(el.width);
          if (el.height !== undefined) converted.height = Math.round(el.height);

          if (el.text !== undefined) {
            converted.text = el.text;
          }
          if (el.fontSize !== undefined) {
            converted.fontSize = el.fontSize;
          }
          if (el.fontFamily !== undefined) {
            converted.fontFamily = el.fontFamily;
          }
          if (el.textAlign !== undefined) {
            converted.textAlign = el.textAlign;
          }
          if (el.verticalAlign !== undefined) {
            converted.verticalAlign = el.verticalAlign;
          }
          if (el.strokeColor !== undefined) {
            converted.strokeColor = el.strokeColor;
            converted.stroke = el.strokeColor;
          }
          if (el.backgroundColor !== undefined) {
            converted.backgroundColor = el.backgroundColor;
            converted.fill = el.backgroundColor;
          }

          return converted;
        })
      )
      .filter(el => el && el.id); // 确保所有元素都有ID
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
      
      // 去重：确保没有重复的元素ID
      const uniqueElements = [];
      const seenIds = new Set();
      for (const el of validConverted) {
        if (el && el.id && !seenIds.has(el.id)) {
          seenIds.add(el.id);
          uniqueElements.push(el);
        } else if (el && !el.id) {
          // 如果没有ID，也添加（可能是临时元素）
          uniqueElements.push(el);
        } else if (el && el.id && seenIds.has(el.id)) {
          console.warn('ExcalidrawCanvas: Duplicate element ID detected:', el.id, 'skipping duplicate');
        }
      }
      
      if (uniqueElements.length !== validConverted.length) {
        console.warn('ExcalidrawCanvas: Removed', validConverted.length - uniqueElements.length, 'duplicate elements');
      }
      
      return uniqueElements;
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
      // 检查是否真的需要更新：比较元素ID和关键属性
      const currentElementIds = new Set(convertedElements.map(el => el.id).sort());
      const lastElementIds = lastSyncedElementsRef.current 
        ? new Set(lastSyncedElementsRef.current.map(el => el.id).sort())
        : new Set();
      
      const idsEqual = currentElementIds.size === lastElementIds.size &&
        Array.from(currentElementIds).every(id => lastElementIds.has(id));
      
      // 如果ID集合相同，检查是否有属性变化
      let needsUpdate = !idsEqual;
      if (idsEqual && lastSyncedElementsRef.current) {
        needsUpdate = convertedElements.some(currentEl => {
          const lastEl = lastSyncedElementsRef.current.find(el => el.id === currentEl.id);
          if (!lastEl) return true;
          
          // 比较关键属性
          return (
            currentEl.x !== lastEl.x ||
            currentEl.y !== lastEl.y ||
            currentEl.width !== lastEl.width ||
            currentEl.height !== lastEl.height ||
            currentEl.strokeColor !== lastEl.strokeColor ||
            currentEl.backgroundColor !== lastEl.backgroundColor ||
            (currentEl.type === 'text' && currentEl.text !== lastEl.text) ||
            (currentEl.label && currentEl.label.text !== (lastEl.label?.text))
          );
        });
      }
      
      if (!needsUpdate) {
        return; // 不需要更新，跳过
      }
      
      console.log('ExcalidrawCanvas: Updating scene with', convertedElements.length, 'elements');
      // 标记正在从 props 更新，避免触发 onChange
      isUpdatingFromPropsRef.current = true;
      
      // Use updateScene to update the canvas with new elements
      try {
        // 去重：确保没有重复的元素ID
        const uniqueElements = [];
        const seenIds = new Set();
        for (const el of convertedElements) {
          if (el && el.id && !seenIds.has(el.id)) {
            seenIds.add(el.id);
            uniqueElements.push(el);
          }
        }
        
        excalidrawAPI.updateScene({
          elements: uniqueElements,
        });
        
        // 更新 lastSyncedElementsRef 以匹配新的元素
        lastSyncedElementsRef.current = uniqueElements;
        
        // Then scroll to content
        setTimeout(() => {
          if (isMountedRef.current && excalidrawAPI) {
            console.log('ExcalidrawCanvas: Scrolling to content');
            try {
              excalidrawAPI.scrollToContent(uniqueElements, {
                fitToContent: true,
                animate: true,
                duration: 300,
              });
            } catch (error) {
              console.error('ExcalidrawCanvas: Error scrolling to content:', error);
            }
          }
          // 延迟重置标志，确保 onChange 中的检查能够正确工作
          setTimeout(() => {
            isUpdatingFromPropsRef.current = false;
          }, 500); // 增加延迟，确保更新完成
        }, 100);
      } catch (error) {
        console.error('ExcalidrawCanvas: Error updating scene:', error);
        isUpdatingFromPropsRef.current = false;
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
        // 不通过 prop 传递 libraryItems，只通过 updateLibrary API 传递，避免重复
        initialData={{
          elements: (convertedElements && convertedElements.length > 0) ? convertedElements : [],
          // 不在这里传递 libraryItems，只通过 updateLibrary API 传递，避免重复添加
          appState: {
            viewBackgroundColor: '#ffffff',
            currentItemFontFamily: 1,
          },
          scrollToContent: (convertedElements && convertedElements.length > 0),
        }}
        onChange={(excalidrawElements, appState, files) => {
          // 如果正在从 props 更新，跳过此次 onChange
          if (isUpdatingFromPropsRef.current) {
            return;
          }

          // 检测是否是撤销/重做操作
          // Excalidraw 的 appState 包含 history 信息，我们可以通过比较来判断
          // 注意：Excalidraw 可能没有直接暴露 historyStackSize，我们需要通过其他方式检测
          // 实际上，最好的方式是让 Excalidraw 自己管理撤销栈，我们只同步 JSON
          // 不需要特别检测撤销/重做，因为我们已经不在 onChange 中更新 elements 了
          
          // 更新历史状态引用（用于调试）
          if (appState) {
            lastHistoryStateRef.current = {
              // 可以记录一些状态用于调试
            };
          }

          // 过滤掉选择框等临时元素
          const validElements = excalidrawElements.filter(el => 
            el && 
            !el.isDeleted && 
            el.type !== 'selection' &&
            el.id && // 确保有ID
            (el.type === 'rectangle' || el.type === 'ellipse' || el.type === 'diamond' || 
             el.type === 'text' || el.type === 'arrow' || el.type === 'line')
          );

          if (validElements.length === 0) {
            return; // 没有有效元素
          }

          // 使用更精确的比较：比较元素ID集合和关键属性
          const currentElementIds = new Set(validElements.map(el => el.id).sort());
          const lastSyncedIds = lastSyncedElementsRef.current 
            ? new Set(lastSyncedElementsRef.current.map(el => el.id).sort())
            : new Set();
          
          // 检查ID集合是否相同
          const idsEqual = currentElementIds.size === lastSyncedIds.size &&
            Array.from(currentElementIds).every(id => lastSyncedIds.has(id));
          
          // 如果ID集合相同，进一步比较关键属性
          if (idsEqual && lastSyncedElementsRef.current) {
            const hasSignificantChange = validElements.some(currentEl => {
              const lastEl = lastSyncedElementsRef.current.find(el => el.id === currentEl.id);
              if (!lastEl) return true;
              
              // 比较关键属性
              return (
                currentEl.x !== lastEl.x ||
                currentEl.y !== lastEl.y ||
                currentEl.width !== lastEl.width ||
                currentEl.height !== lastEl.height ||
                currentEl.strokeColor !== lastEl.strokeColor ||
                currentEl.backgroundColor !== lastEl.backgroundColor ||
                (currentEl.type === 'text' && currentEl.text !== lastEl.text) ||
                (currentEl.label && currentEl.label.text !== (lastEl.label?.text))
              );
            });
            
            if (!hasSignificantChange) {
              return; // 没有显著变化，跳过
            }
          }

          // 转换回自定义 JSON 格式
          try {
            const customElements = convertFromExcalidrawFormat(validElements);
            
            // 检查自定义元素是否真的变化了
            const customElementsStr = JSON.stringify(customElements);
            const lastCustomElementsStr = lastSyncedCustomElementsRef.current 
              ? JSON.stringify(lastSyncedCustomElementsRef.current)
              : null;
            
            if (customElementsStr === lastCustomElementsStr) {
              return; // 自定义格式没有变化，跳过
            }
            
            // 更新引用，避免循环更新
            lastSyncedElementsRef.current = validElements;
            lastSyncedCustomElementsRef.current = customElements;
            
            // 通知父组件元素已变化
            // 如果是撤销/重做操作，也需要同步，让 JSON 反映当前状态
            if (onElementsChange && customElements.length > 0) {
              console.log('ExcalidrawCanvas: Elements changed by user, syncing to JSON:', customElements.length, 'elements');
              onElementsChange(customElements);
            }
          } catch (error) {
            console.error('ExcalidrawCanvas: Error converting elements back to custom format:', error);
          }
        }}
      />
    </div>
  );
}

