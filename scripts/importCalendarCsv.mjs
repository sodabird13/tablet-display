import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { parse } from 'csv-parse/sync'
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const csvPath = process.argv[2]
if (!csvPath) {
  console.error('Usage: node scripts/importCalendarCsv.mjs <path-to-csv>')
  process.exit(1)
}

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

function getUpcomingMonday() {
  const today = new Date()
  const day = today.getDay() // 0=Sun
  const offset = day === 1 ? 0 : (8 - day) % 7 || 7
  const monday = new Date(today)
  monday.setHours(0, 0, 0, 0)
  monday.setDate(today.getDate() + offset)
  return monday
}

function formatDate(date) {
  return date.toISOString().slice(0, 10)
}

function extractTime(value) {
  if (!value) return null
  let working = value.trim()
  if (!working) return null
  if (working.includes('T')) {
    working = working.split('T')[1] || ''
  }
  working = working.replace('Z', '')
  if (working.includes(' ')) {
    working = working.split(' ')[0]
  }
  const match = working.match(/^(\d{2}:\d{2})/)
  return match ? match[1] : null
}

function parseDate(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return date
}

const upcomingMonday = getUpcomingMonday()
console.log('Mapping events to week starting', formatDate(upcomingMonday))

const csvContent = fs.readFileSync(path.resolve(csvPath), 'utf-8')
const records = parse(csvContent, { columns: true, skip_empty_lines: true })

const events = []
const skipped = []

for (const row of records) {
  const title = row.title?.trim()
  if (!title) {
    continue
  }

  const startDateCandidate = parseDate(row.start_time) || parseDate(row.created_date)
  if (!startDateCandidate) {
    skipped.push({ title, reason: 'no valid date' })
    continue
  }

  const weekdayIndex = (startDateCandidate.getDay() + 6) % 7 // Monday=0
  const targetDate = new Date(upcomingMonday)
  targetDate.setDate(upcomingMonday.getDate() + weekdayIndex)

  const isAllDay = row.is_all_day?.toLowerCase() === 'true'

  events.push({
    title,
    color: row.color?.trim() || 'blue',
    is_all_day: isAllDay,
    is_recurring: false,
    start_time: isAllDay ? null : extractTime(row.start_time),
    end_time: isAllDay ? null : extractTime(row.end_time),
    specific_date: formatDate(targetDate),
    days_of_week: null,
  })
}

if (!events.length) {
  console.error('No events parsed from CSV. Aborting.')
  process.exit(1)
}

console.log(`Parsed ${events.length} events. Skipped ${skipped.length}. Clearing existing calendar_events…`)

const deleteResponse = await supabase.from('calendar_events').delete().neq('id', '')
if (deleteResponse.error) {
  console.error('Failed to delete existing events:', deleteResponse.error)
  process.exit(1)
}

const chunkSize = 50
for (let i = 0; i < events.length; i += chunkSize) {
  const chunk = events.slice(i, i + chunkSize)
  const insertResponse = await supabase.from('calendar_events').insert(chunk)
  if (insertResponse.error) {
    console.error('Failed to insert events chunk starting at index', i, insertResponse.error)
    process.exit(1)
  }
}

console.log('Import complete.')
if (skipped.length) {
  console.log('Skipped rows:')
  skipped.forEach((s) => console.log(`- ${s.title}: ${s.reason}`))
}
