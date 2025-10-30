// Edge-compatible Google Sheets service
export class GoogleSheetsService {
  constructor() {
    this.sheetId = process.env.GOOGLE_SHEET_ID
    this.serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
    this.privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  }

  async getAccessToken() {
    // Create JWT for service account authentication
    const header = {
      alg: 'RS256',
      typ: 'JWT'
    }

    const now = Math.floor(Date.now() / 1000)
    const payload = {
      iss: this.serviceEmail,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    }

    // Encode header and payload
    const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
    const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
    
    const signatureInput = `${encodedHeader}.${encodedPayload}`
    
    // Import private key for signing
    const privateKeyObj = await crypto.subtle.importKey(
      'pkcs8',
      this.stringToArrayBuffer(this.privateKey.replace(/-----BEGIN PRIVATE KEY-----\n|-----END PRIVATE KEY-----\n?/g, '').replace(/\n/g, '')),
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256'
      },
      false,
      ['sign']
    )

    // Sign the JWT
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      privateKeyObj,
      new TextEncoder().encode(signatureInput)
    )

    const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

    const jwt = `${signatureInput}.${encodedSignature}`

    // Exchange JWT for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt
      })
    })

    const tokenData = await tokenResponse.json()
    return tokenData.access_token
  }

  stringToArrayBuffer(str) {
    const binaryString = atob(str)
    const len = binaryString.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes.buffer
  }

  async readSheet(range) {
    const accessToken = await this.getAccessToken()
    
    try {
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId}/values/${range}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )
      
      const data = await response.json()
      return data.values || []
    } catch (error) {
      console.error('Error reading sheet:', error)
      throw error
    }
  }

  async writeSheet(range, values) {
    const accessToken = await this.getAccessToken()
    
    try {
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values,
          }),
        }
      )
      
      return await response.json()
    } catch (error) {
      console.error('Error writing to sheet:', error)
      throw error
    }
  }

  async updateCell(range, value) {
    const accessToken = await this.getAccessToken()
    
    try {
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId}/values/${range}?valueInputOption=RAW`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values: [[value]],
          }),
        }
      )
      
      return await response.json()
    } catch (error) {
      console.error('Error updating cell:', error)
      throw error
    }
  }

  async batchUpdate(updates) {
    const accessToken = await this.getAccessToken()
    
    try {
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId}/values:batchUpdate`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            valueInputOption: 'RAW',
            data: updates.map(update => ({
              range: update.range,
              values: update.values,
            })),
          }),
        }
      )
      
      return await response.json()
    } catch (error) {
      console.error('Error batch updating:', error)
      throw error
    }
  }

  // Helper method to format data for submission
  formatSubmissionRow(userId, screenType, screenId, data, status = 'active') {
    const timestamp = new Date().toISOString()
    
    // Base columns that are always present
    const baseColumns = [
      timestamp,
      userId,
      screenType,
      screenId,
      status,
    ]

    // Add data-specific columns based on screen type
    const dataColumns = this.extractDataColumns(screenType, data)
    
    return [...baseColumns, ...dataColumns]
  }

  extractDataColumns(screenType, data) {
    // Extract relevant columns based on screen type
    // This can be expanded based on your specific needs
    const columns = []
    
    switch (screenType) {
      case 'background':
        columns.push(
          data.experience || '',
          data.expertise || '',
          data.familiarity || ''
        )
        break
      case 'scale':
        columns.push(
          data.lowestRepo || '',
          data.highestRepo || '',
          data.multiplier || ''
        )
        break
      case 'similar':
        columns.push(
          data.providedRepo || '',
          data.similarRepos?.join(', ') || ''
        )
        break
      case 'comparison':
        columns.push(
          data.repoA || '',
          data.repoB || '',
          data.choice || '',
          data.multiplier || '',
          data.reasoning || ''
        )
        break
      case 'originality':
        columns.push(
          data.repo || '',
          data.originalityScore || '',
          data.reasoning || ''
        )
        break
      default:
        // For unknown types, stringify the entire data object
        columns.push(JSON.stringify(data))
    }
    
    return columns
  }

  async markRowsAsSuperseded(userId, screenType, screenId) {
    await this.initialize()
    
    try {
      // Read all rows to find matching ones
      const range = 'responses!A:Z' // Adjust range as needed
      const rows = await this.readSheet(range)
      
      if (!rows || rows.length === 0) return
      
      // Find rows to update (assuming userId is column B, screenType is C, screenId is D, status is E)
      const updates = []
      rows.forEach((row, index) => {
        if (row[1] === userId && row[2] === screenType && row[3] === screenId && row[4] === 'active') {
          updates.push({
            range: `responses!E${index + 1}`, // Status column
            values: [['superseded']],
          })
        }
      })
      
      // Batch update all matching rows
      if (updates.length > 0) {
        await this.batchUpdate(updates)
      }
    } catch (error) {
      console.error('Error marking rows as superseded:', error)
      throw error
    }
  }

  // Initialize sheet structure if needed
  async initializeSheetStructure() {
    await this.initialize()
    
    try {
      // Check if sheets exist
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.sheetId,
      })
      
      const existingSheets = response.data.sheets.map(sheet => sheet.properties.title)
      
      // Create sheets if they don't exist
      const requiredSheets = ['responses', 'users', 'metadata']
      
      for (const sheetName of requiredSheets) {
        if (!existingSheets.includes(sheetName)) {
          await this.createSheet(sheetName)
          
          // Add headers based on sheet type
          const headers = this.getSheetHeaders(sheetName)
          if (headers) {
            await this.writeSheet(`${sheetName}!A1`, [headers])
          }
        }
      }
    } catch (error) {
      console.error('Error initializing sheet structure:', error)
      throw error
    }
  }

  getSheetHeaders(sheetName) {
    switch (sheetName) {
      case 'responses':
        return [
          'timestamp',
          'user_address',
          'screen_type',
          'screen_id',
          'status',
          'data_1',
          'data_2',
          'data_3',
          'data_4',
          'data_5',
        ]
      case 'users':
        return [
          'timestamp',
          'user_address',
          'invite_code',
          'first_login',
          'last_activity',
        ]
      case 'metadata':
        return [
          'key',
          'value',
          'description',
          'updated_at',
        ]
      default:
        return null
    }
  }
}