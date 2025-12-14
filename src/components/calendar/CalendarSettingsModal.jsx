import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, AlertCircle, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchSettings, saveSettings } from '@/api/dataClient';
import { testGoogleCalendarConnection, isServiceAccountConfigured } from '@/api/googleCalendar';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function CalendarSettingsModal({ isOpen, onClose }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('Weekly Calendar');
  const [startHour, setStartHour] = useState(8);
  const [endHour, setEndHour] = useState(21);
  const [googleCalendarId, setGoogleCalendarId] = useState('');
  const [googleApiKey, setGoogleApiKey] = useState('');
  const [connectionStatus, setConnectionStatus] = useState(null); // 'testing' | 'success' | 'error'
  const [connectionMessage, setConnectionMessage] = useState('');

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
    initialData: null,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data) => saveSettings({ ...(settings ?? {}), ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      onClose();
    },
  });

  useEffect(() => {
    if (settings) {
      setTitle(settings.calendar_title || 'Weekly Calendar');
      setStartHour(settings.calendar_start_hour ?? 8);
      setEndHour(settings.calendar_end_hour ?? 21);
      setGoogleCalendarId(settings.google_calendar_id || '');
      setGoogleApiKey(settings.google_calendar_api_key || '');
    }
  }, [settings]);

  const handleTestConnection = async () => {
    // Service account only requires Calendar ID
    if (isServiceAccountConfigured()) {
      if (!googleCalendarId) {
        setConnectionStatus('error');
        setConnectionMessage('Please enter a Calendar ID');
        return;
      }
    } else {
      if (!googleCalendarId || !googleApiKey) {
        setConnectionStatus('error');
        setConnectionMessage('Please enter both Calendar ID and API Key');
        return;
      }
    }

    setConnectionStatus('testing');
    setConnectionMessage('Testing connection...');

    const result = await testGoogleCalendarConnection(googleCalendarId, googleApiKey);
    
    if (result.success) {
      setConnectionStatus('success');
      setConnectionMessage(`Connected to: ${result.calendarName}`);
    } else {
      setConnectionStatus('error');
      setConnectionMessage(result.error);
    }
  };

  const handleClearGoogleCalendar = () => {
    setGoogleCalendarId('');
    setGoogleApiKey('');
    setConnectionStatus(null);
    setConnectionMessage('');
  };

  const handleSave = () => {
    updateSettingsMutation.mutate({
      ...settings,
      calendar_title: title,
      calendar_start_hour: startHour,
      calendar_end_hour: endHour,
      google_calendar_id: googleCalendarId || null,
      google_calendar_api_key: googleApiKey || null,
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

                <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
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

                  {/* Google Calendar Integration */}
                  <div className="border-t border-gray-200 pt-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-base text-gray-700">Google Calendar</Label>
                      {isServiceAccountConfigured() && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Service Account
                        </span>
                      )}
                    </div>

                    {isServiceAccountConfigured() ? (
                      <>
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <p className="text-xs text-green-700">
                            <strong>✓ Service Account configured.</strong> This allows access to private calendars. 
                            Just enter your Calendar ID below and make sure you've shared the calendar with the service account.
                          </p>
                        </div>
                        
                        <div className="space-y-2">
                          <Label className="text-sm text-gray-600">Calendar ID</Label>
                          <Input
                            value={googleCalendarId}
                            onChange={(e) => {
                              setGoogleCalendarId(e.target.value);
                              setConnectionStatus(null);
                            }}
                            placeholder="yourname@gmail.com or calendar ID"
                            className="h-10 text-sm font-mono"
                          />
                          <p className="text-xs text-gray-500">
                            Find this in Google Calendar → Settings → Integrate calendar
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleTestConnection}
                            disabled={connectionStatus === 'testing' || !googleCalendarId}
                            className="flex-1 h-10"
                          >
                            {connectionStatus === 'testing' && (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            )}
                            Test Connection
                          </Button>
                          {googleCalendarId && (
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={handleClearGoogleCalendar}
                              className="h-10 text-gray-500 hover:text-red-500"
                            >
                              Clear
                            </Button>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <Label className="text-sm text-gray-600">Calendar ID</Label>
                          <Input
                            value={googleCalendarId}
                            onChange={(e) => {
                              setGoogleCalendarId(e.target.value);
                              setConnectionStatus(null);
                            }}
                            placeholder="yourname@gmail.com or calendar ID"
                            className="h-10 text-sm font-mono"
                          />
                          <p className="text-xs text-gray-500">
                            Find this in Google Calendar → Settings → Integrate calendar
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm text-gray-600">API Key</Label>
                          <Input
                            type="password"
                            value={googleApiKey}
                            onChange={(e) => {
                              setGoogleApiKey(e.target.value);
                              setConnectionStatus(null);
                            }}
                            placeholder="Your Google API Key"
                            className="h-10 text-sm font-mono"
                          />
                          <p className="text-xs text-gray-500">
                            Create at Google Cloud Console → APIs & Services → Credentials
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleTestConnection}
                            disabled={connectionStatus === 'testing' || !googleCalendarId || !googleApiKey}
                            className="flex-1 h-10"
                          >
                            {connectionStatus === 'testing' && (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            )}
                            Test Connection
                          </Button>
                          {(googleCalendarId || googleApiKey) && (
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={handleClearGoogleCalendar}
                              className="h-10 text-gray-500 hover:text-red-500"
                            >
                              Clear
                            </Button>
                          )}
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <p className="text-xs text-blue-700">
                            <strong>Note:</strong> Without a service account, your calendar must be public.
                            For private calendars, configure service account credentials in .env.local
                          </p>
                        </div>
                      </>
                    )}

                    {connectionStatus && connectionStatus !== 'testing' && (
                      <div className={`flex items-start gap-2 p-3 rounded-lg ${
                        connectionStatus === 'success' 
                          ? 'bg-green-50 text-green-700' 
                          : 'bg-red-50 text-red-700'
                      }`}>
                        {connectionStatus === 'success' ? (
                          <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        )}
                        <p className="text-sm">{connectionMessage}</p>
                      </div>
                    )}
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