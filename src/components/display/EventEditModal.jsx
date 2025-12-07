
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';

const COLORS = [
  { name: 'red', class: 'bg-red-400' },
  { name: 'cyan', class: 'bg-cyan-400' },
  { name: 'blue', class: 'bg-blue-400' },
  { name: 'green', class: 'bg-green-400' },
  { name: 'yellow', class: 'bg-yellow-300' },
  { name: 'gray', class: 'bg-gray-400' },
  { name: 'purple', class: 'bg-purple-400' },
  { name: 'pink', class: 'bg-pink-400' },
  { name: 'orange', class: 'bg-orange-400' },
  { name: 'indigo', class: 'bg-indigo-400' },
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function EventEditModal({ 
  isOpen, 
  onClose, 
  event, 
  currentDate,
  onUpdateSeries,
  onUpdateOccurrence, 
  onCreateEvent,
  onDeleteSeries,
  onDeleteOccurrence 
}) {
  const [title, setTitle] = useState('');
  const [color, setColor] = useState('purple');
  const [isAllDay, setIsAllDay] = useState(false);
  const [isRecurring, setIsRecurring] = useState(true);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [selectedDays, setSelectedDays] = useState([0]);
  const [specificDate, setSpecificDate] = useState(null);

  useEffect(() => {
    if (event) {
      setTitle(event.title || '');
      setColor(event.color || 'purple');
      setIsAllDay(event.is_all_day || false);
      setIsRecurring(event.is_recurring !== false);
      setStartTime(event.start_time || '09:00');
      setEndTime(event.end_time || '10:00');
      setSelectedDays(event.days_of_week || [0]);
      
      // Fix: Use the event's specific_date if it exists (for one-off events)
      if (event.specific_date) {
        setSpecificDate(new Date(event.specific_date + 'T00:00:00'));
      } else {
        setSpecificDate(null);
      }
    } else {
      setTitle('');
      setColor('purple');
      setIsAllDay(false);
      setIsRecurring(true);
      setStartTime('09:00');
      setEndTime('10:00');
      setSelectedDays([0]);
      setSpecificDate(null);
    }
  }, [event]);

  const handleDayToggle = (dayIndex) => {
    if (selectedDays.includes(dayIndex)) {
      if (selectedDays.length > 1) {
        setSelectedDays(selectedDays.filter(d => d !== dayIndex));
      }
    } else {
      setSelectedDays([...selectedDays, dayIndex].sort());
    }
  };

  const handleUpdateSeries = () => {
    if (!event?.id) return;
    
    const eventData = {
      title,
      color,
      is_all_day: isAllDay,
      is_recurring: isRecurring,
      start_time: isAllDay ? null : startTime,
      end_time: isAllDay ? null : endTime,
      days_of_week: isRecurring ? selectedDays : null,
      specific_date: null,
      excluded_dates: event.excluded_dates || []
    };

    onUpdateSeries(event.id, eventData);
  };

  const handleUpdateOccurrence = () => {
    if (!event?.id || !currentDate) return;
    
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    
    const newOneTimeEvent = {
      title,
      color,
      is_all_day: isAllDay,
      is_recurring: false,
      start_time: isAllDay ? null : startTime,
      end_time: isAllDay ? null : endTime,
      specific_date: dateStr,
      days_of_week: null
    };

    onUpdateOccurrence(event.id, dateStr, newOneTimeEvent);
  };

  const handleUpdateOneTime = () => {
    if (!event?.id) return;
    
    const eventData = {
      title,
      color,
      is_all_day: isAllDay,
      is_recurring: false,
      start_time: isAllDay ? null : startTime,
      end_time: isAllDay ? null : endTime,
      specific_date: specificDate ? format(specificDate, 'yyyy-MM-dd') : event.specific_date,
      days_of_week: null
    };

    onUpdateSeries(event.id, eventData); // Reuse update series for one-time updates
  };

  const handleCreate = () => {
    const eventData = {
      title,
      color,
      is_all_day: isAllDay,
      is_recurring: isRecurring,
      start_time: isAllDay ? null : startTime,
      end_time: isAllDay ? null : endTime,
    };

    if (isRecurring) {
      eventData.days_of_week = selectedDays;
      eventData.specific_date = null;
    } else {
      eventData.specific_date = specificDate ? format(specificDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
      eventData.days_of_week = null;
    }

    onCreateEvent(eventData);
  };

  const handleDelete = () => {
    if (!event?.id) return;
    
    if (event.is_recurring !== false) {
      // It's a recurring series
      onDeleteSeries(event.id);
    } else {
      // It's a one-time event
      onDeleteSeries(event.id); // Same function, just delete the event
    }
  };

  const handleDeleteThisOccurrence = () => {
    if (!event?.id || !currentDate) return;
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    onDeleteOccurrence(event.id, dateStr);
  };

  const isRecurringSeries = event && event.is_recurring !== false;
  const isOneTimeEvent = event && event.is_recurring === false;
  const isNewEvent = !event;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm"
          />
          
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="w-full sm:max-w-xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl my-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
                <h2 className="text-xl sm:text-2xl font-normal text-gray-900">
                  {event ? 'Edit Event' : 'New Event'}
                </h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="text-gray-500 hover:bg-gray-100 h-8 w-8 sm:h-10 sm:w-10"
                >
                  <X className="w-5 h-5 sm:w-6 sm:h-6" />
                </Button>
              </div>

              {/* Content */}
              <div className="p-4 sm:p-6">
                <div className="space-y-4 sm:space-y-5">
                  {/* Event Title */}
                  <div className="space-y-2">
                    <Label className="text-sm sm:text-base text-gray-700">Event Title</Label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Event name"
                      className="h-11 sm:h-12 text-base border-2 border-gray-300 rounded-xl"
                    />
                  </div>

                  {/* All Day Event Toggle - MOVED HERE */}
                  <div className="flex items-center justify-between py-1">
                    <Label className="text-sm sm:text-base text-gray-700">All Day Event</Label>
                    <Switch
                      checked={isAllDay}
                      onCheckedChange={setIsAllDay}
                      className="data-[state=checked]:bg-blue-500"
                    />
                  </div>

                  {/* Repeat Weekly Toggle - only show for new events */}
                  {isNewEvent && (
                    <div className="flex items-center justify-between py-1">
                      <Label className="text-sm sm:text-base text-gray-700">Repeat Weekly</Label>
                      <Switch
                        checked={isRecurring}
                        onCheckedChange={setIsRecurring}
                        className="data-[state=checked]:bg-blue-500"
                      />
                    </div>
                  )}

                  {/* Days or Date Selector */}
                  {(isNewEvent && isRecurring) || isRecurringSeries ? (
                    <div className="space-y-2">
                      <Label className="text-sm sm:text-base text-gray-700">Days</Label>
                      <div className="flex flex-wrap gap-2">
                        {DAYS.map((day, index) => (
                          <button
                            key={day}
                            onClick={() => handleDayToggle(index)}
                            className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                              selectedDays.includes(index)
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                            }`}
                          >
                            {day}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label className="text-sm sm:text-base text-gray-700">Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full h-11 sm:h-12 text-base border-2 border-gray-300 rounded-xl justify-start text-left font-normal"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {specificDate ? format(specificDate, 'PPP') : 'Pick a date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={specificDate}
                            onSelect={setSpecificDate}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}

                  {/* Color */}
                  <div className="space-y-2">
                    <Label className="text-sm sm:text-base text-gray-700">Color</Label>
                    <div className="flex flex-wrap gap-2">
                      {COLORS.map((c) => (
                        <button
                          key={c.name}
                          onClick={() => setColor(c.name)}
                          className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full ${c.class} transition-all ${
                            color === c.name
                              ? 'ring-4 ring-blue-500 ring-offset-2'
                              : 'hover:scale-110'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Time Pickers */}
                  {!isAllDay && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-sm text-gray-700">Start Time</Label>
                        <Input
                          type="time"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          className="h-9 text-sm border-2 border-gray-300 rounded-lg px-2"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm text-gray-700">End Time</Label>
                        <Input
                          type="time"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          className="h-9 text-sm border-2 border-gray-300 rounded-lg px-2"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer with Action Buttons */}
              <div className="p-4 sm:p-6 border-t border-gray-200 space-y-3 bg-white">
                {/* Update Buttons */}
                {isRecurringSeries && (
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      onClick={handleUpdateOccurrence}
                      className="h-11 sm:h-12 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-xl"
                    >
                      Update Occurrence
                    </Button>
                    <Button
                      onClick={handleUpdateSeries}
                      className="h-11 sm:h-12 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-xl"
                    >
                      Update Series
                    </Button>
                  </div>
                )}

                {isOneTimeEvent && (
                  <Button
                    onClick={handleUpdateOneTime}
                    className="w-full h-11 sm:h-12 bg-blue-500 hover:bg-blue-600 text-white text-base rounded-xl"
                  >
                    Update
                  </Button>
                )}

                {isNewEvent && (
                  <Button
                    onClick={handleCreate}
                    className="w-full h-11 sm:h-12 bg-blue-500 hover:bg-blue-600 text-white text-base rounded-xl"
                  >
                    Create
                  </Button>
                )}
                
                {/* Delete Buttons */}
                {isRecurringSeries && (
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      onClick={handleDeleteThisOccurrence}
                      variant="outline"
                      className="h-11 sm:h-12 border-2 border-gray-300 text-orange-500 hover:bg-orange-50 text-sm rounded-xl"
                    >
                      <Trash2 className="w-4 h-4 mr-1.5" />
                      Delete Occurrence
                    </Button>
                    <Button
                      onClick={handleDelete}
                      variant="outline"
                      className="h-11 sm:h-12 border-2 border-gray-300 text-red-500 hover:bg-red-50 text-sm rounded-xl"
                    >
                      <Trash2 className="w-4 h-4 mr-1.5" />
                      Delete Series
                    </Button>
                  </div>
                )}

                {isOneTimeEvent && (
                  <Button
                    onClick={handleDelete}
                    variant="outline"
                    className="w-full h-11 sm:h-12 border-2 border-gray-300 text-red-500 hover:bg-red-50 text-base rounded-xl"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
