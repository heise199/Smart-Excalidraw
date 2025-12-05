/**
 * 后端 API 客户端
 * 统一管理所有后端 API 调用
 */

// 后端 API 基础 URL
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
const API_BASE = `${BACKEND_URL}/api/v1`;

/**
 * 生成图表代码
 * @param {Object} params - 请求参数
 * @param {Object} params.config - LLM 配置
 * @param {string} params.userInput - 用户输入
 * @param {string} params.chartType - 图表类型
 * @param {Object} params.image - 图片数据（可选）
 * @param {boolean} params.stream - 是否流式响应（默认 true）
 * @returns {Promise<Response>} Fetch Response 对象
 */
export async function generateChart({ config, userInput, chartType = 'auto', image = null, stream = true }) {
  const response = await fetch(`${API_BASE}/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      config,
      userInput,
      chartType,
      image: image ? {
        data: image.data,
        mimeType: image.mimeType,
        dimensions: image.dimensions,
        size: image.size,
        name: image.name,
      } : null,
      stream,
      useMcp: false,
      mcpContext: null,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.detail || `HTTP ${response.status}`);
  }

  return response;
}

/**
 * 获取可用模型列表
 * @param {string} type - 提供商类型
 * @param {string} baseUrl - 基础 URL
 * @param {string} apiKey - API 密钥
 * @returns {Promise<Array>} 模型列表
 */
export async function fetchModels(type, baseUrl, apiKey) {
  const params = new URLSearchParams({
    type,
    baseUrl,
    apiKey: apiKey || '', // Ollama 可能不需要 API key
  });

  const response = await fetch(`${API_BASE}/models?${params}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.detail || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.models || [];
}

/**
 * 获取所有配置
 * @returns {Promise<Object>} 配置对象 { providers, currentProviderId }
 */
export async function getAllConfigs() {
  const url = `${API_BASE}/config`;
  
  try {
    const response = await fetch(url);

    if (!response.ok) {
      // 如果是 404，提供更详细的错误信息
      if (response.status === 404) {
        throw new Error(
          `后端 API 未找到。请确保：\n` +
          `1. 后端服务正在运行 (${BACKEND_URL})\n` +
          `2. 后端路由已正确注册 (/api/v1/config)\n` +
          `3. 环境变量 NEXT_PUBLIC_BACKEND_URL 已正确设置`
        );
      }
      
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.detail || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    // 如果是网络错误，提供更友好的提示
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error(
        `无法连接到后端服务 (${BACKEND_URL})。请确保：\n` +
        `1. 后端服务正在运行\n` +
        `2. 后端地址配置正确\n` +
        `3. 没有防火墙阻止连接`
      );
    }
    throw error;
  }
}

/**
 * 保存配置
 * @param {Object} configData - 配置数据
 * @param {Array} configData.providers - 提供商配置数组
 * @param {string} configData.currentProviderId - 当前提供商 ID
 * @returns {Promise<Object>} 保存结果
 */
export async function saveAllConfigs(configData) {
  const response = await fetch(`${API_BASE}/config`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      providers: configData.providers,
      currentProviderId: configData.currentProviderId,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.detail || `HTTP ${response.status}`);
  }

  return await response.json();
}

/**
 * 检查后端连接
 * @returns {Promise<boolean>} 是否连接成功
 */
export async function checkBackendConnection() {
  try {
    const response = await fetch(`${BACKEND_URL}/health`);
    return response.ok;
  } catch (error) {
    console.error('Backend connection check failed:', error);
    return false;
  }
}







