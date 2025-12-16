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
      let x1 = converted.x1;
      let y1 = converted.y1;
      let x2 = converted.x2 || x1;
      let y2 = converted.y2 || y1;
      
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
      // 优先使用 start/end 对象，然后是 startId/endId，最后是位置匹配
      if (converted.start && converted.start.id) {
        // 已经有 start 对象，保持不变
      } else if (converted.startId) {
        converted.start = { id: converted.startId };
        delete converted.startId;
      } else if (startElement && startElement.id) {
        converted.start = { id: startElement.id };
      }
      
      if (converted.end && converted.end.id) {
        // 已经有 end 对象，保持不变
      } else if (converted.endId) {
        converted.end = { id: converted.endId };
        delete converted.endId;
      } else if (endElement && endElement.id) {
        converted.end = { id: endElement.id };
      }
      
      // Set arrow position and size
      // Calculate width and height first (normalized: relative to start point)
      // 确保坐标值是有效的数字
      const MAX_COORDINATE = 1000000;
      const MIN_COORDINATE = -1000000;
      
      // 验证并限制输入坐标值
      if (!isFinite(x1) || isNaN(x1)) x1 = 0;
      if (!isFinite(y1) || isNaN(y1)) y1 = 0;
      if (!isFinite(x2) || isNaN(x2)) x2 = x1 + 100;
      if (!isFinite(y2) || isNaN(y2)) y2 = y1;
      
      // 限制坐标值范围
      x1 = Math.max(MIN_COORDINATE, Math.min(MAX_COORDINATE, x1));
      y1 = Math.max(MIN_COORDINATE, Math.min(MAX_COORDINATE, y1));
      x2 = Math.max(MIN_COORDINATE, Math.min(MAX_COORDINATE, x2));
      y2 = Math.max(MIN_COORDINATE, Math.min(MAX_COORDINATE, y2));
      
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
      
      // 再次验证 width 和 height
      if (!isFinite(width) || isNaN(width)) width = 100;
      if (!isFinite(height) || isNaN(height)) height = 0;
      
      // 限制 width 和 height 的范围
      width = Math.max(MIN_COORDINATE, Math.min(MAX_COORDINATE, width));
      height = Math.max(MIN_COORDINATE, Math.min(MAX_COORDINATE, height));
      
      // Normalize arrow coordinates
      // In Excalidraw, arrows must be normalized: start at (x, y), end at (x + width, y + height)
      // When arrows have bindings, Excalidraw will automatically adjust, but we still need valid initial coordinates
      
      // 使用原始的 x1, y1, x2, y2 来计算，不要使用经过调整的 width 和 height
      // 这样可以保持箭头位置的准确性
      const originalWidth = x2 - x1;
      const originalHeight = y2 - y1;
      
      // 统一使用起点作为基准，不管绑定状态如何
      // Excalidraw 会根据 start/end 绑定自动调整箭头的连接点位置
      // 我们只需要提供正确的方向向量（从起点到终点）
      converted.x = x1;
      converted.y = y1;
      converted.width = originalWidth;
      converted.height = originalHeight;
      
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
      
      // 对于箭头，必须删除 points 属性，让 Excalidraw 自动计算
      // 这是防止 "Linear element is not normalized" 错误的关键
      if (converted.points) {
        delete converted.points;
      }
      
      // 确保 width 和 height 不为零（或太小），这会导致归一化错误
      if (converted.width !== undefined && Math.abs(converted.width) < 0.1) {
        converted.width = converted.width >= 0 ? 1 : -1;
      }
      if (converted.height !== undefined && Math.abs(converted.height) < 0.1) {
        converted.height = converted.height >= 0 ? 1 : -1;
      }
    }
    
    // For linear elements (arrow / line), ensure we don't carry over any stale `points`
    // coming from the generated JSON. `convertToExcalidrawElements` expects
    // Skeleton data (x, y, width, height, start, end, etc.) and will compute
    // normalized `points` internally. Passing inconsistent `points` can lead to
    // "Linear element is not normalized" runtime errors when editing.
    if (converted.type === 'arrow' || converted.type === 'line') {
      // 删除所有可能导致归一化问题的属性
      if (converted.points) {
        delete converted.points;
      }
      // 确保坐标值是有效的
      if (converted.x !== undefined && (!isFinite(converted.x) || isNaN(converted.x))) {
        converted.x = 0;
      }
      if (converted.y !== undefined && (!isFinite(converted.y) || isNaN(converted.y))) {
        converted.y = 0;
      }
      if (converted.width !== undefined && (!isFinite(converted.width) || isNaN(converted.width))) {
        converted.width = 100;
      }
      if (converted.height !== undefined && (!isFinite(converted.height) || isNaN(converted.height))) {
        converted.height = 0;
      }
      
      // 确保 width 和 height 不为零（或太小），这会导致归一化错误
      if (converted.width !== undefined && Math.abs(converted.width) < 0.1) {
        converted.width = converted.width >= 0 ? 1 : -1;
      }
      if (converted.height !== undefined && Math.abs(converted.height) < 0.1) {
        converted.height = converted.height >= 0 ? 1 : -1;
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

    // ===== 调试日志：输出原始 Excalidraw 元素 =====
    console.log('========== convertFromExcalidrawFormat DEBUG ==========');
    console.log('Input elements count:', excalidrawElements.length);
    
    // 输出前3个元素的完整结构（帮助理解 Excalidraw 的内部格式）
    excalidrawElements.slice(0, 5).forEach((el, index) => {
      console.log(`\n--- Element ${index} (${el.type}) ---`);
      console.log('ID:', el.id);
      console.log('Type:', el.type);
      console.log('Coordinates: x=', el.x, 'y=', el.y, 'width=', el.width, 'height=', el.height);
      console.log('Colors: strokeColor=', el.strokeColor, 'backgroundColor=', el.backgroundColor);
      console.log('Style: strokeWidth=', el.strokeWidth, 'fillStyle=', el.fillStyle);
      console.log('Label property:', el.label);
      console.log('ContainerId (for text):', el.containerId);
      console.log('BoundElements:', el.boundElements);
      console.log('StartBinding:', el.startBinding);
      console.log('EndBinding:', el.endBinding);
      console.log('EndArrowhead:', el.endArrowhead);
      console.log('Text (for text elements):', el.text);
      console.log('Roundness:', el.roundness);
      console.log('Full element:', JSON.stringify(el, null, 2));
    });
    console.log('=======================================================\n');

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

    // 保持元素的原始顺序，不要按类型分离
    // 这样可以保持 JSON 的结构和顺序
    const allElements = Array.from(elementsMap.values());
    
    // 创建一个映射，用于识别哪些 text 元素是 label
    // 关键修复：使用 Excalidraw 的 containerId 属性来准确识别 label
    const textToElementMap = new Map(); // text element id -> parent element id
    
    // 第一步：通过 containerId 识别 label（这是最准确的方式）
    allElements.forEach(textEl => {
      if (textEl.type === 'text' && textEl.containerId) {
        // text 元素有 containerId，说明它是某个元素的 label
        textToElementMap.set(textEl.id, textEl.containerId);
        console.log('Found label via containerId:', textEl.id, '->', textEl.containerId);
      }
    });
    
    // 第二步：通过 boundElements 反向确认（作为备用）
    allElements.forEach(el => {
      if (el.boundElements && Array.isArray(el.boundElements)) {
        el.boundElements.forEach(bound => {
          if (bound.type === 'text' && bound.id) {
            // 这个元素绑定了一个 text 元素
            if (!textToElementMap.has(bound.id)) {
              textToElementMap.set(bound.id, el.id);
              console.log('Found label via boundElements:', bound.id, '->', el.id);
            }
          }
        });
      }
    });
    
    console.log('Total labels found:', textToElementMap.size);
    
    // 按原始顺序处理所有元素，保持 JSON 的结构
    const result = [];
    
    allElements.forEach(el => {
      // 如果是 text 元素，且被识别为某个元素（形状或箭头）的 label，跳过（会在元素处理时添加）
      if (el.type === 'text' && textToElementMap.has(el.id)) {
        return; // 跳过，这是 label，不是独立文本
      }
      
      let converted = null;
      
      // 处理形状元素（rectangle, ellipse, diamond）
      if (el.type === 'rectangle' || el.type === 'ellipse' || el.type === 'diamond') {
        converted = {
          id: el.id,
          type: el.type
        };

        // 基础属性 - 验证并限制坐标值范围
        const MAX_COORDINATE = 1000000;
        const MIN_COORDINATE = -1000000;
        
        if (el.x !== undefined) {
          let x = el.x;
          if (!isFinite(x) || isNaN(x)) x = 0;
          x = Math.max(MIN_COORDINATE, Math.min(MAX_COORDINATE, x));
          converted.x = Math.round(x);
        }
        if (el.y !== undefined) {
          let y = el.y;
          if (!isFinite(y) || isNaN(y)) y = 0;
          y = Math.max(MIN_COORDINATE, Math.min(MAX_COORDINATE, y));
          converted.y = Math.round(y);
        }
        if (el.width !== undefined) {
          let width = el.width;
          if (!isFinite(width) || isNaN(width) || width <= 0) width = 100;
          width = Math.max(1, Math.min(MAX_COORDINATE, width));
          converted.width = Math.round(width);
        }
        if (el.height !== undefined) {
          let height = el.height;
          if (!isFinite(height) || isNaN(height) || height <= 0) height = 100;
          height = Math.max(1, Math.min(MAX_COORDINATE, height));
          converted.height = Math.round(height);
        }

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
        if ((el.type === 'rectangle' || el.type === 'ellipse' || el.type === 'diamond')) {
          // 首先检查元素本身是否有 label 属性
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
            if (el.label.fontFamily !== undefined) {
              converted.label.fontFamily = el.label.fontFamily;
            }
          } else {
            // 如果没有 label 属性，检查是否有对应的 text 元素（Excalidraw 可能将 label 分离了）
            const labelTextEl = allElements.find(textEl => 
              textEl.type === 'text' && textToElementMap.get(textEl.id) === el.id
            );
            
            if (labelTextEl) {
              // 找到对应的 text 元素，将其转换为 label
              converted.label = {
                text: labelTextEl.text || '',
              };
              if (labelTextEl.fontSize !== undefined) {
                converted.label.fontSize = labelTextEl.fontSize;
              }
              if (labelTextEl.strokeColor !== undefined) {
                converted.label.strokeColor = labelTextEl.strokeColor;
              }
              if (labelTextEl.textAlign !== undefined) {
                converted.label.textAlign = labelTextEl.textAlign;
              }
              if (labelTextEl.verticalAlign !== undefined) {
                converted.label.verticalAlign = labelTextEl.verticalAlign;
              }
              if (labelTextEl.fontFamily !== undefined) {
                converted.label.fontFamily = labelTextEl.fontFamily;
              }
            }
          }
        }

        result.push(converted);
      }
      // 处理箭头和线条元素
      else if (el.type === 'arrow' || el.type === 'line') {
        converted = {
          id: el.id,
          type: el.type
        };

          // 确保坐标值是有效的数字，并在合理范围内
          const MAX_COORDINATE = 1000000; // 最大坐标值
          const MIN_COORDINATE = -1000000; // 最小坐标值
          
          let x = el.x || 0;
          let y = el.y || 0;
          let width = el.width || 0;
          let height = el.height || 0;
          
          // 验证并限制坐标值范围
          if (!isFinite(x) || isNaN(x)) x = 0;
          if (!isFinite(y) || isNaN(y)) y = 0;
          if (!isFinite(width) || isNaN(width)) width = 100;
          if (!isFinite(height) || isNaN(height)) height = 0;
          
          // 限制坐标值范围，避免过大或过小的值
          x = Math.max(MIN_COORDINATE, Math.min(MAX_COORDINATE, x));
          y = Math.max(MIN_COORDINATE, Math.min(MAX_COORDINATE, y));
          width = Math.max(MIN_COORDINATE, Math.min(MAX_COORDINATE, width));
          height = Math.max(MIN_COORDINATE, Math.min(MAX_COORDINATE, height));
          
          // 使用 x, y, width, height 格式（与原始 JSON 格式一致）
          converted.x = Math.round(x);
          converted.y = Math.round(y);
          converted.width = Math.round(width);
          converted.height = Math.round(height);
          
          // 最终验证：确保坐标值有效
          if (!isFinite(converted.x) || !isFinite(converted.y) || 
              !isFinite(converted.width) || !isFinite(converted.height)) {
            console.warn('ExcalidrawCanvas: Invalid arrow coordinates after conversion, skipping:', el);
            return; // 跳过这个元素，不添加到结果中
          }

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
          // Excalidraw 内部使用 startBinding/endBinding，我们需要从这里获取绑定信息
          // 注意：Excalidraw 元素不会有 start/end 对象，这是我们自定义 JSON 的格式
          if (el.startBinding && el.startBinding.elementId) {
            converted.start = { id: el.startBinding.elementId };
          }
          
          if (el.endBinding && el.endBinding.elementId) {
            converted.end = { id: el.endBinding.elementId };
          }

          // 箭头头部 - 保持与原始 JSON 格式一致，只使用 endArrowhead
          if (el.type === 'arrow') {
            // 默认箭头头部为 'arrow'，除非明确设置为其他值或 null
            if (el.endArrowhead !== undefined) {
              converted.endArrowhead = el.endArrowhead;
            } else {
              converted.endArrowhead = 'arrow'; // 默认值
            }
            if (el.startArrowhead !== undefined && el.startArrowhead !== null) {
              converted.startArrowhead = el.startArrowhead;
            }
          }

          // 保留箭头的 label
          // 首先检查元素本身是否有 label 属性
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
            if (el.label.fontFamily !== undefined) {
              converted.label.fontFamily = el.label.fontFamily;
            }
          } else {
            // 如果没有 label 属性，检查是否有对应的 text 元素（Excalidraw 可能将 label 分离了）
            const labelTextEl = allElements.find(textEl => 
              textEl.type === 'text' && textToElementMap.get(textEl.id) === el.id
            );
            
            if (labelTextEl) {
              // 找到对应的 text 元素，将其转换为 label
              converted.label = {
                text: labelTextEl.text || '',
              };
              if (labelTextEl.fontSize !== undefined) {
                converted.label.fontSize = labelTextEl.fontSize;
              }
              if (labelTextEl.strokeColor !== undefined) {
                converted.label.strokeColor = labelTextEl.strokeColor;
              }
              if (labelTextEl.textAlign !== undefined) {
                converted.label.textAlign = labelTextEl.textAlign;
              }
              if (labelTextEl.verticalAlign !== undefined) {
                converted.label.verticalAlign = labelTextEl.verticalAlign;
              }
              if (labelTextEl.fontFamily !== undefined) {
                converted.label.fontFamily = labelTextEl.fontFamily;
              }
            }
          }

        result.push(converted);
      }
        // 处理独立的文本元素（不是任何元素（形状或箭头）的 label）
        else if (el.type === 'text' && !textToElementMap.has(el.id)) {
        converted = {
          id: el.id,
          type: el.type
        };

          // 验证并限制文本元素的坐标值范围
          const MAX_COORDINATE = 1000000;
          const MIN_COORDINATE = -1000000;
          
          if (el.x !== undefined) {
            let x = el.x;
            if (!isFinite(x) || isNaN(x)) x = 0;
            x = Math.max(MIN_COORDINATE, Math.min(MAX_COORDINATE, x));
            converted.x = Math.round(x);
          }
          if (el.y !== undefined) {
            let y = el.y;
            if (!isFinite(y) || isNaN(y)) y = 0;
            y = Math.max(MIN_COORDINATE, Math.min(MAX_COORDINATE, y));
            converted.y = Math.round(y);
          }
          if (el.width !== undefined) {
            let width = el.width;
            if (!isFinite(width) || isNaN(width) || width <= 0) width = 100;
            width = Math.max(1, Math.min(MAX_COORDINATE, width));
            converted.width = Math.round(width);
          }
          if (el.height !== undefined) {
            let height = el.height;
            if (!isFinite(height) || isNaN(height) || height <= 0) height = 20;
            height = Math.max(1, Math.min(MAX_COORDINATE, height));
            converted.height = Math.round(height);
          }

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

        result.push(converted);
      }
    });
    
    // 过滤掉无效的元素
    const filteredResult = result.filter(el => el && el.id);
    
    // ===== 调试日志：输出转换结果 =====
    console.log('\n========== convertFromExcalidrawFormat RESULT ==========');
    console.log('Output elements count:', filteredResult.length);
    filteredResult.forEach((el, index) => {
      console.log(`\n--- Output Element ${index} (${el.type}) ---`);
      console.log(JSON.stringify(el, null, 2));
    });
    console.log('=========================================================\n');
    
    return filteredResult;
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
      const MAX_COORDINATE = 1000000;
      const MIN_COORDINATE = -1000000;
      
      const skeletonElements = filteredElements
        .map(el => {
          try {
            return convertToSkeletonFormat(el, filteredElements);
          } catch (error) {
            console.error('ExcalidrawCanvas: Error converting element to skeleton format:', error, el);
            return null;
          }
        })
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
            
            // 限制坐标值范围，避免过大或过小的值
            if (Math.abs(el.x) > MAX_COORDINATE || Math.abs(el.y) > MAX_COORDINATE ||
                Math.abs(el.width) > MAX_COORDINATE || Math.abs(el.height) > MAX_COORDINATE) {
              console.warn('ExcalidrawCanvas: Filtering out arrow/line element with coordinates too large:', el);
              return false;
            }
            
            // Ensure width and height are not both zero (or too small)
            if (Math.abs(el.width) < 0.1 && Math.abs(el.height) < 0.1) {
              console.warn('ExcalidrawCanvas: Filtering out arrow/line element with zero dimensions:', el);
              return false;
            }
            
            // 确保没有 points 属性（会导致归一化错误）
            if (el.points) {
              delete el.points;
            }
          }
          
          // 验证形状元素的坐标
          if (el.type === 'rectangle' || el.type === 'ellipse' || el.type === 'diamond') {
            if (el.x !== undefined && (!isFinite(el.x) || Math.abs(el.x) > MAX_COORDINATE)) {
              console.warn('ExcalidrawCanvas: Filtering out shape element with invalid x:', el);
              return false;
            }
            if (el.y !== undefined && (!isFinite(el.y) || Math.abs(el.y) > MAX_COORDINATE)) {
              console.warn('ExcalidrawCanvas: Filtering out shape element with invalid y:', el);
              return false;
            }
            if (el.width !== undefined && (!isFinite(el.width) || Math.abs(el.width) > MAX_COORDINATE || el.width <= 0)) {
              console.warn('ExcalidrawCanvas: Filtering out shape element with invalid width:', el);
              return false;
            }
            if (el.height !== undefined && (!isFinite(el.height) || Math.abs(el.height) > MAX_COORDINATE || el.height <= 0)) {
              console.warn('ExcalidrawCanvas: Filtering out shape element with invalid height:', el);
              return false;
            }
          }
          
          return true;
        });
      console.log('ExcalidrawCanvas: Converted to skeleton format:', skeletonElements);

      // Convert to Excalidraw elements
      let converted;
      try {
        converted = convertToExcalidrawElements(skeletonElements);
        console.log('ExcalidrawCanvas: Converted elements:', converted.length);
      } catch (error) {
        console.error('ExcalidrawCanvas: Error converting to Excalidraw elements:', error);
        console.error('ExcalidrawCanvas: Skeleton elements that caused error:', skeletonElements);
        // 返回空数组而不是抛出错误，避免整个组件崩溃
        return [];
      }
      
      // Ensure all converted elements are valid (not undefined or null)
      // 同时修复箭头元素的 points 属性
      const validConverted = converted
        .filter(el => {
          if (el == null || typeof el !== 'object') {
            return false;
          }
          
          // 对于箭头/线条元素，验证并修复 points 属性
          if (el.type === 'arrow' || el.type === 'line') {
            // 确保有必要的坐标属性
            if (el.x === undefined || el.y === undefined || 
                el.width === undefined || el.height === undefined ||
                !isFinite(el.x) || !isFinite(el.y) ||
                !isFinite(el.width) || !isFinite(el.height)) {
              console.warn('ExcalidrawCanvas: Filtering out invalid arrow/line element:', el);
              return false;
            }
            
            // 确保 width 和 height 不为零
            if (Math.abs(el.width) < 0.1 && Math.abs(el.height) < 0.1) {
              console.warn('ExcalidrawCanvas: Filtering out arrow/line with zero dimensions:', el);
              return false;
            }
            
            // 确保 points 存在且正确归一化
            // Excalidraw 要求：points[0] 必须是 [0, 0]，points[-1] 必须与 [width, height] 一致
            const width = el.width || 0;
            const height = el.height || 0;
            
            if (!el.points || !Array.isArray(el.points) || el.points.length === 0) {
              // 创建归一化的 points 数组
              el.points = [
                [0, 0],
                [width, height]
              ];
              console.warn('ExcalidrawCanvas: Fixed missing points for arrow/line element:', el.id);
            } else {
              // 验证并修复 points 数组，确保它是归一化的
              const points = el.points;
              
              // 确保第一个点是 [0, 0]
              if (points.length > 0) {
                const firstPoint = points[0];
                if (!Array.isArray(firstPoint) || firstPoint.length < 2 ||
                    Math.abs(firstPoint[0]) > 0.01 || Math.abs(firstPoint[1]) > 0.01) {
                  points[0] = [0, 0];
                }
              }
              
              // 确保最后一个点与 [width, height] 一致
              if (points.length > 1) {
                const lastPoint = points[points.length - 1];
                if (!Array.isArray(lastPoint) || lastPoint.length < 2) {
                  points[points.length - 1] = [width, height];
                } else {
                  const diffX = Math.abs(lastPoint[0] - width);
                  const diffY = Math.abs(lastPoint[1] - height);
                  if (diffX > 0.01 || diffY > 0.01) {
                    points[points.length - 1] = [width, height];
                  }
                }
              } else if (points.length === 1) {
                points.push([width, height]);
              }
              
              // 验证所有中间点都是有效的
              for (let i = 1; i < points.length - 1; i++) {
                const point = points[i];
                if (!Array.isArray(point) || point.length < 2 ||
                    !isFinite(point[0]) || !isFinite(point[1])) {
                  points.splice(i, 1);
                  i--;
                }
              }
              
              // 确保至少有两个点
              if (points.length < 2) {
                points.length = 0;
                points.push([0, 0], [width, height]);
              }
              
              el.points = points;
            }
          }
          
          return true;
        });
      if (validConverted.length !== converted.length) {
        console.warn('ExcalidrawCanvas: Some converted elements were invalid, filtered out', 
          converted.length - validConverted.length, 'invalid elements');
      }
      
      // 去重：确保没有重复的元素ID
      // 注意：不要删除 points 属性，因为 Excalidraw 需要它
      // 我们已经在上面修复了 points，确保它是有效的
      const uniqueElements = [];
      const seenIds = new Set();
      for (const el of validConverted) {
        if (el && el.id && !seenIds.has(el.id)) {
          seenIds.add(el.id);
          
          // 对于线性元素（箭头/线条），确保 points 存在且正确归一化
          if (el.type === 'arrow' || el.type === 'line') {
            const width = el.width || 0;
            const height = el.height || 0;
            
            if (!el.points || !Array.isArray(el.points) || el.points.length === 0) {
              el.points = [[0, 0], [width, height]];
            } else {
              // 确保第一个点是 [0, 0]
              if (el.points.length > 0) {
                const firstPoint = el.points[0];
                if (!Array.isArray(firstPoint) || firstPoint.length < 2 ||
                    Math.abs(firstPoint[0]) > 0.01 || Math.abs(firstPoint[1]) > 0.01) {
                  el.points[0] = [0, 0];
                }
              }
              
              // 确保最后一个点与 [width, height] 一致
              if (el.points.length > 1) {
                const lastPoint = el.points[el.points.length - 1];
                if (!Array.isArray(lastPoint) || lastPoint.length < 2) {
                  el.points[el.points.length - 1] = [width, height];
                } else {
                  const diffX = Math.abs(lastPoint[0] - width);
                  const diffY = Math.abs(lastPoint[1] - height);
                  if (diffX > 0.01 || diffY > 0.01) {
                    el.points[el.points.length - 1] = [width, height];
                  }
                }
              } else if (el.points.length === 1) {
                el.points.push([width, height]);
              }
              
              // 确保至少有两个点
              if (el.points.length < 2) {
                el.points = [[0, 0], [width, height]];
              }
            }
          }
          uniqueElements.push(el);
        } else if (el && !el.id) {
          // 如果没有ID，也添加（可能是临时元素）
          // 确保箭头/线条有有效的 points
          if (el.type === 'arrow' || el.type === 'line') {
            if (!el.points || !Array.isArray(el.points) || el.points.length === 0) {
              const width = el.width || 0;
              const height = el.height || 0;
              el.points = [
                [0, 0],
                [width, height]
              ];
            }
          }
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
        // 同时清理和验证线性元素，防止归一化错误
        const uniqueElements = [];
        const seenIds = new Set();
        for (const el of convertedElements) {
          if (!el || typeof el !== 'object') {
            console.warn('ExcalidrawCanvas: Skipping invalid element:', el);
            continue;
          }
          
          // 验证箭头/线条元素
          if (el.type === 'arrow' || el.type === 'line') {
            // 确保有必要的属性
            if (el.x === undefined || el.y === undefined || 
                el.width === undefined || el.height === undefined ||
                !isFinite(el.x) || !isFinite(el.y) ||
                !isFinite(el.width) || !isFinite(el.height)) {
              console.warn('ExcalidrawCanvas: Skipping invalid arrow/line element:', el);
              continue;
            }
            
            // 确保 width 和 height 不为零
            if (Math.abs(el.width) < 0.1 && Math.abs(el.height) < 0.1) {
              console.warn('ExcalidrawCanvas: Skipping arrow/line with zero dimensions:', el);
              continue;
            }
            
            // 对于线性元素，确保 points 存在且正确归一化
            // Excalidraw 要求：points[0] 必须是 [0, 0]，points[-1] 必须与 [width, height] 一致
            const width = el.width || 0;
            const height = el.height || 0;
            
            // 如果 points 不存在或无效，创建归一化的 points 数组
            if (!el.points || !Array.isArray(el.points) || el.points.length === 0) {
              el.points = [
                [0, 0],
                [width, height]
              ];
            } else {
              // 验证并修复 points 数组，确保它是归一化的
              const points = el.points;
              
              // 确保第一个点是 [0, 0]
              if (points.length > 0) {
                const firstPoint = points[0];
                if (!Array.isArray(firstPoint) || firstPoint.length < 2 ||
                    Math.abs(firstPoint[0]) > 0.01 || Math.abs(firstPoint[1]) > 0.01) {
                  // 第一个点不是 [0, 0]，需要修复
                  points[0] = [0, 0];
                }
              }
              
              // 确保最后一个点与 [width, height] 一致
              if (points.length > 1) {
                const lastPoint = points[points.length - 1];
                if (!Array.isArray(lastPoint) || lastPoint.length < 2) {
                  // 最后一个点无效，替换为 [width, height]
                  points[points.length - 1] = [width, height];
                } else {
                  // 检查是否与 width, height 一致（允许小的浮点误差）
                  const diffX = Math.abs(lastPoint[0] - width);
                  const diffY = Math.abs(lastPoint[1] - height);
                  if (diffX > 0.01 || diffY > 0.01) {
                    // 不一致，修复为 [width, height]
                    points[points.length - 1] = [width, height];
                  }
                }
              } else if (points.length === 1) {
                // 只有一个点，添加终点
                points.push([width, height]);
              }
              
              // 验证所有中间点都是有效的
              for (let i = 1; i < points.length - 1; i++) {
                const point = points[i];
                if (!Array.isArray(point) || point.length < 2 ||
                    !isFinite(point[0]) || !isFinite(point[1])) {
                  // 无效的点，移除它
                  points.splice(i, 1);
                  i--; // 调整索引
                }
              }
              
              // 确保至少有两个点
              if (points.length < 2) {
                points.length = 0;
                points.push([0, 0], [width, height]);
              }
              
              el.points = points;
            }
            
            if (el.id && !seenIds.has(el.id)) {
              seenIds.add(el.id);
              uniqueElements.push(el);
            } else if (!el.id) {
              uniqueElements.push(el);
            }
          } else {
            // 非线性元素，直接添加
            if (el.id && !seenIds.has(el.id)) {
              seenIds.add(el.id);
              uniqueElements.push(el);
            } else if (!el.id) {
              uniqueElements.push(el);
            }
          }
        }
        
        if (uniqueElements.length === 0) {
          console.warn('ExcalidrawCanvas: No valid elements to update scene');
          return;
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
              // 过滤掉无效的元素，避免 scrollToContent 出错
              const validElementsForScroll = uniqueElements.filter(el => {
                if (!el || typeof el !== 'object') return false;
                if (el.type === 'arrow' || el.type === 'line') {
                  // 确保箭头/线条有有效的坐标
                  return el.x !== undefined && el.y !== undefined &&
                         el.width !== undefined && el.height !== undefined &&
                         isFinite(el.x) && isFinite(el.y) &&
                         isFinite(el.width) && isFinite(el.height) &&
                         (Math.abs(el.width) >= 0.1 || Math.abs(el.height) >= 0.1);
                }
                return true;
              });
              
              if (validElementsForScroll.length > 0) {
                excalidrawAPI.scrollToContent(validElementsForScroll, {
                  fitToContent: true,
                  animate: true,
                  duration: 300,
                });
              }
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
          // 注意：不在这里过滤 isDeleted，因为我们需要检测删除操作
          const validElements = excalidrawElements.filter(el => 
            el && 
            el.type !== 'selection' &&
            el.id && // 确保有ID
            (el.type === 'rectangle' || el.type === 'ellipse' || el.type === 'diamond' || 
             el.type === 'text' || el.type === 'arrow' || el.type === 'line')
          );

          // 过滤掉已删除的元素（用于转换，但保留用于比较）
          const activeElements = validElements.filter(el => !el.isDeleted);
          
          // 如果之前有元素，现在没有了，说明所有元素都被删除了，需要同步
          const hadElementsBefore = lastSyncedElementsRef.current && lastSyncedElementsRef.current.length > 0;
          if (activeElements.length === 0 && !hadElementsBefore) {
            return; // 从来没有元素，跳过
          }
          
          // 使用 activeElements 进行后续处理
          const elementsToProcess = activeElements;

          // 使用更精确的比较：比较元素ID集合和关键属性
          const currentElementIds = new Set(elementsToProcess.map(el => el.id).sort());
          const lastSyncedIds = lastSyncedElementsRef.current 
            ? new Set(lastSyncedElementsRef.current.map(el => el.id).sort())
            : new Set();
          
          // 检查ID集合是否相同（包括删除的情况）
          const idsEqual = currentElementIds.size === lastSyncedIds.size &&
            Array.from(currentElementIds).every(id => lastSyncedIds.has(id));
          
          // 如果ID集合不同，说明有元素被添加或删除，需要立即同步
          if (!idsEqual) {
            // ID 集合不同，肯定有变化（添加或删除），继续处理
            console.log('ExcalidrawCanvas: Element count changed:', currentElementIds.size, 'vs', lastSyncedIds.size);
          } else if (lastSyncedElementsRef.current) {
            // ID 集合相同，进一步比较关键属性
            // 使用容差比较，忽略微小的坐标变化（小于 1 像素的变化可能是 Excalidraw 自动调整）
            const COORDINATE_TOLERANCE = 1; // 坐标容差：1 像素
            
            const hasSignificantChange = elementsToProcess.some(currentEl => {
              const lastEl = lastSyncedElementsRef.current.find(el => el.id === currentEl.id);
              if (!lastEl) return true;
              
              // 比较关键属性，使用容差比较坐标
              const xDiff = Math.abs(currentEl.x - lastEl.x);
              const yDiff = Math.abs(currentEl.y - lastEl.y);
              const widthDiff = Math.abs(currentEl.width - lastEl.width);
              const heightDiff = Math.abs(currentEl.height - lastEl.height);
              
              // 坐标变化超过容差才认为是显著变化
              const hasCoordinateChange = xDiff > COORDINATE_TOLERANCE || 
                                        yDiff > COORDINATE_TOLERANCE ||
                                        widthDiff > COORDINATE_TOLERANCE ||
                                        heightDiff > COORDINATE_TOLERANCE;
              
              // 其他属性变化（颜色、文本等）总是认为是显著变化
              const hasOtherChange = (
                currentEl.strokeColor !== lastEl.strokeColor ||
                currentEl.backgroundColor !== lastEl.backgroundColor ||
                (currentEl.type === 'text' && currentEl.text !== lastEl.text) ||
                (currentEl.label && currentEl.label.text !== (lastEl.label?.text))
              );
              
              return hasCoordinateChange || hasOtherChange;
            });
            
            if (!hasSignificantChange) {
              return; // 没有显著变化，跳过
            }
          }

          // 转换回自定义 JSON 格式
          try {
            console.log('ExcalidrawCanvas: Converting elements to custom format:', elementsToProcess.length, 'elements');
            console.log('ExcalidrawCanvas: First few elements before conversion:', elementsToProcess.slice(0, 3).map(el => ({
              id: el.id,
              type: el.type,
              x: el.x,
              y: el.y,
              width: el.width,
              height: el.height,
              hasLabel: !!el.label
            })));
            
            const customElements = convertFromExcalidrawFormat(elementsToProcess);
            
            console.log('ExcalidrawCanvas: Converted to custom format:', customElements.length, 'elements');
            console.log('ExcalidrawCanvas: First few elements after conversion:', customElements.slice(0, 3).map(el => ({
              id: el.id,
              type: el.type,
              x: el.x,
              y: el.y,
              width: el.width,
              height: el.height,
              hasLabel: !!el.label
            })));
            
            // 更精确的比较：只比较真正变化的元素
            // 而不是比较整个 JSON 字符串，避免因为坐标四舍五入导致的不必要更新
            if (lastSyncedCustomElementsRef.current && lastSyncedCustomElementsRef.current.length === customElements.length) {
              // 元素数量相同，逐个比较
              let hasRealChange = false;
              
              for (let i = 0; i < customElements.length; i++) {
                const current = customElements[i];
                const last = lastSyncedCustomElementsRef.current.find(el => el.id === current.id);
                
                if (!last) {
                  hasRealChange = true;
                  break;
                }
                
                // 比较关键属性（使用容差比较坐标）
                const COORDINATE_TOLERANCE = 1;
                const xDiff = Math.abs((current.x || 0) - (last.x || 0));
                const yDiff = Math.abs((current.y || 0) - (last.y || 0));
                const widthDiff = Math.abs((current.width || 0) - (last.width || 0));
                const heightDiff = Math.abs((current.height || 0) - (last.height || 0));
                const x1Diff = Math.abs((current.x1 || 0) - (last.x1 || 0));
                const y1Diff = Math.abs((current.y1 || 0) - (last.y1 || 0));
                const x2Diff = Math.abs((current.x2 || 0) - (last.x2 || 0));
                const y2Diff = Math.abs((current.y2 || 0) - (last.y2 || 0));
                
                const hasCoordinateChange = xDiff > COORDINATE_TOLERANCE || 
                                          yDiff > COORDINATE_TOLERANCE ||
                                          widthDiff > COORDINATE_TOLERANCE ||
                                          heightDiff > COORDINATE_TOLERANCE ||
                                          x1Diff > COORDINATE_TOLERANCE ||
                                          y1Diff > COORDINATE_TOLERANCE ||
                                          x2Diff > COORDINATE_TOLERANCE ||
                                          y2Diff > COORDINATE_TOLERANCE;
                
                const hasOtherChange = (
                  current.strokeColor !== last.strokeColor ||
                  current.backgroundColor !== last.backgroundColor ||
                  current.stroke !== last.stroke ||
                  current.fill !== last.fill ||
                  current.strokeWidth !== last.strokeWidth ||
                  current.fillStyle !== last.fillStyle ||
                  current.strokeStyle !== last.strokeStyle ||
                  (current.type === 'text' && current.text !== last.text) ||
                  (current.text && current.text !== last.text) ||
                  (current.label && current.label.text !== (last.label?.text)) ||
                  current.startId !== last.startId ||
                  current.endId !== last.endId
                );
                
                if (hasCoordinateChange || hasOtherChange) {
                  hasRealChange = true;
                  break;
                }
              }
              
              if (!hasRealChange) {
                // 没有真正变化，跳过同步
                console.log('ExcalidrawCanvas: No significant changes detected, skipping sync');
                return;
              }
            }
            
            // 更新引用，避免循环更新
            lastSyncedElementsRef.current = elementsToProcess;
            lastSyncedCustomElementsRef.current = customElements;
            
            // 通知父组件元素已变化（即使为空数组也要同步，表示所有元素被删除）
            if (onElementsChange) {
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

