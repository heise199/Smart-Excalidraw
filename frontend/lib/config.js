/**
 * Configuration management for LLM providers
 * Uses Python backend API instead of Next.js API routes
 */
import { getAllConfigs as fetchAllConfigs, saveAllConfigs as saveConfigs } from '@/lib/api-client';

/**
 * Get all provider configurations from server
 * @returns {Promise<Object>} Object with providers array and currentProviderId
 */
export async function getAllConfigs() {
  try {
    return await fetchAllConfigs();
  } catch (error) {
    console.error('Failed to load configs:', error);
    // 如果是连接错误，仍然返回空配置，但记录详细错误
    if (error.message && error.message.includes('无法连接')) {
      console.warn('后端服务未运行，使用空配置。请启动后端服务。');
    }
    return { providers: [], currentProviderId: null };
  }
}

/**
 * Get current provider configuration
 * @returns {Promise<Object|null>} Current provider configuration or null if not set
 */
export async function getConfig() {
  const { providers, currentProviderId } = await getAllConfigs();
  if (!currentProviderId || !providers.length) return null;
  
  return providers.find(p => p.id === currentProviderId) || null;
}

/**
 * Save all provider configurations to server
 * @param {Object} configData - Configuration data
 * @param {Array} configData.providers - Array of provider configurations
 * @param {string} configData.currentProviderId - ID of current active provider
 */
export async function saveAllConfigs(configData) {
  try {
    return await saveConfigs(configData);
  } catch (error) {
    console.error('Failed to save configs:', error);
    throw error;
  }
}

/**
 * Save or update a provider configuration
 * @param {Object} provider - Provider configuration
 * @param {string} provider.id - Unique provider ID
 * @param {string} provider.name - Provider display name
 * @param {string} provider.type - Provider type ('openai' or 'anthropic')
 * @param {string} provider.baseUrl - API base URL
 * @param {string} provider.apiKey - API key
 * @param {string} provider.model - Selected model
 * @param {boolean} isCurrent - Whether this provider should be set as current
 */
export async function saveProvider(provider, isCurrent = true) {
  const { providers, currentProviderId } = await getAllConfigs();
  
  // Find existing provider or create new one
  const existingIndex = providers.findIndex(p => p.id === provider.id);
  if (existingIndex >= 0) {
    providers[existingIndex] = provider;
  } else {
    // Generate ID if not provided
    if (!provider.id) {
      provider.id = 'provider_' + Date.now();
    }
    providers.push(provider);
  }
  
  const newCurrentProviderId = isCurrent ? provider.id : currentProviderId;
  
  return await saveAllConfigs({ providers, currentProviderId: newCurrentProviderId });
}

/**
 * Delete a provider configuration
 * @param {string} providerId - ID of provider to delete
 */
export async function deleteProvider(providerId) {
  const { providers, currentProviderId } = await getAllConfigs();
  
  const newProviders = providers.filter(p => p.id !== providerId);
  let newCurrentProviderId = currentProviderId;
  
  // If deleted provider was current, select another one
  if (currentProviderId === providerId && newProviders.length > 0) {
    newCurrentProviderId = newProviders[0].id;
  } else if (newProviders.length === 0) {
    newCurrentProviderId = null;
  }
  
  return await saveAllConfigs({ providers: newProviders, currentProviderId: newCurrentProviderId });
}

/**
 * Set current active provider
 * @param {string} providerId - ID of provider to set as current
 */
export async function setCurrentProvider(providerId) {
  const { providers } = await getAllConfigs();
  
  if (!providers.find(p => p.id === providerId)) {
    throw new Error('Provider not found');
  }
  
  return await saveAllConfigs({ providers, currentProviderId: providerId });
}

/**
 * Check if configuration is valid and complete
 * @param {Object} config - Configuration to validate
 * @returns {boolean} True if configuration is valid
 */
export function isConfigValid(config) {
  if (!config) return false;
  
  // 基本字段检查
  if (!config.type || !config.baseUrl || !config.model) {
    return false;
  }
  
  // Ollama 可能不需要 API key
  if (config.type !== 'ollama' && !config.apiKey) {
    return false;
  }
  
  return true;
}
