'use client';

import { useState, useRef } from 'react';
import ImageUpload from './ImageUpload';
import LoadingOverlay from './LoadingOverlay';
import { generateImagePrompt } from '@/lib/image-utils';

// Chart type options
// Must match CHART_TYPE_NAMES in lib/prompts.js
const CHART_TYPES = {
  auto: '自动',
  flowchart: '流程图',
  mindmap: '思维导图',
  orgchart: '组织架构图',
  sequence: '时序图',
  class: 'UML类图',
  er: 'ER图',
  gantt: '甘特图',
  timeline: '时间线',
  tree: '树形图',
  network: '网络拓扑图',
  architecture: '架构图',
  dataflow: '数据流图',
  state: '状态图',
  swimlane: '泳道图',
  concept: '概念图',
  fishbone: '鱼骨图',
  swot: 'SWOT分析图',
  pyramid: '金字塔图',
  funnel: '漏斗图',
  venn: '韦恩图',
  matrix: '矩阵图',
  infographic: '信息图'
};

export default function Chat({ onSendMessage, isGenerating, plannerOutput, conversationHistory = [], isModifyMode, onToggleModifyMode, hasExistingChart, onOpenCodeEditor, hasCode }) {
  const [activeTab, setActiveTab] = useState('text'); // 'text', 'file', or 'image'
  const [input, setInput] = useState('');
  const [chartType, setChartType] = useState('auto'); // Selected chart type
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileStatus, setFileStatus] = useState(''); // '', 'parsing', 'success', 'error'
  const [fileError, setFileError] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [fileContent, setFileContent] = useState(''); // Store parsed file content
  const [canGenerate, setCanGenerate] = useState(false); // Track if generation is possible
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim() && !isGenerating) {
      onSendMessage(input.trim(), chartType);
      // Don't clear input - keep it for user reference
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      // Reset file-related state when no file is selected
      setSelectedFile(null);
      setFileStatus('');
      setFileError('');
      setFileContent('');
      setCanGenerate(false);
      return;
    }

    // Validate file type
    const validExtensions = ['.md', '.txt'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!validExtensions.includes(fileExtension)) {
      setFileError('请选择 .md 或 .txt 文件');
      setFileStatus('error');
      setCanGenerate(false);
      return;
    }

    // Validate file size (max 1MB)
    const maxSize = 1 * 1024 * 1024; // 1MB in bytes
    if (file.size > maxSize) {
      setFileError('文件大小不能超过 1MB');
      setFileStatus('error');
      setCanGenerate(false);
      return;
    }

    setSelectedFile(file);
    setFileStatus('parsing');
    setFileError('');
    setFileContent(''); // Clear previous content
    setCanGenerate(false); // Disable generation until parsing is complete

    // Read file content
    const reader = new FileReader();

    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string' && content.trim()) {
        setFileStatus('success');
        setFileContent(content.trim()); // Store content for manual generation
        setCanGenerate(true); // Enable generation button
        // Don't auto-submit the file content - wait for user to click generate button
      } else {
        setFileError('文件内容为空');
        setFileStatus('error');
        setCanGenerate(false);
      }
    };

    reader.onerror = () => {
      setFileError('文件读取失败');
      setFileStatus('error');
      setCanGenerate(false);
    };

    reader.readAsText(file);
  };

  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileGenerate = () => {
    if (fileContent && !isGenerating) {
      onSendMessage(fileContent, chartType);
      // Reset canGenerate state after initiating generation
      setCanGenerate(false);
    }
  };

  const handleImageSelect = (imageData) => {
    setSelectedImage(imageData);
    // 图片选择完成后，不立即发送处理请求
    // 用户需要点击"开始生成"按钮才会开始生成
    if (imageData) {
      setCanGenerate(true); // Enable generation button for image
    } else {
      setCanGenerate(false);
    }
  };

  const handleImageSubmit = () => {
    if (selectedImage && !isGenerating) {
      // 生成针对图片的提示词
      const imagePrompt = generateImagePrompt(chartType);

      // 创建包含图片数据的消息对象
      const messageData = {
        text: imagePrompt,
        image: selectedImage,
        chartType
      };

      onSendMessage(messageData, chartType);
      // Reset canGenerate state after initiating generation
      setCanGenerate(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Mode Toggle & Conversation History */}
      <div className="flex-shrink-0 border-b border-gray-200 bg-gray-50">
        {/* Mode Toggle */}
        {hasExistingChart && (
          <div className="px-4 py-2 flex items-center justify-between border-b border-gray-200">
            <span className="text-xs text-gray-600">对话模式：</span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => onToggleModifyMode(false)}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  !isModifyMode
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
                disabled={isGenerating}
              >
                新建
              </button>
              <button
                onClick={() => onToggleModifyMode(true)}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  isModifyMode
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
                disabled={isGenerating}
              >
                修改
              </button>
            </div>
          </div>
        )}
        
        {/* Conversation History */}
        {conversationHistory.length > 0 && (
          <div className="px-4 py-2 max-h-32 overflow-y-auto border-b border-gray-200">
            <div className="space-y-2">
              {conversationHistory.slice(-3).map((msg, idx) => (
                <div key={idx} className={`text-xs ${msg.role === 'user' ? 'text-gray-700' : 'text-gray-500'}`}>
                  <span className="font-medium">{msg.role === 'user' ? '您' : 'AI'}:</span>
                  <span className="ml-2">{msg.content.length > 50 ? msg.content.substring(0, 50) + '...' : msg.content}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        <button
          onClick={() => {
            setActiveTab('text');
            setCanGenerate(false); // Reset generation state when switching tabs
          }}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors duration-200 ${
            activeTab === 'text'
              ? 'bg-white text-gray-900 border-b-2 border-gray-900'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          文本输入
        </button>
        <button
          onClick={() => {
            setActiveTab('file');
            setCanGenerate(!!fileContent); // Set generation state based on file content
          }}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors duration-200 ${
            activeTab === 'file'
              ? 'bg-white text-gray-900 border-b-2 border-gray-900'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          文件上传
        </button>
        <button
          onClick={() => {
            setActiveTab('image');
            setCanGenerate(!!selectedImage); // Set generation state based on selected image
          }}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors duration-200 ${
            activeTab === 'image'
              ? 'bg-white text-gray-900 border-b-2 border-gray-900'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          图片上传
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Planner Output / Analysis Display */}
        {plannerOutput && activeTab === 'text' && (
          <div className="flex-shrink-0 p-4 bg-blue-50 border-b border-blue-100 overflow-y-auto max-h-48 text-sm">
            <div className="flex items-center space-x-2 mb-2">
              <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
              <h4 className="font-medium text-blue-900">AI 思考分析</h4>
            </div>
            <div className="text-blue-800 whitespace-pre-wrap leading-relaxed">
              {plannerOutput.analysis || "正在分析需求..."}
            </div>
            {plannerOutput.elements && (
              <div className="mt-2 pt-2 border-t border-blue-200 text-xs text-blue-700">
                <span>计划生成 {plannerOutput.elements.length} 个元素</span>
                {plannerOutput.chart_type && <span> · 类型: {plannerOutput.chart_type}</span>}
              </div>
            )}
          </div>
        )}

        {/* Text Input Tab */}
        {activeTab === 'text' && (
          <div className="flex-1 flex flex-col p-4 relative min-h-0">
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
              {/* Chart Type Selector */}
              <div className="mb-3">
                <label htmlFor="chart-type-text" className="block text-xs font-medium text-gray-700 mb-1">
                  图表类型
                </label>
                <select
                  id="chart-type-text"
                  value={chartType}
                  onChange={(e) => setChartType(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
                  disabled={isGenerating}
                >
                  {Object.entries(CHART_TYPES).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Modify Mode Hint */}
              {isModifyMode && hasExistingChart && (
                <div className="mb-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                  <div className="flex items-start space-x-2">
                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <span>修改模式：您的输入将基于当前图表进行修改，而不是重新生成。</span>
                  </div>
                </div>
              )}
              <div className="relative flex-1">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="描述您想要创建的图表..."
                  className="w-full h-full pl-3 pr-12 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none text-sm scrollbar-hide"
                  style={{
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                  }}
                  disabled={isGenerating}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isGenerating}
                  className="absolute right-2 bottom-2 p-2 bg-gray-900 text-white rounded hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200"
                  title={isGenerating ? "生成中..." : "发送"}
                >
                  {isGenerating ? (
                    <div className="flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                </button>
              </div>
            </form>
            {/* Unified Loading Overlay */}
            <LoadingOverlay
              isVisible={isGenerating}
              message="正在生成图表..."
            />
          </div>
        )}

        {/* File Upload Tab */}
        {activeTab === 'file' && (
          <div className="flex-1 flex flex-col items-center  p-4 relative">
            {/* Chart Type Selector */}
            <div className="w-full max-w-md mb-6">
              <label htmlFor="chart-type-file" className="block text-xs font-medium text-gray-700 mb-1">
                图表类型
              </label>
              <select
                id="chart-type-file"
                value={chartType}
                onChange={(e) => setChartType(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
                disabled={isGenerating || fileStatus === 'parsing'}
              >
                {Object.entries(CHART_TYPES).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-center mb-6">
              <p className="text-sm text-gray-600 mb-2">上传 Markdown 或文本文件</p>
              <p className="text-xs text-gray-400">支持 .md 和 .txt 格式，最大 1MB</p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".md,.txt"
              onChange={handleFileChange}
              className="hidden"
              disabled={isGenerating || fileStatus === 'parsing'}
            />

            <button
              onClick={handleFileButtonClick}
              disabled={isGenerating || fileStatus === 'parsing'}
              className="px-6 py-3 bg-gray-900 text-white rounded hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200 flex items-center space-x-2"
            >
              {(isGenerating || fileStatus === 'parsing') ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              )}
              <span>
                {fileStatus === 'parsing' ? '解析中...' :
                 isGenerating ? '生成中...' : '选择文件'}
              </span>
            </button>

            {/* File Status */}
            {selectedFile && (
              <div className="mt-6 w-full max-w-md">
                <div className={`p-4 rounded border ${
                  fileStatus === 'success' ? 'bg-green-50 border-green-200' :
                  fileStatus === 'error' ? 'bg-red-50 border-red-200' :
                  'bg-blue-50 border-blue-200'
                }`}>
                  <div className="flex items-center space-x-3">
                    {fileStatus === 'parsing' && (
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    )}
                    {fileStatus === 'success' && (
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {fileStatus === 'error' && (
                      <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{selectedFile.name}</p>
                      {fileStatus === 'success' && !isGenerating && (
                        <p className="text-xs text-green-600 mt-1">文件已上传，可以开始生成</p>
                      )}
                      {fileStatus === 'success' && isGenerating && (
                        <p className="text-xs text-blue-600 mt-1">正在生成图表...</p>
                      )}
                      {fileStatus === 'error' && (
                        <p className="text-xs text-red-600 mt-1">{fileError}</p>
                      )}
                      {fileStatus === 'parsing' && (
                        <p className="text-xs text-blue-600 mt-1">正在解析文件...</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Generate Button */}
                {fileStatus === 'success' && !isGenerating && (
                  <div className="mt-4">
                    <button
                      onClick={handleFileGenerate}
                      disabled={!canGenerate}
                      className="w-full px-4 py-3 bg-gray-900 text-white rounded hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center space-x-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span>开始生成</span>
                    </button>
                  </div>
                )}
              </div>
            )}
            {/* Unified Loading Overlay */}
            <LoadingOverlay
              isVisible={isGenerating || fileStatus === 'parsing'}
              message={fileStatus === 'parsing' ? '正在解析文件...' : '正在生成图表...'}
            />
          </div>
        )}

        {/* Image Upload Tab */}
        {activeTab === 'image' && (
          <div className="flex-1 flex flex-col relative">
            <ImageUpload
              onImageSelect={handleImageSelect}
              isGenerating={isGenerating}
              chartType={chartType}
              onChartTypeChange={setChartType}
              onImageGenerate={handleImageSubmit}
            />
            {/* Unified Loading Overlay for image upload */}
            <LoadingOverlay
              isVisible={isGenerating}
              message="正在识别图片内容并生成图表..."
            />
          </div>
        )}
      </div>
    </div>
  );
}

