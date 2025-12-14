/**
 * Google Calendar API client using Service Account authentication
 * 
 * This allows access to private calendars that have been shared with the service account.
 * 
 * Setup:
 * 1. Create a service account in Google Cloud Console
 * 2. Download the JSON key file
 * 3. Share your Google Calendar with the service account email
 * 4. Add the credentials to your .env.local file
 */

import { SignJWT, importPKCS8 } from 'jose'

const GOOGLE_CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly'

// Cache for access token
let accessTokenCache = null
let tokenExpiresAt = 0

/**
 * Get service account credentials from environment variables
 */
function getServiceAccountCredentials() {
  const clientEmail = import.meta.env.VITE_GOOGLE_SERVICE_ACCOUNT_EMAIL
  const privateKey = import.meta.env.VITE_GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY

  if (!clientEmail || !privateKey) {
    return null
  }

  // Handle escaped newlines in the private key
  const formattedKey = privateKey.replace(/\\n/g, '\n')

  return {
    clientEmail,
    privateKey: formattedKey,
  }
}

/**
 * Get an access token using service account credentials
 */
async function getAccessToken() {
  const now = Date.now()
  
  // Return cached token if still valid (with 5 min buffer)
  if (accessTokenCache && tokenExpiresAt > now + 300000) {
    return accessTokenCache
  }

  const credentials = getServiceAccountCredentials()
  if (!credentials) {
    throw new Error('Service account credentials not configured')
  }

  try {
    // Import the private key
    const privateKey = await importPKCS8(credentials.privateKey, 'RS256')

    // Create JWT
    const nowSeconds = Math.floor(now / 1000)
    const jwt = await new SignJWT({
      scope: CALENDAR_SCOPE,
    })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuer(credentials.clientEmail)
      .setSubject(credentials.clientEmail)
      .setAudience(GOOGLE_TOKEN_URL)
      .setIssuedAt(nowSeconds)
      .setExpirationTime(nowSeconds + 3600)
      .sign(privateKey)

    // Exchange JWT for access token
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}))
      console.error('Token exchange failed:', errorData)
      throw new Error('Failed to get access token')
    }

    const tokenData = await tokenResponse.json()
    accessTokenCache = tokenData.access_token
    tokenExpiresAt = now + (tokenData.expires_in * 1000)

    return accessTokenCache
  } catch (error) {
    console.error('Failed to get access token:', error)
    throw error
  }
}

/**
 * Check if service account is configured
 */
export function isServiceAccountConfigured() {
  return getServiceAccountCredentials() !== null
}

/**
 * Fetch events from a Google Calendar using service account auth
 * @param {string} calendarId - The Google Calendar ID
 * @param {Date} timeMin - Start of date range
 * @param {Date} timeMax - End of date range
 * @returns {Promise<Array>} Array of normalized calendar events
 */
export async function fetchGoogleCalendarEvents(calendarId, apiKey, timeMin, timeMax) {
  // If service account is configured, use that instead of API key
  if (isServiceAccountConfigured()) {
    return fetchWithServiceAccount(calendarId, timeMin, timeMax)
  }

  // Fall back to API key method (for public calendars only)
  if (!calendarId || !apiKey) {
    return []
  }

  return fetchWithApiKey(calendarId, apiKey, timeMin, timeMax)
}

/**
 * Fetch events using service account authentication (works with private calendars)
 */
async function fetchWithServiceAccount(calendarId, timeMin, timeMax) {
  if (!calendarId) {
    return []
  }

  try {
    const accessToken = await getAccessToken()
    const encodedCalendarId = encodeURIComponent(calendarId)
    
    const params = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
    })

    const url = `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodedCalendarId}/events?${params}`

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('Google Calendar API error:', errorData)
      
      // If unauthorized, clear the token cache and retry once
      if (response.status === 401) {
        accessTokenCache = null
        tokenExpiresAt = 0
      }
      
      return []
    }

    const data = await response.json()
    return (data.items || []).map(normalizeGoogleEvent)
  } catch (error) {
    console.error('Failed to fetch Google Calendar events:', error)
    return []
  }
}

