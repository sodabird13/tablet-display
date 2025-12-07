
import React, { useState, useEffect } from 'react';
import {
  fetchSettings,
  listCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from '@/api/dataClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addDays, startOfWeek, startOfDay } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Plus, Settings as SettingsIcon, ChevronLeft, ChevronRight } from 'lucide-react';
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
    refetchInterval: 30000,
    refetchOnMount: true,
    refetchOnWindowFocus: true
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
      if (event.is_recurring === false) {
        return event.specific_date === dateStr;
      }
      
      if (event.days_of_week && event.days_of_week.includes(dayIndex)) {
        if (event.excluded_dates && event.excluded_dates.includes(dateStr)) {
          return false;
        }
        return true;
      }
      
      return false;
    });
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
      <button
        onClick={() => navigate(createPageUrl('Home'))}
        className="fixed bottom-0 left-0 w-16 h-16 opacity-0 hover:opacity-10 bg-gray-200 transition-opacity z-50"
        aria-label="Return to home"
      />

      <div className="max-w-[1600px] mx-auto">
        <div className="flex items-center justify-between mb-4 md:mb-6 gap-2 md:gap-4">
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
          <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettingsModal(true)}
              className="hidden md:flex h-8 w-8 md:h-10 md:w-10"
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
                        onClick={() => { setEditingEvent(event); setCurrentDate(day); setShowEventModal(true); }}
                        className={`${COLOR_MAP[event.color] || 'bg-blue-400'} text-white text-[0.65rem] md:text-xs p-1.5 md:p-2 rounded cursor-pointer hover:opacity-90`}
                      >
                        {event.title}
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
                
                return (
                  <div key={dayIndex} className="relative pointer-events-auto">
                    {timedEvents.map((event) => {
                      const topPosition = getEventPosition(event.start_time);
                      const height = getEventHeight(event.start_time, event.end_time);

                      return (
                        <div
                          key={event.id}
                          onClick={() => { setEditingEvent(event); setCurrentDate(day); setShowEventModal(true); }}
                          className={`${COLOR_MAP[event.color] || 'bg-blue-400'} text-white text-[0.65rem] md:text-xs p-1.5 md:p-2 rounded cursor-pointer hover:opacity-90 absolute overflow-hidden`}
                          style={{
                            top: `${topPosition}px`,
                            left: '4px',
                            right: '4px',
                            height: `${Math.max(height - 4, 30)}px`,
                            zIndex: 10,
                          }}
                        >
                          <div className="font-medium truncate">{event.title}</div>
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
