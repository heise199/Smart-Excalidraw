'use client';

import { useState, useRef, useEffect } from 'react';
import { Editor } from '@monaco-editor/react';

export default function FloatingCodeEditor({ 
  code, 
  onChange, 
  onApply, 
  onOptimize, 
  onClear, 
  jsonError, 
  onClearJsonError, 
  isGenerating, 
  isApplyingCode, 
  isOptimizingCode 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const windowRef = useRef(null);

  // 初始化位置
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPosition({ x: window.innerWidth - 600, y: 100 });
    }
  }, []);

  // 当有新代码生成时，自动打开窗口（如果之前是关闭的）
  useEffect(() => {
    if (code.trim() && !isOpen && !isMinimized) {
      // 不自动打开，让用户手动打开
    }
  }, [code, isOpen, isMinimized]);

  // 拖拽处理
  const handleMouseDown = (e) => {
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('textarea')) {
      return; // 不拖拽按钮和输入框
    }
    setIsDragging(true);
    const rect = windowRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  // 限制窗口在视口内
  useEffect(() => {
    if (windowRef.current) {
      const rect = windowRef.current.getBoundingClientRect();
      const maxX = window.innerWidth - rect.width;
      const maxY = window.innerHeight - rect.height;
      
      setPosition(prev => ({
        x: Math.max(0, Math.min(prev.x, maxX)),
        y: Math.max(0, Math.min(prev.y, maxY))
      }));
    }
  }, [isOpen, isMinimized]);

  if (!isOpen && !code.trim()) {
    return null; // 没有代码时不显示
  }

  return (
    <>
      {/* 悬浮按钮 - 当窗口关闭或最小化时显示 */}
      {(!isOpen || isMinimized) && code.trim() && (
        <button
          onClick={() => {
            setIsOpen(true);
            setIsMinimized(false);
          }}
          className="fixed bottom-4 right-4 z-50 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg hover:bg-gray-800 transition-all duration-200 flex items-center space-x-2"
          style={{ zIndex: 1000 }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          <span className="text-sm font-medium">查看代码</span>
          {code.trim() && (
            <span className="ml-2 px-2 py-0.5 bg-gray-700 rounded text-xs">
              {code.split('\n').length} 行
            </span>
          )}
        </button>
      )}

      {/* 悬浮窗口 */}
      {isOpen && (
        <div
          ref={windowRef}
          className={`fixed z-50 bg-white rounded-lg shadow-2xl border border-gray-300 flex flex-col transition-all duration-200 ${
            isMinimized ? 'h-auto' : 'h-[600px]'
          } ${isDragging ? 'cursor-move' : ''}`}
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
            width: isMinimized ? '300px' : '600px',
            zIndex: 1000
          }}
        >
          {/* 标题栏 - 可拖拽 */}
          <div
            onMouseDown={handleMouseDown}
            className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200 rounded-t-lg cursor-move select-none"
          >
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              <h3 className="text-sm font-semibold text-gray-700">生成的代码</h3>
              {code.trim() && !isMinimized && (
                <span className="ml-2 px-2 py-0.5 bg-gray-200 rounded text-xs text-gray-600">
                  {code.split('\n').length} 行
                </span>
              )}
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors"
                title={isMinimized ? "展开" : "最小化"}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isMinimized ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  )}
                </svg>
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors"
                title="关闭"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* 内容区域 */}
          {!isMinimized && (
            <div className="flex-1 overflow-hidden bg-gray-50" style={{ height: 'calc(600px - 49px)' }}>
              {/* 操作按钮栏 */}
              <div className="flex items-center justify-end px-4 py-2 bg-white border-b border-gray-200 space-x-2">
                <button
                  onClick={onClear}
                  disabled={isGenerating || isApplyingCode || isOptimizingCode}
                  className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  清除
                </button>
                <button
                  onClick={onOptimize}
                  disabled={isGenerating || isApplyingCode || isOptimizingCode || !code.trim()}
                  className="px-3 py-1.5 text-xs font-medium text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  style={{
                    background: isGenerating || isApplyingCode || isOptimizingCode ? '#d1d5db' : 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)'
                  }}
                >
                  {isOptimizingCode ? '优化中...' : '优化'}
                </button>
                <button
                  onClick={onApply}
                  disabled={isGenerating || isApplyingCode || isOptimizingCode || !code.trim()}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                >
                  {isApplyingCode ? '应用中...' : '应用到画布'}
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </button>
              </div>

              {/* JSON 错误提示 */}
              {jsonError && (
                <div className="px-4 py-2 bg-red-50 border-b border-red-200 flex items-start justify-between">
                  <div className="flex items-start space-x-2 flex-1">
                    <svg className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <p className="text-xs text-red-700 font-mono flex-1">{jsonError}</p>
                  </div>
                  <button
                    onClick={onClearJsonError}
                    className="text-red-600 hover:text-red-800 transition-colors ml-2"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              )}

              {/* 代码编辑器 */}
              <div className="flex-1 overflow-hidden" style={{ height: `calc(100% - ${jsonError ? '80px' : '40px'})` }}>
                <Editor
                  height="100%"
                  defaultLanguage="javascript"
                  value={code}
                  onChange={(value) => onChange(value || '')}
                  theme="vs-light"
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                    wordWrap: 'on',
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

