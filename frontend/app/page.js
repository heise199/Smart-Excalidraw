'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Chat from '@/components/Chat';
import FloatingCodeEditor from '@/components/FloatingCodeEditor';
import ConfigModal from '@/components/ConfigModal';
import ContactModal from '@/components/ContactModal';
import { getConfig, getAllConfigs, setCurrentProvider, isConfigValid } from '@/lib/config';
import { optimizeExcalidrawCode } from '@/lib/optimizeArrows';

// Dynamically import ExcalidrawCanvas to avoid SSR issues
const ExcalidrawCanvas = dynamic(() => import('@/components/ExcalidrawCanvas'), {
  ssr: false,
});

export default function Home() {
  const [config, setConfig] = useState(null);
  const [allConfigs, setAllConfigs] = useState({ providers: [], currentProviderId: null });
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [elements, setElements] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplyingCode, setIsApplyingCode] = useState(false);
  const [isOptimizingCode, setIsOptimizingCode] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(30); // Percentage of viewport width
  const [isResizingHorizontal, setIsResizingHorizontal] = useState(false);
  const [isLeftPanelVisible, setIsLeftPanelVisible] = useState(true); // Control left panel visibility
  const [apiError, setApiError] = useState(null);
  const [jsonError, setJsonError] = useState(null);
  const [generationProgress, setGenerationProgress] = useState({ message: '正在生成图表...', progress: null });
  const [plannerOutput, setPlannerOutput] = useState(null); // Store planner analysis
  const [conversationHistory, setConversationHistory] = useState([]); // 对话历史
  const [isModifyMode, setIsModifyMode] = useState(false); // 是否为修改模式
  const [isCodeEditorOpen, setIsCodeEditorOpen] = useState(false); // 代码编辑器悬浮窗开关

  // Load config on mount and when config modal closes
  const loadConfigs = async () => {
    try {
      const savedConfig = await getConfig();
      const allProviderConfigs = await getAllConfigs();
      if (savedConfig) {
        setConfig(savedConfig);
      }
      setAllConfigs(allProviderConfigs);
    } catch (error) {
      console.error('Failed to load configs:', error);
      // 如果是连接错误，显示友好的提示
      if (error.message && (error.message.includes('无法连接') || error.message.includes('后端 API 未找到'))) {
        setApiError(`配置加载失败：${error.message}`);
      }
    }
  };

  useEffect(() => {
    loadConfigs();
  }, []);

  // 流式处理函数：只做基本清理，不尝试解析不完整的 JSON
  // 用于在流式响应过程中实时显示内容
  const processStreamingCode = (code) => {
    if (!code || typeof code !== 'string') return code || '';
    
    let processed = code.trim();
    
    // 只移除明显的标签，不进行 JSON 解析
    processed = processed.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
    processed = processed.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '');
    processed = processed.replace(/<redacted_reasoning[^>]*>[\s\S]*?<\/redacted_reasoning>/gi, '');
    processed = processed.replace(/<thought>[\s\S]*?<\/thought>/gi, '');
    processed = processed.replace(/<analysis>[\s\S]*?<\/analysis>/gi, '');
    processed = processed.replace(/<[^>]*reasoning[^>]*>[\s\S]*?<\/[^>]*>/gi, '');
    processed = processed.replace(/<[^>]*thinking[^>]*>[\s\S]*?<\/[^>]*>/gi, '');
    processed = processed.replace(/<[^>]*redacted[^>]*>/gi, '');
    processed = processed.replace(/<[^>]*reasoning[^>]*>/gi, '');
    processed = processed.replace(/<[^>]*thinking[^>]*>/gi, '');
    processed = processed.replace(/<[^>]*\/>/gi, ''); // Remove self-closing tags
    
    // 移除 markdown 代码块标记
    processed = processed.replace(/^```(?:json|javascript|js)?\s*\n?/i, '');
    processed = processed.replace(/\n?```\s*$/, '');
    processed = processed.trim();
    
    // 如果以标签开头，尝试找到第一个 JSON 字符
    if (processed.startsWith('<')) {
      const jsonStart = processed.search(/[\[{]/);
      if (jsonStart > 0) {
        processed = processed.substring(jsonStart);
      } else if (jsonStart === -1) {
        // 如果找不到 JSON，但流式过程中可能还没有 JSON，返回清理后的内容
        // 不要返回空字符串，保留可能的部分内容
        return processed;
      }
    }
    
    return processed;
  };

  // Post-process Excalidraw code: remove markdown wrappers and fix unescaped quotes
  // 完整处理函数：用于流式完成后的最终清理和验证
  const postProcessExcalidrawCode = (code, isStreaming = false) => {
    if (!code || typeof code !== 'string') return code;
    
    // 如果是流式处理，使用轻量级处理
    if (isStreaming) {
      return processStreamingCode(code);
    }
    
    let processed = code.trim();
    
    // Step 1: Remove LLM thinking/reasoning tags and their content
    // Remove common thinking tags: <thinking>, <reasoning>, <think>, etc.
    processed = processed.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
    processed = processed.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '');
    processed = processed.replace(/<redacted_reasoning[^>]*>[\s\S]*?<\/redacted_reasoning>/gi, '');
    processed = processed.replace(/<thought>[\s\S]*?<\/thought>/gi, '');
    processed = processed.replace(/<analysis>[\s\S]*?<\/analysis>/gi, '');
    // Remove redacted_reasoning tags (may be self-closing or have content)
    processed = processed.replace(/<redacted_reasoning[^>]*>[\s\S]*?<\/redacted_reasoning>/gi, '');
    processed = processed.replace(/<redacted_reasoning[^>]*\/>/gi, '');
    // Remove any XML/HTML-like tags that might contain thinking content
    processed = processed.replace(/<[^>]*reasoning[^>]*>[\s\S]*?<\/[^>]*>/gi, '');
    processed = processed.replace(/<[^>]*thinking[^>]*>[\s\S]*?<\/[^>]*>/gi, '');
    // Remove any self-closing tags that might be thinking markers
    processed = processed.replace(/<[^>]*reasoning[^>]*\/>/gi, '');
    processed = processed.replace(/<[^>]*thinking[^>]*\/>/gi, '');
    // Remove HTML comments
    processed = processed.replace(/<!--[\s\S]*?-->/g, '');
    
    // Step 1.5: Remove any remaining XML/HTML tags that might interfere
    // This is a more aggressive approach - remove any tags that aren't part of JSON
    // But be careful not to remove content inside JSON strings
    // First, let's find the JSON start position
    const jsonStartMatch = processed.match(/[\[{]/);
    if (jsonStartMatch) {
      const jsonStartIndex = processed.indexOf(jsonStartMatch[0]);
      // Remove any tags before JSON starts
      if (jsonStartIndex > 0) {
        const beforeJson = processed.substring(0, jsonStartIndex);
        // If it contains tags, remove it completely
        if (beforeJson.includes('<') || beforeJson.includes('>')) {
          processed = processed.substring(jsonStartIndex);
        }
      }
    }
    
    // Step 1.6: Remove any unclosed tags that might be at the start
    // Remove patterns like "<think>" without closing tag
    // Do multiple passes to catch all variations
    for (let i = 0; i < 3; i++) {
      processed = processed.replace(/^<[^>]*redacted[^>]*>/gi, '');
      processed = processed.replace(/^<[^>]*reasoning[^>]*>/gi, '');
      processed = processed.replace(/^<[^>]*thinking[^>]*>/gi, '');
    }
    
    // Step 1.6: Remove any unclosed tags that might be at the start
    // Remove patterns like "<think>" without closing tag
    processed = processed.replace(/^<[^>]*redacted[^>]*>/gi, '');
    processed = processed.replace(/^<[^>]*reasoning[^>]*>/gi, '');
    processed = processed.replace(/^<[^>]*thinking[^>]*>/gi, '');
    
    // Step 2: Remove markdown code fence wrappers (```json, ```javascript, ```js, or just ```)
    processed = processed.replace(/^```(?:json|javascript|js)?\s*\n?/i, '');
    processed = processed.replace(/\n?```\s*$/, '');
    processed = processed.trim();
    
    // Step 3: Extract JSON array if it exists (this should be done after removing thinking content)
    const arrayMatch = processed.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      processed = arrayMatch[0];
    } else {
      // If no array found, try to find JSON object and wrap it in array
      const objectMatch = processed.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        processed = '[' + objectMatch[0] + ']';
      }
    }
    
    // Step 4: Remove any remaining non-JSON content before the array
    // Remove text before the first '[' or '{'
    const firstBracket = processed.indexOf('[');
    const firstBrace = processed.indexOf('{');
    let jsonStart = -1;
    
    if (firstBracket !== -1 && firstBrace !== -1) {
      jsonStart = Math.min(firstBracket, firstBrace);
    } else if (firstBracket !== -1) {
      jsonStart = firstBracket;
    } else if (firstBrace !== -1) {
      jsonStart = firstBrace;
    }
    
    if (jsonStart > 0) {
      processed = processed.substring(jsonStart);
    }
    
    // Step 5: Fix common format errors
    // Remove isolated strings after objects (e.g., },"string",)
    processed = processed.replace(/\},\s*"([^"]+)",\s*"id"/g, '}, {"id"');
    // Remove isolated strings at the end (e.g., },"string"])
    processed = processed.replace(/\},\s*"([^"]+)"\s*\]/g, '}]');
    // Fix incomplete objects (e.g., "id":"value","type":"line" missing {)
    processed = processed.replace(/,\s*"id"\s*:\s*"([^"]+)"\s*,\s*"type"\s*:\s*"line"/g, ', {"id": "$1", "type": "line"}');
    
    // Step 6: Final cleanup - remove any remaining non-JSON characters before parsing
    // More aggressive: remove everything before the first '[' or '{' if it contains tags
    const firstJsonChar = processed.search(/[\[{]/);
    if (firstJsonChar > 0) {
      const beforeJson = processed.substring(0, firstJsonChar);
      // If it contains '<' or '>', it's likely tags or thinking content, remove it
      if (beforeJson.includes('<') || beforeJson.includes('>')) {
        processed = processed.substring(firstJsonChar);
      }
    }
    
    // Step 7: Fix Chinese punctuation that might appear in JSON
    // Find pattern: }， followed by Chinese text - this indicates end of JSON
    const chineseCommaPattern = /}([，])/;
    const chineseCommaMatch = processed.match(chineseCommaPattern);
    if (chineseCommaMatch) {
      const matchIndex = processed.indexOf(chineseCommaMatch[0]);
      const afterMatch = processed.substring(matchIndex + chineseCommaMatch[0].length).trim();
      const hasChineseAfter = /[\u4e00-\u9fa5]/.test(afterMatch);
      
      // If followed by Chinese text, this is the end of JSON array
      if (hasChineseAfter) {
        // Check if we're inside an array (have '[' before this position)
        const beforeMatch = processed.substring(0, matchIndex);
        if (beforeMatch.includes('[')) {
          // Replace }， with ] and remove everything after
          processed = processed.substring(0, matchIndex) + ']';
        }
      }
    }
    
    // Step 7.5: Extract only the first complete JSON array/object
    // This handles cases where there might be multiple JSON objects or extra content after JSON
    // First, try to find the end of the first complete JSON structure
    let firstCompleteJsonEnd = findLastCompleteObject(processed);
    
    // If we found a complete JSON structure, extract only that part
    if (firstCompleteJsonEnd > 0) {
      if (firstCompleteJsonEnd < processed.length) {
        // There's content after the first complete JSON, extract only the JSON part
        processed = processed.substring(0, firstCompleteJsonEnd);
      }
    } else {
      // If findLastCompleteObject returned 0, JSON might be incomplete or followed by text
      // Try to find the first ']' that closes an array
      const arrayEnd = processed.indexOf(']');
      if (arrayEnd > 0) {
        // Check what comes after ']'
        const afterBracket = processed.substring(arrayEnd + 1).trim();
        if (afterBracket.length > 0) {
          // Check if the content after ']' looks like non-JSON
          const hasChinese = /[\u4e00-\u9fa5]/.test(afterBracket);
          const hasChinesePunctuation = /[，。；：！？]/.test(afterBracket);
          const looksLikeText = /^[^,\[\{\s]/.test(afterBracket);
          
          // If it looks like non-JSON content, extract only up to ']'
          if (hasChinese || hasChinesePunctuation || looksLikeText) {
            processed = processed.substring(0, arrayEnd + 1);
            firstCompleteJsonEnd = arrayEnd + 1;
          } else {
            // Try to parse the part before ']' to see if it's valid JSON
            const beforeArrayEnd = processed.substring(0, arrayEnd + 1);
            try {
              JSON.parse(beforeArrayEnd);
              // Valid JSON array found, extract it
              processed = beforeArrayEnd;
              firstCompleteJsonEnd = arrayEnd + 1;
            } catch {
              // Not a valid JSON, continue with other methods
            }
          }
        }
      } else {
        // No ']' found, but we have a '[' - might be incomplete JSON
        // Check if there's a '}' that might close the last object
        const lastBrace = processed.lastIndexOf('}');
        if (lastBrace > 0 && processed.indexOf('[') < lastBrace) {
          // Check what comes after '}'
          const afterBrace = processed.substring(lastBrace + 1).trim();
          if (afterBrace.length > 0) {
            const hasChinese = /[\u4e00-\u9fa5]/.test(afterBrace);
            const hasChinesePunctuation = /[，。；：！？]/.test(afterBrace);
            // If followed by Chinese text, close the array and extract
            if (hasChinese || hasChinesePunctuation) {
              processed = processed.substring(0, lastBrace + 1) + ']';
              firstCompleteJsonEnd = lastBrace + 2;
            }
          }
        }
      }
    }
    
    // Step 8: Fix unescaped double quotes within JSON string values
    try {
      // First, try to parse as-is to see if it's already valid
      JSON.parse(processed);
      return processed; // Already valid JSON, no need to fix
    } catch (e) {
      // JSON is invalid, try to fix unescaped quotes
      processed = fixUnescapedQuotes(processed);
      
      // Step 9: Try to fix incomplete JSON
      processed = fixIncompleteJson(processed);
      
      // Step 9.5: Extract only the first complete JSON again (after fixes)
      // More aggressive: find the first complete JSON and remove everything after it
      let completeJsonEnd = findLastCompleteObject(processed);
      
      // If we found a complete JSON, use it
      if (completeJsonEnd > 0 && completeJsonEnd < processed.length) {
        processed = processed.substring(0, completeJsonEnd);
      } else if (completeJsonEnd === 0) {
        // If no complete JSON found, try to find the first valid JSON ending
        // Look for ']' that might close an array, followed by non-JSON content
        const arrayEndIndex = processed.indexOf(']');
        if (arrayEndIndex > 0) {
          // Check if there's content after ']' that looks like non-JSON (Chinese text, etc.)
          const afterArrayEnd = processed.substring(arrayEndIndex + 1).trim();
          // If the next character after ']' is not whitespace, comma, or another JSON char,
          // it's likely non-JSON content
          if (afterArrayEnd.length > 0) {
            const nextChar = afterArrayEnd[0];
            // If next char is not a valid JSON continuation (comma, bracket, etc.)
            // and looks like Chinese or other text, extract only up to ']'
            if (!/[,\[\{\s]/.test(nextChar)) {
              processed = processed.substring(0, arrayEndIndex + 1);
            }
          }
        }
      }
      
      // Step 10: Final attempt - remove any remaining tags or non-JSON content
      // More aggressive cleanup: remove all tag-like content
      // Find the first valid JSON character
      const firstValidChar = processed.search(/[\[{]/);
      if (firstValidChar > 0) {
        // Remove everything before JSON start if it contains tags
        const beforeJson = processed.substring(0, firstValidChar);
        if (beforeJson.includes('<') || beforeJson.includes('>')) {
          processed = processed.substring(firstValidChar);
        }
      }
      
      // Also try to remove any remaining tag patterns that might have slipped through
      // Remove standalone tags like <think> that might be in the middle
      processed = processed.replace(/<redacted_reasoning[^>]*>[\s\S]*?<\/redacted_reasoning>/gi, '');
      processed = processed.replace(/<redacted_reasoning[^>]*\/>/gi, '');
      processed = processed.replace(/<[^>]*reasoning[^>]*>[\s\S]*?<\/[^>]*>/gi, '');
      processed = processed.replace(/<[^>]*reasoning[^>]*\/>/gi, '');
      
      // Remove any remaining unclosed tags (like just "<think>" without closing)
      // This is tricky - we need to find and remove tag-like patterns that aren't part of JSON strings
      // Strategy: find all <...> patterns and remove them if they're clearly not JSON
      // More aggressive: remove ALL tags that contain redacted, reasoning, thinking
      // Do this multiple times to catch nested or complex patterns
      let previousProcessed = '';
      let iterations = 0;
      while (previousProcessed !== processed && iterations < 5) {
        previousProcessed = processed;
        processed = processed.replace(/<[^>]*redacted[^>]*>/gi, '');
        processed = processed.replace(/<[^>]*reasoning[^>]*>/gi, '');
        processed = processed.replace(/<[^>]*thinking[^>]*>/gi, '');
        iterations++;
      }
      
      // Final pass: remove any remaining tag-like patterns before JSON
      // Find the first JSON character again after all cleaning
      const finalJsonStart = processed.search(/[\[{]/);
      if (finalJsonStart > 0) {
        const beforeFinalJson = processed.substring(0, finalJsonStart);
        // If it still contains tags, remove everything before JSON
        if (beforeFinalJson.includes('<') || beforeFinalJson.includes('>')) {
          processed = processed.substring(finalJsonStart);
        }
      }
      
      // One more aggressive pass: remove ALL tags before the first valid JSON
      // This handles cases where tags might be mixed with other text
      const veryFirstJson = processed.search(/[\[{]/);
      if (veryFirstJson > 0) {
        // Remove everything before JSON if it contains any '<' or '>'
        processed = processed.substring(veryFirstJson);
      }
      
      // Step 11: Final aggressive cleanup - remove any remaining tag-like patterns
      // This includes patterns that might have slipped through previous cleaning
      // Remove all standalone tag patterns (even if they appear in the middle)
      processed = processed.replace(/<[^>]*redacted[^>]*>/gi, '');
      processed = processed.replace(/<[^>]*reasoning[^>]*>/gi, '');
      processed = processed.replace(/<[^>]*thinking[^>]*>/gi, '');
      processed = processed.replace(/<[^>]*\/>/gi, ''); // Remove self-closing tags
      
      // Remove any remaining content before the first valid JSON character
      const lastJsonStart = processed.search(/[\[{]/);
      if (lastJsonStart > 0) {
        processed = processed.substring(lastJsonStart);
      }
      
      // If the string still starts with '<', it means there's a tag at the very beginning
      // Remove everything until we find a valid JSON character
      if (processed.trim().startsWith('<')) {
        const jsonStartAfterTag = processed.search(/[\[{]/);
        if (jsonStartAfterTag > 0) {
          processed = processed.substring(jsonStartAfterTag);
        } else {
          // If no JSON found after tag, try one more aggressive cleanup
          // Remove all remaining tag-like content
          processed = processed.replace(/<[^>]*>/g, '');
          processed = processed.trim();
          
          // Check again for JSON
          const finalJsonCheck = processed.search(/[\[{]/);
          if (finalJsonCheck >= 0) {
            processed = processed.substring(finalJsonCheck);
          } else {
            // Still no JSON found - this might be incomplete streaming data
            console.warn('No valid JSON found after removing tags, might be incomplete streaming data');
            // Return empty array as fallback, but don't throw error
            return '[]';
          }
        }
      }
      
      // Step 12: Extract only the first complete JSON before final parsing
      // This is critical: remove all content after the first complete JSON structure
      let finalCompleteJsonEnd = findLastCompleteObject(processed);
      
      if (finalCompleteJsonEnd > 0) {
        if (finalCompleteJsonEnd < processed.length) {
          // There's content after JSON, remove it
          processed = processed.substring(0, finalCompleteJsonEnd);
        }
      } else {
        // If findLastCompleteObject returned 0, try alternative method
        // Find the first ']' that might close an array
        const arrayEndIndex = processed.indexOf(']');
        if (arrayEndIndex > 0) {
          // Check what comes after ']'
          const afterBracket = processed.substring(arrayEndIndex + 1).trim();
          if (afterBracket.length > 0) {
            // Check if the content after ']' looks like non-JSON
            // (contains Chinese characters, Chinese punctuation, or explanatory text)
            const hasChinese = /[\u4e00-\u9fa5]/.test(afterBracket);
            const hasChinesePunctuation = /[，。；：！？]/.test(afterBracket);
            const looksLikeText = /^[^,\[\{\s]/.test(afterBracket);
            
            // If it looks like non-JSON content, extract only up to ']'
            if (hasChinese || hasChinesePunctuation || looksLikeText) {
              processed = processed.substring(0, arrayEndIndex + 1);
            }
          }
        }
      }
      
      // Step 13: Try parsing again
      try {
        JSON.parse(processed);
        return processed;
      } catch (e2) {
        // If still invalid, try to extract valid part
        const lastCompletePos = findLastCompleteObject(processed);
        if (lastCompletePos > 0) {
          // Extract only up to the last complete position
          processed = processed.substring(0, lastCompletePos);
          // If it doesn't end with ']', try to close it if it's an array
          if (!processed.trim().endsWith(']') && processed.trim().startsWith('[')) {
            processed = processed.trim();
            // Remove trailing comma if present
            processed = processed.replace(/,\s*$/, '');
            processed += ']';
          }
          try {
            JSON.parse(processed);
            return processed;
          } catch (e3) {
            console.error('Failed to fix JSON after removing thinking content:', e3);
            console.error('Processed code (first 500 chars):', processed.substring(0, 500));
            console.error('Original error:', e);
            return '[]'; // Return empty array as fallback
          }
        }
        console.error('Failed to fix JSON:', e2);
        console.error('Processed code (first 500 chars):', processed.substring(0, 500));
        console.error('Original error:', e);
        return '[]'; // Return empty array as fallback
      }
    }
  };

  // Helper function to fix unescaped quotes in JSON strings
  const fixUnescapedQuotes = (jsonString) => {
    let result = '';
    let inString = false;
    let escapeNext = false;
    
    for (let i = 0; i < jsonString.length; i++) {
      const char = jsonString[i];
      
      if (escapeNext) {
        result += char;
        escapeNext = false;
        continue;
      }
      
      if (char === '\\') {
        result += char;
        escapeNext = true;
        continue;
      }
      
      if (char === '"') {
        if (!inString) {
          // Starting a string
          inString = true;
          result += char;
        } else {
          // Potentially ending a string
          // Check if this is a structural quote (followed by : or , or } or ])
          const nextNonWhitespace = jsonString.slice(i + 1).match(/^\s*(.)/);
          const nextChar = nextNonWhitespace ? nextNonWhitespace[1] : '';
          
          if (nextChar === ':' || nextChar === ',' || nextChar === '}' || nextChar === ']' || nextChar === '') {
            // This is a closing quote for the string
            inString = false;
            result += char;
          } else {
            // This is an unescaped quote within the string - escape it
            result += '\\"';
          }
        }
      } else {
        result += char;
      }
    }
    
    return result;
  };

  // Helper function to fix incomplete JSON
  const fixIncompleteJson = (jsonString) => {
    let openBraces = 0;
    let closeBraces = 0;
    let openBrackets = 0;
    let closeBrackets = 0;
    
    for (const char of jsonString) {
      if (char === '{') openBraces++;
      else if (char === '}') closeBraces++;
      else if (char === '[') openBrackets++;
      else if (char === ']') closeBrackets++;
    }
    
    let result = jsonString;
    if (openBraces > closeBraces) {
      result += '}'.repeat(openBraces - closeBraces);
    }
    if (openBrackets > closeBrackets) {
      result += ']'.repeat(openBrackets - closeBrackets);
    }
    
    return result;
  };

  // Helper function to find first complete JSON structure (array or object)
  // Returns the position after the first complete JSON structure
  const findLastCompleteObject = (jsonString) => {
    let depth = 0;
    let inString = false;
    let escapeNext = false;
    let startChar = null; // Track if we started with '[' or '{'
    let lastCompletePos = 0;
    
    // Find the first JSON character
    const firstJsonChar = jsonString.search(/[\[{]/);
    if (firstJsonChar === -1) return 0;
    
    startChar = jsonString[firstJsonChar];
    
    for (let i = firstJsonChar; i < jsonString.length; i++) {
      const char = jsonString[i];
      
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      
      if (char === '\\') {
        escapeNext = true;
        continue;
      }
      
      if (char === '"') {
        inString = !inString;
        continue;
      }
      
      if (inString) continue;
      
      if (char === '{' || char === '[') {
        depth++;
      } else if (char === '}' || char === ']') {
        depth--;
        if (depth === 0) {
          // Found the end of the first complete JSON structure
          lastCompletePos = i + 1;
          break; // Stop at the first complete structure
        }
      }
    }
    
    return lastCompletePos;
  };

  // Handle sending a message (single-turn)
  const handleSendMessage = async (userMessage, chartType = 'auto') => {
    if (!isConfigValid(config)) {
      alert('请先配置您的 LLM 提供商');
      setIsConfigModalOpen(true);
      return;
    }

    setIsGenerating(true);
    setApiError(null); // Clear previous errors
    setJsonError(null); // Clear previous JSON errors
    setGenerationProgress({ message: '正在生成图表...', progress: null }); // Reset progress
    setPlannerOutput(null); // Reset planner output for new generation

    try {
      // 处理图片输入
      let imageData = null;
      let textInput = userMessage;
      
      if (typeof userMessage === 'object' && userMessage.image) {
        // 图片输入
        imageData = userMessage.image;
        textInput = userMessage.text || '';
      }

      // 判断是否为修改模式：如果有已生成的代码，且用户没有明确要求新建，则使用修改模式
      const shouldUseModifyMode = isModifyMode && generatedCode && generatedCode.trim().length > 0;
      const currentCodeForRequest = shouldUseModifyMode ? generatedCode : null;

      // 添加用户消息到对话历史
      const userMsg = {
        role: 'user',
        content: textInput,
        timestamp: new Date().toISOString()
      };
      setConversationHistory(prev => [...prev, userMsg]);

      // Call backend API with streaming
      const { generateChart } = await import('@/lib/api-client');
      const response = await generateChart({
        config,
        userInput: textInput,
        chartType,
        image: imageData,
        currentCode: currentCodeForRequest, // 只在修改模式下传递当前代码
        stream: true,
      });

      if (!response.ok) {
        // Parse error response body if available
        let errorMessage = '生成代码失败';
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (e) {
          // If response body is not JSON, use status-based messages
          switch (response.status) {
            case 400:
              errorMessage = '请求参数错误，请检查输入内容';
              break;
            case 401:
            case 403:
              errorMessage = 'API 密钥无效或权限不足，请检查配置';
              break;
            case 429:
              errorMessage = '请求过于频繁，请稍后再试';
              break;
            case 500:
            case 502:
            case 503:
              errorMessage = '服务器错误，请稍后重试';
              break;
            default:
              errorMessage = `请求失败 (${response.status})`;
          }
        }
        throw new Error(errorMessage);
      }

      // Process streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedCode = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        // SSE 解析：处理 event 和 data 行
        let currentEvent = null;
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed === '' || trimmed === 'data: [DONE]') continue;

          // 处理 event 行
          if (trimmed.startsWith('event: ')) {
            currentEvent = trimmed.slice(7).trim();
            continue;
          }

              // 处理 data 行
          if (trimmed.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmed.slice(6));
              
              // 处理 plan 事件 - 显示规划分析
              if (currentEvent === 'plan') {
                setPlannerOutput(data);
              }

              // 处理 progress 事件 - 显示进度
              if (currentEvent === 'progress' && data.stage) {
                setGenerationProgress({
                  message: data.message || '正在处理...',
                  progress: data.progress || null
                });
              }
              
              // 处理 chunk 事件 - 实时更新代码
              // 流式过程中只做基本清理，不尝试解析不完整的 JSON
              if (currentEvent === 'chunk' && data.content) {
                accumulatedCode += data.content;
                const processedCode = postProcessExcalidrawCode(accumulatedCode, true);
                setGeneratedCode(processedCode);
              }
              
              // 处理 done 事件 - 后端返回的最终优化代码
              if (currentEvent === 'done' && data.code) {
                setGenerationProgress({ message: '完成！', progress: 100 });
                accumulatedCode = data.code;
                const processedCode = postProcessExcalidrawCode(accumulatedCode);
                setGeneratedCode(processedCode);
                tryParseAndApply(processedCode);
                
                // 后端已经优化，但前端可以再次优化以确保最佳效果
                const optimizedCode = optimizeExcalidrawCode(processedCode);
                setGeneratedCode(optimizedCode);
                tryParseAndApply(optimizedCode);
                
                // 添加AI响应到对话历史
                const aiMsg = {
                  role: 'assistant',
                  content: '图表已生成',
                  timestamp: new Date().toISOString(),
                  plannerOutput: plannerOutput
                };
                setConversationHistory(prev => [...prev, aiMsg]);
              }
              
              // 处理错误
              if (data.error) {
                throw new Error(data.error);
              }
            } catch (e) {
              // SSE parsing errors - show to user
              if (e.message && !e.message.includes('Unexpected')) {
                setApiError('数据流解析错误：' + e.message);
              }
              console.error('Failed to parse SSE:', e);
            }
            // 重置 event
            currentEvent = null;
          }
        }
      }

      // 如果流式响应中没有收到 done 事件，手动处理
      if (accumulatedCode) {
        setGenerationProgress({ message: '完成！', progress: 100 });
        const processedCode = postProcessExcalidrawCode(accumulatedCode);
        tryParseAndApply(processedCode);

        // 后端已经优化，但前端也可以再次优化以确保最佳效果
        const optimizedCode = optimizeExcalidrawCode(processedCode);
        setGeneratedCode(optimizedCode);
        tryParseAndApply(optimizedCode);
      }
    } catch (error) {
      setGenerationProgress({ message: '生成失败', progress: null });
      console.error('Error generating code:', error);
      // Check if it's a network error
      if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
        setApiError('网络连接失败，请检查网络连接');
      } else {
        setApiError(error.message);
      }
    } finally {
      setIsGenerating(false);
      // 延迟重置进度，让用户看到完成状态
      setTimeout(() => {
        setGenerationProgress({ message: '正在生成图表...', progress: null });
      }, 1000);
    }
  };

  // Try to parse and apply code to canvas
  const tryParseAndApply = (code) => {
    try {
      // Clear previous JSON errors
      setJsonError(null);

      // Code is already post-processed, just extract the array and parse
      const cleanedCode = code.trim();

      // Extract array from code if wrapped in other text
      const arrayMatch = cleanedCode.match(/\[[\s\S]*\]/);
      if (!arrayMatch) {
        setJsonError('代码中未找到有效的 JSON 数组');
        console.error('No array found in generated code');
        return;
      }

      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed)) {
        console.log('tryParseAndApply: Parsed elements:', parsed.length, parsed);
        setElements(parsed);
        setJsonError(null); // Clear error on success
      } else {
        console.error('tryParseAndApply: Parsed result is not an array:', parsed);
        setJsonError('解析结果不是数组格式');
      }
    } catch (error) {
      console.error('Failed to parse generated code:', error);
      // Extract native JSON error message
      if (error instanceof SyntaxError) {
        setJsonError('JSON 语法错误：' + error.message);
      } else {
        setJsonError('解析失败：' + error.message);
      }
    }
  };

  // Handle applying code from editor
  const handleApplyCode = async () => {
    setIsApplyingCode(true);
    try {
      // Simulate async operation for better UX
      await new Promise(resolve => setTimeout(resolve, 300));
      tryParseAndApply(generatedCode);
    } catch (error) {
      console.error('Error applying code:', error);
    } finally {
      setIsApplyingCode(false);
    }
  };

  // Handle optimizing code
  const handleOptimizeCode = async () => {
    setIsOptimizingCode(true);
    try {
      // Simulate async operation for better UX
      await new Promise(resolve => setTimeout(resolve, 500));
      const optimizedCode = optimizeExcalidrawCode(generatedCode);
      setGeneratedCode(optimizedCode);
      tryParseAndApply(optimizedCode);
    } catch (error) {
      console.error('Error optimizing code:', error);
    } finally {
      setIsOptimizingCode(false);
    }
  };

  // Handle clearing code
  const handleClearCode = () => {
    setGeneratedCode('');
  };

  // Handle saving config - refresh from backend
  const handleSaveConfig = async (newConfig) => {
    try {
      // Reload configs from backend to ensure sync
      await loadConfigs();
      // Set the new config if provided
      if (newConfig) {
        setConfig(newConfig);
      } else {
        // Otherwise get current config
        const currentConfig = await getConfig();
        if (currentConfig) {
          setConfig(currentConfig);
        }
      }
    } catch (error) {
      console.error('Failed to refresh configs:', error);
    }
  };

  // Handle toggling left panel visibility
  const toggleLeftPanel = () => {
    setIsLeftPanelVisible(!isLeftPanelVisible);
  };

  // Handle horizontal resizing (left panel vs right panel)
  const handleHorizontalMouseDown = (e) => {
    setIsResizingHorizontal(true);
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizingHorizontal) return;
      
      const percentage = (e.clientX / window.innerWidth) * 100;
      
      // Clamp between 30% and 70%
      setLeftPanelWidth(Math.min(Math.max(percentage, 30), 70));
    };

    const handleMouseUp = () => {
      setIsResizingHorizontal(false);
    };

    if (isResizingHorizontal) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingHorizontal]);

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Smart Excalidraw</h1>
          <p className="text-xs text-gray-500">AI 驱动的图表生成</p>
        </div>
        <div className="flex items-center space-x-3">
          {config && isConfigValid(config) && (
            <div className="flex items-center space-x-2 px-3 py-1.5 bg-gray-50 rounded border border-gray-300">
              <div className="w-2 h-2 bg-gray-900 rounded-full"></div>
              <span className="text-xs text-gray-900 font-medium">
                {config.name || config.type} - {config.model}
              </span>
              {allConfigs.providers.length > 1 && (
                <div className="relative group">
                  <button className="text-gray-500 hover:text-gray-700">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                    <div className="py-1">
                      {allConfigs.providers.map((provider) => (
                        <button
                          key={provider.id}
                          onClick={async () => {
                            try {
                              // 保存到后端
                              await setCurrentProvider(provider.id);
                              // 重新加载配置
                              await loadConfigs();
                              // 获取最新配置
                              const currentConfig = await getConfig();
                              if (currentConfig) {
                                setConfig(currentConfig);
                              }
                            } catch (error) {
                              console.error('Failed to switch provider:', error);
                            }
                          }}
                          className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                            allConfigs.currentProviderId === provider.id ? 'bg-gray-100 font-medium' : ''
                          }`}
                        >
                          {provider.name}
                          {allConfigs.currentProviderId === provider.id && (
                            <span className="ml-2 text-xs text-gray-500">(当前)</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => setIsConfigModalOpen(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-900 border border-gray-900 rounded hover:bg-gray-800 transition-colors duration-200"
          >
            配置 LLM
          </button>
        </div>
      </header>

      {/* Main Content - Two Column Layout */}
      <div className="flex flex-1 overflow-hidden pb-1 relative">
        {/* Left Panel - Chat and Code Editor */}
        {isLeftPanelVisible && (
          <div id="left-panel" style={{ width: `${leftPanelWidth}%` }} className="flex flex-col border-r border-gray-200 bg-white">
          {/* API Error Banner */}
          {apiError && (
            <div className="bg-red-50 border-b border-red-200 px-4 py-3 flex items-start justify-between">
              <div className="flex items-start space-x-2">
                <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-red-800">请求失败</p>
                  <p className="text-sm text-red-700 mt-1">{apiError}</p>
                </div>
              </div>
              <button
                onClick={() => setApiError(null)}
                className="text-red-600 hover:text-red-800 transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          )}

          {/* Input Section - 现在占满整个左侧面板 */}
          <div className="flex-1 overflow-hidden">
            <Chat
              onSendMessage={handleSendMessage}
              isGenerating={isGenerating}
              plannerOutput={plannerOutput}
              conversationHistory={conversationHistory}
              isModifyMode={isModifyMode}
              onToggleModifyMode={setIsModifyMode}
              hasExistingChart={generatedCode && generatedCode.trim().length > 0}
            />
          </div>
          </div>
        )}

        {/* Floating Code Editor */}
        <FloatingCodeEditor
          code={generatedCode}
          onChange={setGeneratedCode}
          onApply={handleApplyCode}
          onOptimize={handleOptimizeCode}
          onClear={handleClearCode}
          jsonError={jsonError}
          onClearJsonError={() => setJsonError(null)}
          isGenerating={isGenerating}
          isApplyingCode={isApplyingCode}
          isOptimizingCode={isOptimizingCode}
        />

        {/* Toggle Button for Left Panel */}
        <button
          onClick={toggleLeftPanel}
          className="absolute left-0 top-1/2 transform -translate-y-1/2 z-10 bg-white border border-gray-300 rounded-r-md shadow-md p-2 hover:bg-gray-50 transition-colors duration-200"
          style={{ left: isLeftPanelVisible ? `${leftPanelWidth}%` : '0' }}
        >
          <svg
            className="w-5 h-5 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            style={{ transform: isLeftPanelVisible ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Horizontal Resizer - Only show when left panel is visible */}
        {isLeftPanelVisible && (
          <div
            onMouseDown={handleHorizontalMouseDown}
            className="w-1 bg-gray-200 hover:bg-gray-400 cursor-col-resize transition-colors duration-200 flex-shrink-0"
          />
        )}

        {/* Right Panel - Excalidraw Canvas */}
        <div style={{ width: isLeftPanelVisible ? `${100 - leftPanelWidth}%` : '100%' }} className="bg-gray-50 relative">
          <ExcalidrawCanvas elements={elements} />
          
          {/* Progress Overlay */}
          {isGenerating && (
            <div className="absolute top-4 left-4 right-4 z-50">
              <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
                <div className="flex items-center space-x-3">
                  <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{generationProgress.message}</p>
                    {generationProgress.progress !== null && (
                      <div className="mt-2">
                        <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-gray-900 h-1.5 rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${generationProgress.progress}%` }}
                          ></div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{generationProgress.progress}%</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Config Modal */}
      <ConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        onSave={handleSaveConfig}
        initialConfig={config}
      />
      
      {/* Contact Modal */}
      <ContactModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
      />
      
      {/* Code Editor Floating Modal */}
      {isCodeEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setIsCodeEditorOpen(false)}>
          <div 
            className="bg-white rounded-lg shadow-2xl w-[90vw] h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <CodeEditor
              code={generatedCode}
              onChange={setGeneratedCode}
              onApply={() => {
                handleApplyCode();
                setIsCodeEditorOpen(false);
              }}
              onOptimize={handleOptimizeCode}
              onClear={handleClearCode}
              jsonError={jsonError}
              onClearJsonError={() => setJsonError(null)}
              isGenerating={isGenerating}
              isApplyingCode={isApplyingCode}
              isOptimizingCode={isOptimizingCode}
              onClose={() => setIsCodeEditorOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
