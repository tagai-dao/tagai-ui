/**
 * Mock for @react-native-async-storage/async-storage
 * This provides a web-compatible localStorage-based implementation
 * for packages that require React Native's AsyncStorage
 */

const AsyncStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return localStorage.getItem(key)
    } catch (e) {
      console.warn('AsyncStorage.getItem error:', e)
      return null
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    try {
      localStorage.setItem(key, value)
    } catch (e) {
      console.warn('AsyncStorage.setItem error:', e)
    }
  },

  removeItem: async (key: string): Promise<void> => {
    try {
      localStorage.removeItem(key)
    } catch (e) {
      console.warn('AsyncStorage.removeItem error:', e)
    }
  },

  clear: async (): Promise<void> => {
    try {
      localStorage.clear()
    } catch (e) {
      console.warn('AsyncStorage.clear error:', e)
    }
  },

  getAllKeys: async (): Promise<string[]> => {
    try {
      return Object.keys(localStorage)
    } catch (e) {
      console.warn('AsyncStorage.getAllKeys error:', e)
      return []
    }
  },

  multiGet: async (keys: string[]): Promise<[string, string | null][]> => {
    try {
      return keys.map(key => [key, localStorage.getItem(key)])
    } catch (e) {
      console.warn('AsyncStorage.multiGet error:', e)
      return keys.map(key => [key, null])
    }
  },

  multiSet: async (keyValuePairs: [string, string][]): Promise<void> => {
    try {
      keyValuePairs.forEach(([key, value]) => {
        localStorage.setItem(key, value)
      })
    } catch (e) {
      console.warn('AsyncStorage.multiSet error:', e)
    }
  },

  multiRemove: async (keys: string[]): Promise<void> => {
    try {
      keys.forEach(key => {
        localStorage.removeItem(key)
      })
    } catch (e) {
      console.warn('AsyncStorage.multiRemove error:', e)
    }
  },

  mergeItem: async (key: string, value: string): Promise<void> => {
    try {
      const existing = localStorage.getItem(key)
      if (existing) {
        const merged = { ...JSON.parse(existing), ...JSON.parse(value) }
        localStorage.setItem(key, JSON.stringify(merged))
      } else {
        localStorage.setItem(key, value)
      }
    } catch (e) {
      console.warn('AsyncStorage.mergeItem error:', e)
    }
  },

  multiMerge: async (keyValuePairs: [string, string][]): Promise<void> => {
    try {
      await Promise.all(
        keyValuePairs.map(([key, value]) => AsyncStorage.mergeItem(key, value))
      )
    } catch (e) {
      console.warn('AsyncStorage.multiMerge error:', e)
    }
  }
}

export default AsyncStorage
