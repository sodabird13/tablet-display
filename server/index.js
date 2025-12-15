/**
 * Pi Server for Tablet Display
 * 
 * This server:
 * 1. Serves the static dist/ folder
 * 2. Provides an API endpoint for Google Calendar events (server-side fetching)
 * 
 * Run with: node server/index.js
 * Or with pm2: pm2 start server/index.js --name tablet-display
 */

import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { SignJWT, importPKCS8 } from 'jose'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001

// Google Calendar API configuration
const GOOGLE_CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly'

// Service account credentials from environment variables
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
const SERVICE_ACCOUNT_PRIVATE_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n')
const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID

// Token cache
let accessTokenCache = null
let tokenExpiresAt = 0

/**
 * Get an access token using service account credentials
 */
async function getAccessToken() {
  const now = Date.now()
  
  // Return cached token if still valid (with 5 min buffer)
  if (accessTokenCache && tokenExpiresAt > now + 300000) {
    return accessTokenCache
  }

  if (!SERVICE_ACCOUNT_EMAIL || !SERVICE_ACCOUNT_PRIVATE_KEY) {
    throw new Error('Service account credentials not configured')
  }

  try {
    const privateKey = await importPKCS8(SERVICE_ACCOUNT_PRIVATE_KEY, 'RS256')
    const nowSeconds = Math.floor(now / 1000)
    
    const jwt = await new SignJWT({ scope: CALENDAR_SCOPE })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuer(SERVICE_ACCOUNT_EMAIL)
      .setSubject(SERVICE_ACCOUNT_EMAIL)
      .setAudience(GOOGLE_TOKEN_URL)
      .setIssuedAt(nowSeconds)
      .setExpirationTime(nowSeconds + 3600)
      .sign(privateKey)

    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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

    console.log('Successfully obtained Google Calendar access token')
    return accessTokenCache
  } catch (error) {
    console.error('Failed to get access token:', error)
    throw error
  }
}

/**
 * Fetch events from Google Calendar
 */
async function fetchGoogleCalendarEvents(calendarId, timeMin, timeMax) {
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
      headers: { 'Authorization': `Bearer ${accessToken}` },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('Google Calendar API error:', errorData)
      
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
 * Normalize a Google Calendar event to match our local event format
 */
function normalizeGoogleEvent(googleEvent) {
  const isAllDay = Boolean(googleEvent.start?.date)
  
  let specificDate, startTime, endTime

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
  '1': 'blue', '2': 'green', '3': 'purple', '4': 'pink',
  '5': 'yellow', '6': 'orange', '7': 'cyan', '8': 'gray',
  '9': 'blue', '10': 'green', '11': 'red',
}

// API endpoint for Google Calendar events
app.get('/api/google-calendar-events', async (req, res) => {
  try {
    const calendarId = GOOGLE_CALENDAR_ID
    
    if (!calendarId) {
      return res.json({ events: [], error: 'No calendar ID configured' })
    }

    if (!SERVICE_ACCOUNT_EMAIL || !SERVICE_ACCOUNT_PRIVATE_KEY) {
      return res.json({ events: [], error: 'Service account not configured' })
    }

    // Fetch 30 days of events
    const now = new Date()
    const timeMin = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const timeMax = new Date(timeMin.getTime() + 30 * 24 * 60 * 60 * 1000)

    const events = await fetchGoogleCalendarEvents(calendarId, timeMin, timeMax)
    console.log(`Fetched ${events.length} Google Calendar events`)
    
    res.json({ events })
  } catch (error) {
    console.error('Error fetching Google Calendar events:', error)
    res.status(500).json({ events: [], error: error.message })
  }
})

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    calendarConfigured: !!GOOGLE_CALENDAR_ID,
    serviceAccountConfigured: !!(SERVICE_ACCOUNT_EMAIL && SERVICE_ACCOUNT_PRIVATE_KEY)
  })
})

// Serve static files from dist/
app.use(express.static(path.join(__dirname, '..', 'dist')))

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'))
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Tablet Display server running on http://0.0.0.0:${PORT}`)
  console.log(`Google Calendar ID: ${GOOGLE_CALENDAR_ID || 'NOT SET'}`)
  console.log(`Service Account: ${SERVICE_ACCOUNT_EMAIL || 'NOT SET'}`)
})

