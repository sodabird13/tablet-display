import { supabase } from './supabaseClient'

const SETTINGS_TABLE = 'settings'
const EVENTS_TABLE = 'calendar_events'
const BACKGROUNDS_BUCKET = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || 'backgrounds'

const cryptoRef = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined

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
  return response.data
}

export async function listCalendarEvents() {
  const response = await supabase
    .from(EVENTS_TABLE)
    .select('*')
    .order('specific_date', { ascending: true, nullsFirst: false })
    .order('title', { ascending: true })

  const events = ensureData(response) ?? []
  return events.map(normalizeEvent)
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
