import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchSettings, saveSettings } from '@/api/dataClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function CalendarSettingsModal({ isOpen, onClose }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('Weekly Calendar');
  const [startHour, setStartHour] = useState(8);
  const [endHour, setEndHour] = useState(21);

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
    initialData: null,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data) => saveSettings({ ...(settings ?? {}), ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      onClose();
    },
  });

  useEffect(() => {
    if (settings) {
      setTitle(settings.calendar_title || 'Weekly Calendar');
      setStartHour(settings.calendar_start_hour ?? 8);
      setEndHour(settings.calendar_end_hour ?? 21);
    }
  }, [settings]);

  const handleSave = () => {
    updateSettingsMutation.mutate({
      ...settings,
      calendar_title: title,
      calendar_start_hour: startHour,
      calendar_end_hour: endHour,
    });
  };

  const hours = Array.from({ length: 24 }, (_, i) => ({
    value: i,
    label: i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`
  }));

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-50"
          />
          
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-md bg-white rounded-2xl shadow-xl"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-normal text-gray-900">Calendar Settings</h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="text-gray-500 hover:bg-gray-100"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-base text-gray-700">Calendar Title</Label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Weekly Calendar"
                      className="h-12 text-base"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label className="text-base text-gray-700">Display Hours</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm text-gray-600">From</Label>
                        <Select value={String(startHour)} onValueChange={(v) => setStartHour(Number(v))}>
                          <SelectTrigger className="h-12">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {hours.map((h) => (
                              <SelectItem key={h.value} value={String(h.value)}>
                                {h.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-gray-600">To</Label>
                        <Select value={String(endHour)} onValueChange={(v) => setEndHour(Number(v))}>
                          <SelectTrigger className="h-12">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {hours.map((h) => (
                              <SelectItem key={h.value} value={String(h.value)}>
                                {h.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={handleSave}
                    disabled={updateSettingsMutation.isPending}
                    className="w-full h-12 bg-blue-500 hover:bg-blue-600 text-white text-base"
                  >
                    {updateSettingsMutation.isPending ? 'Saving...' : 'Save Settings'}
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}