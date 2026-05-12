import AsyncStorage from '@react-native-async-storage/async-storage'
import Logger from '../utils/Logger'
import { useAppStore } from '../store/useAppStore'
import { useFinanceStore } from '../store/useFinanceStore'

/**
 * Storage adapter that implements the AppKit Storage interface
 * with AsyncStorage as the underlying implementation
 */
export class StorageAdapter {
  private prefix = 'appkit_'

  /**
   * Get a value by key
   */
  async getItem<T = any>(key: string): Promise<T | undefined> {
    try {
      const prefixedKey = this.prefix + key
      const value = await AsyncStorage.getItem(prefixedKey)
      if (!value) return undefined
      try {
        return JSON.parse(value) as T
      } catch {
        // If JSON parse fails, return the string value
        return value as any
      }
    } catch (error) {
      Logger.error('StorageAdapter', `Failed to get item ${key}`, { error })
      return undefined
    }
  }

  /**
   * Set a value by key
   */
  async setItem<T = any>(key: string, value: T): Promise<void> {
    try {
      const prefixedKey = this.prefix + key
      const serialized = typeof value === 'string' ? value : JSON.stringify(value)
      await AsyncStorage.setItem(prefixedKey, serialized)
      Logger.debug('StorageAdapter', `Set item ${key}`)
    } catch (error) {
      Logger.error('StorageAdapter', `Failed to set item ${key}`, { error })
    }
  }

  /**
   * Remove a value by key
   */
  async removeItem(key: string): Promise<void> {
    try {
      const prefixedKey = this.prefix + key
      await AsyncStorage.removeItem(prefixedKey)
      Logger.debug('StorageAdapter', `Removed item ${key}`)
    } catch (error) {
      Logger.error('StorageAdapter', `Failed to remove item ${key}`, { error })
    }
  }

  /**
   * Get all keys
   */
  async getKeys(): Promise<string[]> {
    try {
      const allKeys = await AsyncStorage.getAllKeys()
      // Filter to only return keys with our prefix
      const filtered = allKeys
        .filter(key => key.startsWith(this.prefix))
        .map(key => key.substring(this.prefix.length))
      Logger.debug('StorageAdapter', `Found ${filtered.length} keys`)
      return filtered
    } catch (error) {
      Logger.error('StorageAdapter', 'Failed to get keys', { error })
      return []
    }
  }

  /**
   * Get all entries as key-value pairs
   */
  async getEntries<T = any>(): Promise<[string, T][]> {
    try {
      const keys = await this.getKeys()
      const entries: [string, T][] = []

      for (const key of keys) {
        const value = await this.getItem<T>(key)
        if (value !== undefined) {
          entries.push([key, value])
        }
      }
      Logger.debug('StorageAdapter', `Retrieved ${entries.length} entries`)
      return entries
    } catch (error) {
      Logger.error('StorageAdapter', 'Failed to get entries', { error })
      return []
    }
  }

  /**
   * Clear all stored data with our prefix
   */
  async clear(): Promise<void> {
    try {
      const keys = await this.getKeys()
      await AsyncStorage.multiRemove(keys.map(key => this.prefix + key))
    } catch (error) {
      Logger.error('StorageAdapter', 'Failed to clear storage', { error })
    }
  }

  /**
   * Sync app state with storage (write)
   * Called on app shutdown or state updates
   */
  async syncAppState(): Promise<void> {
    try {
      const appState = useAppStore.getState()
      const financeState = useFinanceStore.getState()

      // Store authentication state
      if (appState.authToken) {
        await this.setItem('auth_token', appState.authToken)
        await this.setItem('auth_status', appState.authStatus)
      }

      // Store user profile
      if (appState.userProfile) {
        await this.setItem(
          'user_profile',
          appState.userProfile
        )
      }

      // Store preferences
      if (appState.preferences) {
        await this.setItem(
          'user_preferences',
          appState.preferences
        )
      }

      // Store finance state
      if (financeState.selectedTimeRange) {
        await this.setItem('selected_time_range', financeState.selectedTimeRange)
      }

      if (financeState.isAiOptedIn) {
        await this.setItem('ai_opted_in', financeState.isAiOptedIn)
      }

      Logger.info('StorageAdapter', 'App state synchronized to storage')
    } catch (error) {
      Logger.error('StorageAdapter', 'Failed to sync app state', { error })
    }
  }

  /**
   * Restore app state from storage (read)
   * Called on app startup
   */
  async restoreAppState(): Promise<void> {
    try {
      const appStore = useAppStore.getState()
      const financeStore = useFinanceStore.getState()

      // Restore preferences
      const preferences = await this.getItem('user_preferences')
      if (preferences) {
        try {
          appStore.setBaseCurrency(preferences.baseCurrency || 'USD')
          // Note: toggle methods exist in store for alerts and summary
        } catch (e) {
          Logger.error('StorageAdapter', 'Failed to restore preferences', { error: e })
        }
      }

      // Restore time range selection
      const timeRange = await this.getItem('selected_time_range')
      const legacyTimeRangeMap: Record<string, string> = {
        '24H': '1W',
        '3M': '1M',
        All: '1Y',
      }
      const normalizedTimeRange = legacyTimeRangeMap[timeRange] ?? timeRange
      if (normalizedTimeRange && ['1W', '1M', '6M', '1Y'].includes(normalizedTimeRange)) {
        financeStore.setSelectedTimeRange(normalizedTimeRange as '1W' | '1M' | '6M' | '1Y')
      }

      // Restore AI opt-in status
      const isOptedIn = await this.getItem('ai_opted_in')
      if (isOptedIn && !financeStore.isAiOptedIn) {
        financeStore.toggleAiOptIn()
      }

      Logger.info('StorageAdapter', 'App state restored from storage')
    } catch (error) {
      Logger.error('StorageAdapter', 'Failed to restore app state', { error })
    }
  }
}

// Export a singleton instance
export const storageAdapter = new StorageAdapter()