/**
 * Fetch events using API key (public calendars only)
 */
async function fetchWithApiKey(calendarId, apiKey, timeMin, timeMax) {
  const encodedCalendarId = encodeURIComponent(calendarId)
  const params = new URLSearchParams({
    key: apiKey,
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  })

  const url = `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodedCalendarId}/events?${params}`

  try {
    const response = await fetch(url)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('Google Calendar API error:', errorData)
      return []
    }

    const data = await response.json()
    return (data.items || []).map(normalizeGoogleEvent)
  } catch (error) {
    console.error('Failed to fetch Google Calendar events:', error)
    return []
  }
}

/**
 * Normalize a Google Calendar event to match our local event format
 */
function normalizeGoogleEvent(googleEvent) {
  const isAllDay = Boolean(googleEvent.start?.date)
  
  let specificDate
  let startTime
  let endTime

  if (isAllDay) {
    specificDate = googleEvent.start.date
  } else {
    const startDateTime = new Date(googleEvent.start.dateTime)
    const endDateTime = new Date(googleEvent.end.dateTime)
    
    specificDate = formatDateLocal(startDateTime)
    startTime = formatTimeLocal(startDateTime)
    endTime = formatTimeLocal(endDateTime)
  }

  const colorId = googleEvent.colorId || '1'
  const color = GOOGLE_COLOR_MAP[colorId] || 'blue'

  return {
    id: `gcal_${googleEvent.id}`,
    title: googleEvent.summary || '(No title)',
    description: googleEvent.description || '',
    color,
    is_all_day: isAllDay,
    is_recurring: false,
    specific_date: specificDate,
    start_time: startTime,
    end_time: endTime,
    days_of_week: [],
    excluded_dates: [],
    source: 'google',
    google_event_id: googleEvent.id,
    google_html_link: googleEvent.htmlLink,
    location: googleEvent.location || null,
  }
}

function formatDateLocal(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatTimeLocal(date) {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

const GOOGLE_COLOR_MAP = {
  '1': 'blue',
  '2': 'green',
  '3': 'purple',
  '4': 'pink',
  '5': 'yellow',
  '6': 'orange',
  '7': 'cyan',
  '8': 'gray',
  '9': 'blue',
  '10': 'green',
  '11': 'red',
}

/**
 * Test the Google Calendar connection
 */
export async function testGoogleCalendarConnection(calendarId, apiKey) {
  // If service account is configured, test with that
  if (isServiceAccountConfigured()) {
    return testServiceAccountConnection(calendarId)
  }

  // Fall back to API key test
  if (!calendarId || !apiKey) {
    return { success: false, error: 'Calendar ID and API key are required' }
  }

  const encodedCalendarId = encodeURIComponent(calendarId)
  const url = `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodedCalendarId}?key=${apiKey}`

  try {
    const response = await fetch(url)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.error?.message || 'Failed to connect to Google Calendar'
      return { success: false, error: errorMessage }
    }

    const data = await response.json()
    return { 
      success: true, 
      calendarName: data.summary || 'Unnamed Calendar'
    }
  } catch (error) {
    return { 
      success: false, 
      error: 'Network error - please check your internet connection'
    }
  }
}

/**
 * Test connection using service account
 */
async function testServiceAccountConnection(calendarId) {
  if (!calendarId) {
    return { success: false, error: 'Calendar ID is required' }
  }

  try {
    const accessToken = await getAccessToken()
    const encodedCalendarId = encodeURIComponent(calendarId)
    const url = `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodedCalendarId}`

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.error?.message || 'Failed to connect. Make sure you shared the calendar with the service account.'
      return { success: false, error: errorMessage }
    }

    const data = await response.json()
    return {
      success: true,
      calendarName: data.summary || 'Unnamed Calendar',
      authMethod: 'service_account'
    }
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to authenticate with service account'
    }
  }
}
