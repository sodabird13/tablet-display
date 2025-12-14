import { supabase } from './supabaseClient'
import { fetchGoogleCalendarEvents } from './googleCalendar'
import { addDays, startOfDay } from 'date-fns'

const SETTINGS_TABLE = 'settings'
const EVENTS_TABLE = 'calendar_events'
const BACKGROUNDS_BUCKET = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || 'backgrounds'

const cryptoRef = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined

// Cache for settings to avoid repeated fetches
let settingsCache = null
let settingsCacheTime = 0
const SETTINGS_CACHE_TTL = 30000 // 30 seconds

const normalizeEvent = (event) => {
  if (!event) return event
  return {
    ...event,
    days_of_week: Array.isArray(event.days_of_week) ? event.days_of_week : event.days_of_week ? [event.days_of_week].flat() : [],
    excluded_dates: Array.isArray(event.excluded_dates)
      ? event.excluded_dates
      : event.excluded_dates
        ? [event.excluded_dates].flat()
        : [],
  }
}

const ensureData = (response) => {
  if (response.error) {
    throw response.error
  }
  return response.data
}

export async function fetchSettings() {
  const response = await supabase.from(SETTINGS_TABLE).select('*').limit(1).maybeSingle()
  if (response.error) {
    throw response.error
  }
  return response.data
}

export async function saveSettings(payload) {
  const response = await supabase
    .from(SETTINGS_TABLE)
    .upsert(payload, { onConflict: 'id', defaultToNull: false })
    .select()
    .maybeSingle()

  if (response.error) {
    throw response.error
  }
  
  // Clear settings cache so the new settings are used immediately
  clearSettingsCache()
  
  return response.data
}

export async function listCalendarEvents() {
  // Fetch local events from Supabase
  const response = await supabase
    .from(EVENTS_TABLE)
    .select('*')
    .order('specific_date', { ascending: true, nullsFirst: false })
    .order('title', { ascending: true })

  const localEvents = (ensureData(response) ?? []).map(normalizeEvent).map(e => ({
    ...e,
    source: 'local'
  }))

  // Try to fetch Google Calendar events if configured
  let googleEvents = []
  try {
    const settings = await getCachedSettings()
    
    if (settings?.google_calendar_id) {
      const today = startOfDay(new Date())
      const timeMin = today
      const timeMax = addDays(today, 30) // Fetch 30 days of events
      
      googleEvents = await fetchGoogleCalendarEvents(
        settings.google_calendar_id,
        settings.google_calendar_api_key,
        timeMin,
        timeMax
      )
    }
  } catch (error) {
    console.error('Failed to fetch Google Calendar events:', error)
  }

  // Merge and return all events
  return [...localEvents, ...googleEvents]
}

/**
 * Get settings with caching to avoid repeated fetches
 */
async function getCachedSettings() {
  const now = Date.now()
  if (settingsCache && (now - settingsCacheTime) < SETTINGS_CACHE_TTL) {
    return settingsCache
  }
  
  const response = await supabase.from(SETTINGS_TABLE).select('*').limit(1).maybeSingle()
  if (!response.error) {
    settingsCache = response.data
    settingsCacheTime = now
  }
  return response.data
}

/**
 * Clear the settings cache (call when settings are updated)
 */
export function clearSettingsCache() {
  settingsCache = null
  settingsCacheTime = 0
}

export async function createCalendarEvent(eventData) {
  const response = await supabase.from(EVENTS_TABLE).insert(eventData).select().maybeSingle()
  if (response.error) {
    throw response.error
  }
  return normalizeEvent(response.data)
}

export async function updateCalendarEvent(id, eventData) {
  const response = await supabase.from(EVENTS_TABLE).update(eventData).eq('id', id).select().maybeSingle()
  if (response.error) {
    throw response.error
  }
  return normalizeEvent(response.data)
}

export async function deleteCalendarEvent(id) {
  const response = await supabase.from(EVENTS_TABLE).delete().eq('id', id)
  if (response.error) {
    throw response.error
  }
  return true
}

export async function uploadBackgroundImage(file) {
  if (!file) {
    throw new Error('No file provided')
  }

  const extension = file.name.split('.').pop() || 'jpg'
  const randomId = cryptoRef?.randomUUID ? cryptoRef.randomUUID() : Math.random().toString(36).slice(2)
  const filePath = `${Date.now()}-${randomId}.${extension}`

  const uploadResponse = await supabase.storage.from(BACKGROUNDS_BUCKET).upload(filePath, file, {
    cacheControl: '3600',
    upsert: false,
  })

  if (uploadResponse.error) {
    throw uploadResponse.error
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BACKGROUNDS_BUCKET).getPublicUrl(filePath)

  return { file_url: publicUrl }
}
