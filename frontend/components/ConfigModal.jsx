'use client';

import { useState, useEffect } from 'react';
import { getAllConfigs, saveProvider, deleteProvider, setCurrentProvider } from '@/lib/config';

// 获取默认的 baseUrl
const getDefaultBaseUrl = (type) => {
  const defaults = {
    openai: 'https://api.openai.com/v1',
    anthropic: 'https://api.anthropic.com/v1',
    google: 'https://generativelanguage.googleapis.com/v1',
    mistral: 'https://api.mistral.ai/v1',
    ollama: 'http://localhost:11434',
    qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    custom: 'https://api.openai.com/v1',
  };
  return defaults[type] || '';
};

// 获取提供商显示名称
const getProviderDisplayName = (type) => {
  const names = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    google: 'Google (Gemini)',
    mistral: 'Mistral',
    ollama: 'Ollama',
    qwen: 'Qwen (通义千问)',
    custom: 'Custom',
  };
  return names[type] || type;
};

export default function ConfigModal({ isOpen, onClose, onSave, initialConfig }) {
  const [config, setConfig] = useState({
    id: '',
    name: '',
    type: 'openai',
    baseUrl: getDefaultBaseUrl('openai'),
    apiKey: '',
    model: '',
  });
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [useCustomModel, setUseCustomModel] = useState(false);
  const [activeTab, setActiveTab] = useState('edit'); // 'edit' or 'manage'
  const [allConfigs, setAllConfigs] = useState({ providers: [], currentProviderId: null });

  // Load all configs when modal opens
  useEffect(() => {
    if (isOpen) {
      loadConfigs();
    }
  }, [isOpen]);

  const loadConfigs = async () => {
    try {
      const configs = await getAllConfigs();
      setAllConfigs(configs);
    } catch (error) {
      console.error('Failed to load configs:', error);
      setError('加载配置失败');
    }
  };

  // 仅在初始配置变更时同步到本地表单状态，避免在模型加载失败时还原用户输入
  useEffect(() => {
    if (initialConfig) {
      setConfig(initialConfig);
    } else {
      // Reset form for new provider
      setConfig({
        id: '',
        name: '',
        type: 'openai',
        baseUrl: getDefaultBaseUrl('openai'),
        apiKey: '',
        model: '',
      });
    }
  }, [initialConfig]);

  // 根据当前表单中的模型与可用模型列表，决定是否使用自定义输入
  useEffect(() => {
    // 如果模型列表为空，默认使用手动输入模式
    if (models.length === 0) {
      setUseCustomModel(true);
      return;
    }
    
    // 如果当前有模型值，检查是否在列表中
    if (config.model) {
      const exists = models.some(m => m.id === config.model);
      setUseCustomModel(!exists);
    } else {
      // 没有模型值，使用列表选择模式
      setUseCustomModel(false);
    }
  }, [models, config.model]);

  const handleLoadModels = async () => {
    // Ollama 可能不需要 API key，所以只检查 type 和 baseUrl
    if (!config.type || !config.baseUrl) {
      setError('请先填写提供商类型和基础 URL');
      return;
    }
    
    // 非 Ollama 提供商需要 API key
    if (config.type !== 'ollama' && !config.apiKey) {
      setError('请先填写 API 密钥');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        type: config.type,
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
      });

      // 使用后端 API
      const { fetchModels } = await import('@/lib/api-client');
      const models = await fetchModels(config.type, config.baseUrl, config.apiKey);

      setModels(models);
      
      // 如果模型列表为空，默认使用手动输入模式
      if (models.length === 0) {
        setUseCustomModel(true);
        // 如果当前没有模型值，保持为空让用户输入
        if (!config.model) {
          setConfig(prev => ({ ...prev, model: '' }));
        }
      } else {
        // 有模型列表时，根据当前模型是否在列表中决定模式
        if (config.model && !models.some(m => m.id === config.model)) {
          // 当前模型不在列表中，使用手动输入模式
          setUseCustomModel(true);
        } else if (!config.model || config.model.trim() === '') {
          // 如果没有选择模型，自动选择第一个并切换到列表选择模式
          setUseCustomModel(false);
          setConfig(prev => ({ ...prev, model: models[0].id }));
        } else {
          // 如果模型在列表中，使用列表选择模式
          setUseCustomModel(false);
        }
      }
    } catch (err) {
      setError(err.message);
      setModels([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // 验证必填字段
    const missingFields = [];
    if (!config.type) missingFields.push('提供商类型');
    if (!config.baseUrl) missingFields.push('基础 URL');
    if (!config.model || config.model.trim() === '') missingFields.push('模型');
    
    if (missingFields.length > 0) {
      setError(`请填写所有必填字段：${missingFields.join('、')}`);
      return;
    }
    
    // 非 Ollama 提供商需要 API key
    if (config.type !== 'ollama' && (!config.apiKey || config.apiKey.trim() === '')) {
      setError('请填写 API 密钥');
      return;
    }

    try {
      // 保存到后端
      await saveProvider(config, true);
      // 重新加载配置列表
      await loadConfigs();
      // 通知父组件刷新
      const { getConfig } = await import('@/lib/config');
      const savedConfig = await getConfig();
      onSave(savedConfig || config);
      onClose();
    } catch (error) {
      console.error('Failed to save config:', error);
      setError('保存配置失败: ' + (error.message || '未知错误'));
    }
  };

  const handleDeleteProvider = async (providerId) => {
    if (confirm('确定要删除此配置吗？')) {
      try {
        // 删除并保存到后端
        await deleteProvider(providerId);
        // 重新加载配置列表
        await loadConfigs();
        
        // 如果删除的是当前配置，通知父组件刷新
        if (allConfigs.currentProviderId === providerId) {
          const { getConfig } = await import('@/lib/config');
          const newConfig = await getConfig();
          onSave(newConfig);
        }
      } catch (error) {
        console.error('Failed to delete provider:', error);
        setError('删除配置失败: ' + (error.message || '未知错误'));
      }
    }
  };

  const handleSetCurrentProvider = async (providerId) => {
    try {
      // 保存到后端
      await setCurrentProvider(providerId);
      // 重新加载配置列表
      await loadConfigs();
      
      // 获取最新的配置并通知父组件
      const { getConfig } = await import('@/lib/config');
      const currentConfig = await getConfig();
      onSave(currentConfig);
    } catch (error) {
      console.error('Failed to set current provider:', error);
      setError('切换配置失败: ' + (error.message || '未知错误'));
    }
  };

  const handleEditProvider = (provider) => {
    setConfig(provider);
    setActiveTab('edit');
  };

  const handleAddNewProvider = () => {
    setConfig({
      id: '',
      name: '',
      type: 'openai',
      baseUrl: getDefaultBaseUrl('openai'),
      apiKey: '',
      model: '',
    });
    setModels([]);
    setActiveTab('edit');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded border border-gray-300 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">LLM 配置管理</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('edit')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors duration-200 ${
              activeTab === 'edit'
                ? 'bg-white text-gray-900 border-b-2 border-gray-900'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            {config.id ? '编辑配置' : '添加配置'}
          </button>
          <button
            onClick={() => setActiveTab('manage')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors duration-200 ${
              activeTab === 'manage'
                ? 'bg-white text-gray-900 border-b-2 border-gray-900'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            管理配置 ({allConfigs.providers.length})
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          {activeTab === 'edit' ? (
            <div className="space-y-4">
          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Provider Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              提供商名称
            </label>
            <input
              type="text"
              value={config.name}
              onChange={(e) => setConfig({ ...config, name: e.target.value })}
              placeholder="例如：我的 OpenAI"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>

          {/* Provider Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              提供商类型 <span className="text-red-500">*</span>
            </label>
            <select
              value={config.type}
              onChange={(e) => {
                const newType = e.target.value;
                setConfig({ 
                  ...config, 
                  type: newType, 
                  model: '',
                  // 根据类型设置默认 baseUrl
                  baseUrl: getDefaultBaseUrl(newType)
                });
                // 切换类型时清空模型列表
                setModels([]);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="google">Google (Gemini)</option>
              <option value="mistral">Mistral</option>
              <option value="ollama">Ollama</option>
              <option value="qwen">Qwen (通义千问)</option>
              <option value="custom">Custom (OpenAI 兼容)</option>
            </select>
          </div>

          {/* Base URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              基础 URL <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={config.baseUrl}
              onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
              placeholder={getDefaultBaseUrl(config.type)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            <p className="text-xs text-gray-500 mt-1">
              {config.type === 'ollama' && 'Ollama 本地服务地址，默认: http://localhost:11434'}
              {config.type === 'qwen' && '通义千问 API 地址，默认: https://dashscope.aliyuncs.com/compatible-mode/v1'}
              {config.type === 'custom' && 'OpenAI 兼容的 API 地址'}
            </p>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API 密钥 {config.type !== 'ollama' && <span className="text-red-500">*</span>}
              {config.type === 'ollama' && <span className="text-gray-500 text-xs">(可选)</span>}
            </label>
            <input
              type="password"
              value={config.apiKey}
              onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
              placeholder={
                config.type === 'openai' ? 'sk-...' :
                config.type === 'anthropic' ? 'sk-ant-...' :
                config.type === 'google' ? 'AIza...' :
                config.type === 'mistral' ? 'mistral-...' :
                config.type === 'qwen' ? 'sk-...' :
                config.type === 'ollama' ? 'Ollama 通常不需要 API key' :
                'API Key'
              }
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            {config.type === 'ollama' && (
              <p className="text-xs text-gray-500 mt-1">Ollama 本地服务通常不需要 API 密钥</p>
            )}
          </div>

          {/* Load Models Button */}
          <div>
            <button
              onClick={handleLoadModels}
              disabled={loading}
              className="w-full px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 disabled:bg-gray-50 disabled:text-gray-400 transition-colors duration-200 font-medium"
            >
              {loading ? '加载模型中...' : '加载可用模型'}
            </button>
          </div>

          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              模型 <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-500 mb-2">
              {config.type === 'openai' && '推荐: gpt-4, gpt-4-turbo, gpt-3.5-turbo'}
              {config.type === 'anthropic' && '推荐: claude-3-5-sonnet-20241022, claude-3-opus-20240229'}
              {config.type === 'google' && '推荐: gemini-pro, gemini-1.5-pro'}
              {config.type === 'mistral' && '推荐: mistral-large-latest, mistral-medium-latest'}
              {config.type === 'ollama' && '推荐: llama2, mistral, codellama'}
              {config.type === 'qwen' && '推荐: qwen-turbo, qwen-plus, qwen-max'}
              {config.type === 'custom' && '输入您的模型名称'}
            </p>

            {/* Toggle between selection and custom input */}
            {models.length > 0 && (
              <div className="mb-2 flex items-center space-x-4">
                 <label className="flex items-center cursor-pointer">
                   <input
                     type="radio"
                     checked={!useCustomModel}
                     onChange={() => {
                       setUseCustomModel(false);
                       // 如果当前没有模型值或模型不在列表中，选择第一个
                       if (models.length > 0) {
                         const currentModelInList = config.model && models.some(m => m.id === config.model);
                         if (!currentModelInList) {
                           setConfig({ ...config, model: models[0].id });
                         }
                       }
                     }}
                     className="mr-2"
                   />
                   <span className="text-sm text-gray-700">从列表选择</span>
                 </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    checked={useCustomModel}
                    onChange={() => {
                      setUseCustomModel(true);
                      setConfig({ ...config, model: '' });
                    }}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">手动输入</span>
                </label>
              </div>
            )}

            {/* Model Selection Dropdown */}
            {models.length > 0 && !useCustomModel && (
              <select
                value={config.model || ''}
                onChange={(e) => {
                  const selectedModel = e.target.value;
                  setConfig({ ...config, model: selectedModel });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                <option value="">请选择模型</option>
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
            )}

            {/* Custom Model Input */}
            {(useCustomModel || models.length === 0) && (
              <input
                type="text"
                value={config.model}
                onChange={(e) => setConfig({ ...config, model: e.target.value })}
                placeholder="例如：gpt-4、claude-3-opus-20240229"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            )}
          </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-medium text-gray-900">已保存的配置</h3>
                <button
                  onClick={handleAddNewProvider}
                  className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded hover:bg-gray-800 transition-colors duration-200"
                >
                  添加新配置
                </button>
              </div>

              {allConfigs.providers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>暂无配置</p>
                  <button
                    onClick={handleAddNewProvider}
                    className="mt-2 text-sm text-gray-900 hover:underline"
                  >
                    添加第一个配置
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {allConfigs.providers.map((provider) => (
                    <div
                      key={provider.id}
                      className={`p-3 border rounded-lg ${
                        allConfigs.currentProviderId === provider.id
                          ? 'border-gray-900 bg-gray-50'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <h4 className="font-medium text-gray-900">{provider.name}</h4>
                            {allConfigs.currentProviderId === provider.id && (
                              <span className="px-2 py-0.5 text-xs bg-gray-900 text-white rounded">当前</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            {getProviderDisplayName(provider.type)} - {provider.model}
                          </p>
                          <p className="text-xs text-gray-500 mt-1 truncate">{provider.baseUrl}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          {allConfigs.currentProviderId !== provider.id && (
                            <button
                              onClick={() => handleSetCurrentProvider(provider.id)}
                              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors duration-200"
                            >
                              设为当前
                            </button>
                          )}
                          <button
                            onClick={() => handleEditProvider(provider)}
                            className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors duration-200"
                          >
                            编辑
                          </button>
                          <button
                            onClick={() => handleDeleteProvider(provider.id)}
                            className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors duration-200"
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer - Only show on edit tab */}
        {activeTab === 'edit' && (
          <div className="flex justify-end space-x-3 px-6 py-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors duration-200"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-white bg-gray-900 rounded hover:bg-gray-800 transition-colors duration-200"
            >
              {config.id ? '更新配置' : '保存配置'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

