
import React, { useState, useEffect } from 'react';
import {
  fetchSettings,
  listCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  clearSettingsCache,
} from '@/api/dataClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addDays, startOfWeek, startOfDay } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Plus, Settings as SettingsIcon, ChevronLeft, ChevronRight, RefreshCw, Tablet } from 'lucide-react';

// Google "G" icon component (white/greyscale version - very faint)
const GoogleIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="white" opacity="0.35">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import EventEditModal from '../components/display/EventEditModal';
import CalendarSettingsModal from '../components/calendar/CalendarSettingsModal';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const COLOR_MAP = {
  red: 'bg-red-400',
  cyan: 'bg-cyan-400',
  blue: 'bg-blue-400',
  green: 'bg-green-400',
  yellow: 'bg-yellow-300',
  gray: 'bg-gray-400',
  purple: 'bg-purple-400',
  pink: 'bg-pink-400',
  orange: 'bg-orange-400',
  indigo: 'bg-indigo-400',
};

export default function Calendar() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState('week');
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [current3DayStart, setCurrent3DayStart] = useState(startOfDay(new Date()));
  const [current1DayStart, setCurrent1DayStart] = useState(startOfDay(new Date()));
  const [showEventModal, setShowEventModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [currentDate, setCurrentDate] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Clear the settings cache to ensure we get fresh Google Calendar config
    clearSettingsCache();
    // Refetch calendar events (this will also re-fetch Google Calendar events)
    await queryClient.refetchQueries({ queryKey: ['calendar-events'] });
    setIsRefreshing(false);
  };

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
    initialData: null,
  });

  const { data: events = [] } = useQuery({
    queryKey: ['calendar-events'],
    queryFn: listCalendarEvents,
    initialData: [],
    staleTime: 0, // Always consider data stale
    refetchInterval: 300000, // 5 minutes
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always'
  });

  // Create Event
  const createEventMutation = useMutation({
    mutationFn: (eventData) => createCalendarEvent(eventData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      closeModal();
    }
  });

  // Update Series or One-Time Event
  const updateEventMutation = useMutation({
    mutationFn: ({ id, eventData }) => updateCalendarEvent(id, eventData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      closeModal();
    }
  });

  // Update Occurrence (exclude date from series, create new one-time event)
  const updateOccurrenceMutation = useMutation({
    mutationFn: async ({ seriesId, dateStr, newOneTimeEvent, currentExcludedDates }) => {
      await updateCalendarEvent(seriesId, {
        excluded_dates: [...currentExcludedDates, dateStr]
      });
      
      await createCalendarEvent(newOneTimeEvent);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      closeModal();
    }
  });

  // Delete Event (series or one-time)
  const deleteEventMutation = useMutation({
    mutationFn: (id) => deleteCalendarEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      closeModal();
    }
  });

  // Delete Occurrence (just exclude from series)
  const deleteOccurrenceMutation = useMutation({
    mutationFn: ({ id, dateStr, currentExcludedDates }) => {
      return updateCalendarEvent(id, {
        excluded_dates: [...currentExcludedDates, dateStr]
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      closeModal();
    }
  });

  const closeModal = () => {
    setShowEventModal(false);
    setEditingEvent(null);
    setCurrentDate(null);
  };

  // Handlers for modal
  const handleCreateEvent = (eventData) => {
    createEventMutation.mutate(eventData);
  };

  const handleUpdateSeries = (id, eventData) => {
    updateEventMutation.mutate({ id, eventData });
  };

  const handleUpdateOccurrence = (seriesId, dateStr, newOneTimeEvent) => {
    const series = events.find(e => e.id === seriesId);
    if (!series) return;
    
    updateOccurrenceMutation.mutate({
      seriesId,
      dateStr,
      newOneTimeEvent,
      currentExcludedDates: series.excluded_dates || []
    });
  };

  const handleDeleteSeries = (id) => {
    deleteEventMutation.mutate(id);
  };

  const handleDeleteOccurrence = (seriesId, dateStr) => {
    const series = events.find(e => e.id === seriesId);
    if (!series) return;
    
    deleteOccurrenceMutation.mutate({
      id: seriesId,
      dateStr,
      currentExcludedDates: series.excluded_dates || []
    });
  };

  const calendarTitle = settings?.calendar_title || 'Weekly Calendar';
  const startHour = settings?.calendar_start_hour ?? 8;
  const endHour = settings?.calendar_end_hour ?? 21;

  const daysToShow = viewMode === 'week' ? 7 : viewMode === '3day' ? 3 : 1;
  const days = Array.from({ length: daysToShow }, (_, i) => {
    if (viewMode === '1day') {
      return addDays(current1DayStart, i);
    } else if (viewMode === '3day') {
      return addDays(current3DayStart, i);
    }
    return addDays(currentWeekStart, i);
  });

  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);

  const getDayOfWeekIndex = (date) => {
    const day = date.getDay();
    return day === 0 ? 6 : day - 1;
  };

  const getEventsForDay = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayIndex = getDayOfWeekIndex(date);
    
    return events.filter((event) => {
      // Google Calendar events always use specific_date
      if (event.source === 'google') {
        return event.specific_date === dateStr;
      }
      
      // Local one-time events
      if (event.is_recurring === false) {
        return event.specific_date === dateStr;
      }
      
      // Local recurring events
      if (event.days_of_week && event.days_of_week.includes(dayIndex)) {
        if (event.excluded_dates && event.excluded_dates.includes(dateStr)) {
          return false;
        }
        return true;
      }
      
      return false;
    });
  };

  const handleEventClick = (event, day) => {
    // Google Calendar events are read-only - open in Google Calendar instead
    if (event.source === 'google') {
      if (event.google_html_link) {
        window.open(event.google_html_link, '_blank');
      }
      return;
    }
    
    setEditingEvent(event);
    setCurrentDate(day);
    setShowEventModal(true);
  };

  const getEventPosition = (startTime) => {
    if (!startTime) return 0;
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes;
    const startMinutes = startHour * 60;
    const relativeMinutes = totalMinutes - startMinutes;
    return (relativeMinutes / 60) * 80;
  };

  const getEventHeight = (startTime, endTime) => {
    if (!startTime || !endTime) return 80;
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);
    const duration = (endHours * 60 + endMinutes) - (startHours * 60 + startMinutes);
    return (duration / 60) * 80;
  };

  // Calculate overlapping event positions
  const getTimeInMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const calculateEventColumns = (events) => {
    if (!events.length) return [];
    
    // Sort events by start time, then by end time
    const sortedEvents = [...events].sort((a, b) => {
      const aStart = getTimeInMinutes(a.start_time);
      const bStart = getTimeInMinutes(b.start_time);
      if (aStart !== bStart) return aStart - bStart;
      const aEnd = getTimeInMinutes(a.end_time);
      const bEnd = getTimeInMinutes(b.end_time);
      return aEnd - bEnd;
    });

    const columns = [];
    const eventColumns = new Map();

    for (const event of sortedEvents) {
      const eventStart = getTimeInMinutes(event.start_time);
      const eventEnd = getTimeInMinutes(event.end_time) || eventStart + 60;

      // Find the first available column
      let column = 0;
      while (true) {
        if (!columns[column]) {
          columns[column] = [];
        }
        
        // Check if this column has any overlapping events
        const hasOverlap = columns[column].some(existingEvent => {
          const existingStart = getTimeInMinutes(existingEvent.start_time);
          const existingEnd = getTimeInMinutes(existingEvent.end_time) || existingStart + 60;
          return eventStart < existingEnd && eventEnd > existingStart;
        });

        if (!hasOverlap) {
          columns[column].push(event);
          eventColumns.set(event.id, column);
          break;
        }
        column++;
      }
    }

    const totalColumns = columns.length;
    
    return sortedEvents.map(event => ({
      ...event,
      column: eventColumns.get(event.id),
      totalColumns
    }));
  };

  const handlePrevious = () => {
    if (viewMode === 'week') {
      setCurrentWeekStart(addDays(currentWeekStart, -7));
    } else if (viewMode === '3day') {
      setCurrent3DayStart(addDays(current3DayStart, -3));
    } else {
      setCurrent1DayStart(addDays(current1DayStart, -1));
    }
  };

  const handleNext = () => {
    if (viewMode === 'week') {
      setCurrentWeekStart(addDays(currentWeekStart, 7));
    } else if (viewMode === '3day') {
      setCurrent3DayStart(addDays(current3DayStart, 3));
    } else {
      setCurrent1DayStart(addDays(current1DayStart, 1));
    }
  };

  const isToday = (date) => {
    return format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-3 md:p-6">
      <div className="max-w-[1600px] mx-auto">
        <div className="flex items-center justify-between mb-4 md:mb-6 gap-2 md:gap-4">
          {/* Left - Title and navigation */}
          <div className="flex items-center gap-2 md:gap-4 min-w-0 flex-1">
            <h1 className="text-xl md:text-3xl font-light text-gray-900 truncate">
              {isMobile ? 'Calendar' : calendarTitle}
            </h1>
            <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
              <Button variant="ghost" size="icon" onClick={handlePrevious} className="h-8 w-8 md:h-10 md:w-10">
                <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleNext} className="h-8 w-8 md:h-10 md:w-10">
                <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
              </Button>
            </div>
          </div>
          
          {/* Center - View selector */}
          <Select value={viewMode} onValueChange={setViewMode}>
            <SelectTrigger className="w-28 h-8 text-sm md:w-40 md:h-10 md:text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1day">1-Day View</SelectItem>
              <SelectItem value="3day">3-Day View</SelectItem>
              <SelectItem value="week">Week View</SelectItem>
            </SelectContent>
          </Select>
          
          {/* Right - Icon buttons */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-8 w-8 md:h-10 md:w-10"
              title="Refresh calendar"
            >
              <RefreshCw className={`w-4 h-4 md:w-5 md:h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(createPageUrl('Home'))}
              className="h-8 w-8 md:h-10 md:w-10"
              title="Return to tablet display"
            >
              <Tablet className="w-4 h-4 md:w-5 md:h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettingsModal(true)}
              className="h-8 w-8 md:h-10 md:w-10"
            >
              <SettingsIcon className="w-4 h-4 md:w-5 md:h-5" />
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
          <div className="grid border-b border-gray-200" style={{ gridTemplateColumns: `50px repeat(${daysToShow}, 1fr)`, minWidth: viewMode === '1day' ? 'auto' : (isMobile ? '600px' : 'auto') }}>
            <div className="border-r border-gray-200" />
            {days.map((day, index) => (
              <div key={index} className="p-2 md:p-4 text-center border-r border-gray-200 last:border-r-0">
                <div className="text-xs md:text-sm text-gray-500 uppercase tracking-wider mb-1">
                  {format(day, isMobile && viewMode !== '1day' ? 'EEE' : 'EEEE')}
                </div>
                <div className={`inline-flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full text-lg md:text-xl ${
                  isToday(day) ? 'bg-blue-500 text-white font-semibold' : 'text-gray-900'
                }`}>
                  {format(day, 'd')}
                </div>
              </div>
            ))}
          </div>

          <div className="grid border-b border-gray-200" style={{ gridTemplateColumns: `50px repeat(${daysToShow}, 1fr)`, minWidth: viewMode === '1day' ? 'auto' : (isMobile ? '600px' : 'auto') }}>
            <div className="p-1 md:p-2 text-[0.65rem] md:text-xs text-gray-500 border-r border-gray-200 flex items-center justify-center">
              All Day
            </div>
            {days.map((day, dayIndex) => {
              const dayEvents = getEventsForDay(day);
              const allDayEvents = dayEvents.filter(e => e.is_all_day);
              return (
                <div key={dayIndex} className="p-1 md:p-2 min-h-[50px] md:min-h-[60px] border-r border-gray-200 last:border-r-0 flex items-center">
                  <div className="space-y-1 w-full">
                    {allDayEvents.map((event) => (
                      <div
                        key={event.id}
                        onClick={() => handleEventClick(event, day)}
                        className={`${COLOR_MAP[event.color] || 'bg-blue-400'} text-white text-[0.65rem] md:text-xs p-1.5 md:p-2 rounded cursor-pointer hover:opacity-90 relative ${event.source === 'google' ? 'pr-5' : ''}`}
                        title={event.source === 'google' ? 'Click to open in Google Calendar' : undefined}
                      >
                        <span className="break-words">
                          {event.title}
                        </span>
                        {event.source === 'google' && (
                          <div className="absolute top-1 right-1 w-3.5 h-3.5 flex-shrink-0">
                            <GoogleIcon className="w-full h-full" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="relative" style={{ minWidth: viewMode === '1day' ? 'auto' : (isMobile ? '600px' : 'auto') }}>
            {hours.map((hour) => (
              <div
                key={hour}
                className="grid border-b border-gray-200 last:border-b-0"
                style={{ gridTemplateColumns: `50px repeat(${daysToShow}, 1fr)`, height: '80px' }}
              >
                <div className="border-r border-gray-200 p-1 md:p-2 text-[0.65rem] md:text-xs text-gray-500 flex items-center justify-center">
                  {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                </div>
                {days.map((day, dayIndex) => (
                  <div key={dayIndex} className="border-r border-gray-200 last:border-r-0 relative" />
                ))}
              </div>
            ))}

            <div className="absolute inset-0 grid pointer-events-none" style={{ gridTemplateColumns: `50px repeat(${daysToShow}, 1fr)` }}>
              <div />
              {days.map((day, dayIndex) => {
                const dayEvents = getEventsForDay(day);
                const timedEvents = dayEvents.filter(e => !e.is_all_day && e.start_time);
                const eventsWithColumns = calculateEventColumns(timedEvents);
                
                return (
                  <div key={dayIndex} className="relative pointer-events-auto">
                    {eventsWithColumns.map((event) => {
                      const topPosition = getEventPosition(event.start_time);
                      const height = getEventHeight(event.start_time, event.end_time);
                      const { column, totalColumns } = event;
                      
                      // Calculate width and left position for overlapping events
                      const widthPercent = 100 / totalColumns;
                      const leftPercent = column * widthPercent;
                      const gap = 2; // Gap in pixels between overlapping events

                      // Determine if this is a short event (30 min or less)
                      const isShortEvent = height <= 44;
                      const minHeight = isShortEvent ? 42 : 30;

                      return (
                        <div
                          key={event.id}
                          onClick={() => handleEventClick(event, day)}
                          className={`${COLOR_MAP[event.color] || 'bg-blue-400'} text-white text-[0.65rem] md:text-xs p-1 md:p-1.5 rounded cursor-pointer hover:opacity-90 absolute overflow-hidden hover:z-20 ${event.source === 'google' ? 'border-l-2 border-white/50' : ''}`}
                          style={{
                            top: `${topPosition}px`,
                            left: `calc(${leftPercent}% + ${gap}px)`,
                            width: `calc(${widthPercent}% - ${gap * 2}px)`,
                            height: `${Math.max(height - 4, minHeight)}px`,
                            zIndex: 10 + column,
                          }}
                          title={event.source === 'google' ? 'Click to open in Google Calendar' : event.title}
                        >
                          {event.source === 'google' && (
                            <div className="absolute top-0.5 right-0.5 w-3.5 h-3.5">
                              <GoogleIcon className="w-full h-full" />
                            </div>
                          )}
                          <div className={`font-medium break-words ${isShortEvent ? 'line-clamp-1' : 'line-clamp-2'} ${event.source === 'google' ? 'pr-3' : ''}`}>
                            {event.title}
                          </div>
                          <div className="text-[0.6rem] md:text-[0.65rem] opacity-90 mt-0.5">
                            {event.start_time && format(new Date(`2000-01-01T${event.start_time}`), 'h:mm a')}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <button
          onClick={() => { 
            setEditingEvent(null);
            setCurrentDate(null);
            setShowEventModal(true); 
          }}
          className="fixed bottom-6 right-6 md:bottom-8 md:right-8 w-12 h-12 md:w-14 md:h-14 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110"
        >
          <Plus className="w-5 h-5 md:w-6 md:h-6" />
        </button>
      </div>

      <EventEditModal
        isOpen={showEventModal}
        onClose={closeModal}
        event={editingEvent}
        currentDate={currentDate}
        onCreateEvent={handleCreateEvent}
        onUpdateSeries={handleUpdateSeries}
        onUpdateOccurrence={handleUpdateOccurrence}
        onDeleteSeries={handleDeleteSeries}
        onDeleteOccurrence={handleDeleteOccurrence}
      />

      <CalendarSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
    </div>
  );
}
