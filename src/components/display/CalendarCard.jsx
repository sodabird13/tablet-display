import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, addDays, startOfDay } from 'date-fns';
// Google "G" icon component (white/greyscale version - very faint)
const GoogleIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="white" opacity="0.35">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);
import {
  listCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from '@/api/dataClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import EventEditModal from './EventEditModal';

const COLOR_MAP = {
  red: 'bg-red-400/80',
  cyan: 'bg-cyan-400/80',
  blue: 'bg-blue-400/80',
  green: 'bg-green-400/80',
  yellow: 'bg-yellow-300/80',
  gray: 'bg-gray-400/80',
  purple: 'bg-purple-400/80',
  pink: 'bg-pink-400/80',
  orange: 'bg-orange-400/80',
  indigo: 'bg-indigo-400/80'
};

export default function CalendarCard() {
  const [viewMode, setViewMode] = useState(1);
  const [dragStart, setDragStart] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [editingEventDate, setEditingEventDate] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const containerRef = useRef(null);
  const queryClient = useQueryClient();
  const [calendarBaseDate, setCalendarBaseDate] = useState(startOfDay(new Date()));

  useEffect(() => {
    const scheduleMidnightUpdate = () => {
      const now = new Date();
      const nextDay = addDays(startOfDay(now), 1);
      const targetTime = new Date(nextDay.getFullYear(), nextDay.getMonth(), nextDay.getDate(), 0, 1, 0, 0);
      let timeUntilTarget = targetTime.getTime() - now.getTime();

      if (timeUntilTarget < 0) {
        const dayAfterNext = addDays(nextDay, 1);
        const newTargetTime = new Date(dayAfterNext.getFullYear(), dayAfterNext.getMonth(), dayAfterNext.getDate(), 0, 1, 0, 0);
        timeUntilTarget = newTargetTime.getTime() - now.getTime();
      }

      const timeoutId = setTimeout(() => {
        setCalendarBaseDate(startOfDay(new Date()));
        queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
        scheduleMidnightUpdate();
      }, timeUntilTarget);

      return () => clearTimeout(timeoutId);
    };

    const cleanup = scheduleMidnightUpdate();
    return cleanup;
  }, [queryClient]);

  const { data: events = [] } = useQuery({
    queryKey: ['calendar-events'],
    queryFn: listCalendarEvents,
    initialData: [],
    refetchInterval: 300000, // 5 minutes
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
    setShowEditModal(false);
    setEditingEvent(null);
    setEditingEventDate(null);
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

  const viewModes = [1, 3, 5];
  const daysToShow = viewModes[viewMode];

  const handleTouchStart = (e) => {
    setDragStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e) => {
    if (!dragStart) return;
    const dragEnd = e.changedTouches[0].clientX;
    const diff = dragStart - dragEnd;

    if (Math.abs(diff) > 50) {
      if (diff > 0 && viewMode < 2) {
        setViewMode(viewMode + 1);
      } else if (diff < 0 && viewMode > 0) {
        setViewMode(viewMode - 1);
      }
    }
    setDragStart(null);
  };

  const handleMouseDown = (e) => {
    setDragStart(e.clientX);
  };

  const handleMouseUp = (e) => {
    if (!dragStart) return;
    const dragEnd = e.clientX;
    const diff = dragStart - dragEnd;

    if (Math.abs(diff) > 50) {
      if (diff > 0 && viewMode < 2) {
        setViewMode(viewMode + 1);
      } else if (diff < 0 && viewMode > 0) {
        setViewMode(viewMode - 1);
      }
    }
    setDragStart(null);
  };

  const handleEventClick = (event, date) => {
    // Google Calendar events are read-only - open in Google Calendar instead
    if (event.source === 'google') {
      if (event.google_html_link) {
        window.open(event.google_html_link, '_blank');
      }
      return;
    }
    
    setEditingEvent(event);
    setEditingEventDate(date);
    setShowEditModal(true);
  };

  const handleAddEvent = () => {
    setEditingEvent(null);
    setEditingEventDate(null);
    setShowEditModal(true);
  };

  const formatTime12hr = (time24) => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    let hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    hour = hour ? hour : 12;
    return `${hour}:${minutes} ${ampm}`;
  };

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

  const renderDay = (date, index) => {
    const dayEvents = getEventsForDay(date);
    const allDayEvents = dayEvents.filter((e) => e.is_all_day);
    const timedEvents = dayEvents
      .filter((e) => !e.is_all_day)
      .sort((a, b) => {
        if (!a.start_time) return 1;
        if (!b.start_time) return -1;
        return a.start_time.localeCompare(b.start_time);
      });

    const isToday = format(date, 'yyyy-MM-dd') === format(calendarBaseDate, 'yyyy-MM-dd');
    const isFiveDayView = viewMode === 2;

    return (
      <div key={index} className="px-4 flex-1 min-w-0 border-r-2 border-white/30 last:border-r-0 flex flex-col">
        <div
          className="text-center mb-5 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={handleAddEvent}>
          <div className={`inline-flex flex-col items-center justify-center rounded-2xl transition-all ${isToday ? `bg-white/30 border-2 border-white/50 ${isFiveDayView ? 'px-3 py-1' : 'px-6 py-2'}` : 'px-2 py-2'}`}>
            <div className="text-sm text-white/60 uppercase tracking-wider">
              {format(date, 'EEE')}
            </div>
            <div className={`text-3xl text-white ${isToday ? 'font-bold' : 'font-light'}`}>
              {format(date, 'd')}
            </div>
          </div>
        </div>

        <div className="space-y-2 mb-3.5 h-[54px] pr-2 flex flex-col justify-start">
          {allDayEvents.map((event) => (
            <div
              key={event.id}
              onClick={() => handleEventClick(event, date)}
              className={`${COLOR_MAP[event.color] || 'bg-blue-400/80'} rounded-lg p-2 text-white cursor-pointer hover:scale-[1.02] transition-transform origin-center relative`}
              title={event.source === 'google' ? 'Click to open in Google Calendar' : undefined}>
              {event.source === 'google' && (
                <div className="absolute top-1 right-1 w-4 h-4">
                  <GoogleIcon className="w-full h-full" />
                </div>
              )}
              <div className={`font-medium break-words ${isFiveDayView ? 'text-xs' : 'text-sm'} ${event.source === 'google' ? 'pr-4' : ''}`}>
                {event.title}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2 overflow-y-auto max-h-[390px] pr-2 flex-1">
          {timedEvents.map((event) => (
            <div
              key={event.id}
              onClick={() => handleEventClick(event, date)}
              className={`${COLOR_MAP[event.color] || 'bg-blue-400/80'} rounded-lg p-2.5 text-white cursor-pointer hover:scale-[1.02] transition-transform origin-center relative`}
              title={event.source === 'google' ? 'Click to open in Google Calendar' : undefined}>
              {event.source === 'google' && (
                <div className="absolute top-1.5 right-1.5 w-4 h-4">
                  <GoogleIcon className="w-full h-full" />
                </div>
              )}
              <div className={`font-medium break-words ${isFiveDayView ? 'text-xs' : 'text-sm'} ${event.source === 'google' ? 'pr-5' : ''}`}>
                {event.title}
              </div>
              <div className={`opacity-90 mt-1 ${isFiveDayView ? 'text-[0.65rem]' : 'text-xs'}`}>
                {formatTime12hr(event.start_time)}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const days = Array.from({ length: daysToShow }, (_, i) => addDays(calendarBaseDate, i));

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.5 }}
        className="glass-card p-4 pb-3 h-[575px] flex flex-col cursor-grab active:cursor-grabbing relative"
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}>
        <AnimatePresence mode="wait">
          <motion.div
            key={viewMode}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex gap-4 overflow-hidden">
            {days.map((day, index) => renderDay(day, index))}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      <EventEditModal
        isOpen={showEditModal}
        onClose={closeModal}
        event={editingEvent}
        currentDate={editingEventDate}
        onCreateEvent={handleCreateEvent}
        onUpdateSeries={handleUpdateSeries}
        onUpdateOccurrence={handleUpdateOccurrence}
        onDeleteSeries={handleDeleteSeries}
        onDeleteOccurrence={handleDeleteOccurrence}
      />
    </>
  );
}