export class KVStorageService {
  constructor(env) {
    this.kv = env?.JURY_DATA // KV namespace binding
    
    // Development fallback when KV is not available
    if (!this.kv && typeof window === 'undefined') {
      console.warn('⚠️  KV not available - using development localStorage fallback')
      this.isDev = true
    }
  }

  // Development storage using localStorage simulation
  _getFromDev(key) {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(`kv:${key}`)
    }
    // Server-side fallback - return null (data won't persist but won't crash)
    return null
  }

  _setToDev(key, value) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`kv:${key}`, value)
    }
    // Server-side fallback - no-op
  }

  _deleteFromDev(key) {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(`kv:${key}`)
    }
    // Server-side fallback - no-op
  }

  // Generate consistent keys using Ethereum address
  getKey(userAddress, dataType, id = null) {
    // Normalize address to lowercase for consistency
    const normalizedAddress = userAddress.toLowerCase()
    if (id) {
      return `user:${normalizedAddress}:${dataType}:${id}`
    }
    return `user:${normalizedAddress}:${dataType}`
  }

  // Helper to validate Ethereum addresses
  isValidEthereumAddress(address) {
    return /^0x[a-fA-F0-9]{40}$/.test(address)
  }

  // Save user profile data
  async saveProfile(userAddress, profileData) {
    if (!this.isValidEthereumAddress(userAddress)) {
      throw new Error('Invalid Ethereum address')
    }

    const key = this.getKey(userAddress, 'profile')
    await this.kv.put(key, JSON.stringify({
      ...profileData,
      lastUpdated: new Date().toISOString()
    }))
  }

  // Save evaluation data with submission tracking
  async saveEvaluation(userAddress, type, id, data) {
    if (!this.isValidEthereumAddress(userAddress)) {
      throw new Error('Invalid Ethereum address')
    }

    const key = this.getKey(userAddress, type, id)
    const existingData = await this.kv.get(key, 'json') || {}

    await this.kv.put(key, JSON.stringify({
      ...data,
      id,
      type,
      timestamp: new Date().toISOString(),
      lastSubmittedAt: existingData.lastSubmittedAt || null,
      submissionCount: existingData.submissionCount || 0,
      status: data.status || 'draft' // 'draft' or 'submitted'
    }))

    // Update index for this type
    await this.updateIndex(userAddress, type, id)
  }

  // Get evaluation data
  async getEvaluation(userAddress, type, id) {
    const key = this.getKey(userAddress, type, id)
    return await this.kv.get(key, 'json')
  }

  // Mark evaluation as submitted
  async markAsSubmitted(userAddress, type, id) {
    const key = this.getKey(userAddress, type, id)
    const data = await this.kv.get(key, 'json')
    
    if (data) {
      await this.kv.put(key, JSON.stringify({
        ...data,
        lastSubmittedAt: new Date().toISOString(),
        submissionCount: (data.submissionCount || 0) + 1,
        status: 'submitted'
      }))
    }
  }

  // Maintain an index of all items per type
  async updateIndex(userAddress, type, id) {
    const indexKey = this.getKey(userAddress, type, '_index')
    const existing = await this.kv.get(indexKey, 'json') || []
    
    if (!existing.includes(id)) {
      existing.push(id)
      await this.kv.put(indexKey, JSON.stringify(existing))
    }
  }

  // Get all indices for a user
  async getIndices(userAddress) {
    const types = ['background', 'scale', 'similar', 'comparison', 'originality']
    const indices = {}
    
    for (const type of types) {
      const indexKey = this.getKey(userAddress, type, '_index')
      indices[type] = await this.kv.get(indexKey, 'json') || []
    }
    
    return indices
  }

  // Load all data for a user
  async loadUserData(userAddress) {
    if (!this.isValidEthereumAddress(userAddress)) {
      throw new Error('Invalid Ethereum address')
    }

    // Get profile
    const profile = await this.kv.get(this.getKey(userAddress, 'profile'), 'json')
    
    // Get indices for all types
    const indices = await this.getIndices(userAddress)
    
    // Load individual items for each type
    const userData = {
      profile,
      background: [],
      scale: [],
      similar: [],
      comparison: [],
      originality: []
    }

    // Load data for each type
    for (const [type, ids] of Object.entries(indices)) {
      if (ids && ids.length > 0) {
        userData[type] = await Promise.all(
          ids.map(id => this.kv.get(this.getKey(userAddress, type, id), 'json'))
        )
        userData[type] = userData[type].filter(Boolean) // Remove nulls
      }
    }

    return userData
  }

  // Get user progress summary
  async getUserProgress(userAddress) {
    const userData = await this.loadUserData(userAddress)
    
    const progress = {
      profile: !!userData.profile,
      screens: {
        background: {
          total: userData.background.length,
          submitted: userData.background.filter(d => d?.status === 'submitted').length,
          draft: userData.background.filter(d => d?.status === 'draft').length
        },
        scale: {
          total: userData.scale.length,
          submitted: userData.scale.filter(d => d?.status === 'submitted').length,
          draft: userData.scale.filter(d => d?.status === 'draft').length
        },
        similar: {
          total: userData.similar.length,
          submitted: userData.similar.filter(d => d?.status === 'submitted').length,
          draft: userData.similar.filter(d => d?.status === 'draft').length
        },
        comparison: {
          total: userData.comparison.length,
          submitted: userData.comparison.filter(d => d?.status === 'submitted').length,
          draft: userData.comparison.filter(d => d?.status === 'drift').length
        },
        originality: {
          total: userData.originality.length,
          submitted: userData.originality.filter(d => d?.status === 'submitted').length,
          draft: userData.originality.filter(d => d?.status === 'draft').length
        }
      }
    }
    
    // Calculate overall progress
    let totalScreens = 0
    let submittedScreens = 0
    
    for (const screenData of Object.values(progress.screens)) {
      totalScreens += screenData.total
      submittedScreens += screenData.submitted
    }
    
    progress.overall = {
      total: totalScreens,
      submitted: submittedScreens,
      percentComplete: totalScreens > 0 ? Math.round((submittedScreens / totalScreens) * 100) : 0
    }
    
    return progress
  }

  // Delete user data (for testing or user request)
  async deleteUserData(userAddress) {
    if (!this.isValidEthereumAddress(userAddress)) {
      throw new Error('Invalid Ethereum address')
    }

    // Get all indices
    const indices = await this.getIndices(userAddress)
    
    // Delete all items for each type
    for (const [type, ids] of Object.entries(indices)) {
      if (ids && ids.length > 0) {
        for (const id of ids) {
          await this.kv.delete(this.getKey(userAddress, type, id))
        }
      }
      // Delete the index itself
      await this.kv.delete(this.getKey(userAddress, type, '_index'))
    }
    
    // Delete profile
    await this.kv.delete(this.getKey(userAddress, 'profile'))
  }

  // List all keys for a user (useful for debugging)
  async listUserKeys(userAddress) {
    const normalizedAddress = userAddress.toLowerCase()
    const prefix = `user:${normalizedAddress}`
    
    // KV list with prefix
    const list = await this.kv.list({ prefix })
    return list.keys
  }
}