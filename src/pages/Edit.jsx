
import React, { useState, useRef } from 'react';
import { fetchSettings, saveSettings, uploadBackgroundImage } from '@/api/dataClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Upload, Save, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function Edit() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [showSampleEvents, setShowSampleEvents] = useState(true);
  const [googleCalendarId, setGoogleCalendarId] = useState('');
  const [googleApiKey, setGoogleApiKey] = useState('');

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
    initialData: null,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data) => saveSettings({ ...(settings ?? {}), ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await uploadBackgroundImage(file);
      setImageUrl(file_url);
    } catch (error) {
      console.error('Error uploading file:', error);
    }
    setUploading(false);
  };

  const handleSave = async () => {
    const dataToSave = {
      background_image_url: imageUrl || settings?.background_image_url,
      show_sample_events: showSampleEvents,
      google_calendar_id: googleCalendarId,
      google_calendar_api_key: googleApiKey,
    };
    await updateSettingsMutation.mutateAsync(dataToSave);
    navigate(createPageUrl('Home'));
  };

  React.useEffect(() => {
    if (settings) {
      setImageUrl(settings.background_image_url || '');
      setShowSampleEvents(settings.show_sample_events !== false);
      setGoogleCalendarId(settings.google_calendar_id || '');
      setGoogleApiKey(settings.google_calendar_api_key || '');
    }
  }, [settings]);

  const currentBg = imageUrl || settings?.background_image_url || 'https://images.unsplash.com/photo-1511497584788-876760111969?q=80&w=3432&auto=format&fit=crop';

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background Preview */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat transition-all duration-1000"
        style={{
          backgroundImage: `url(${currentBg})`,
        }}
      />
      <div className="fixed inset-0 bg-black/40" />

      {/* Content */}
      <div className="relative z-10 min-h-screen p-8 flex items-center justify-center">
        <Card className="w-full max-w-2xl glass-card border-white/20">
          <CardHeader className="border-b border-white/10">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(createPageUrl('Home'))}
                className="text-white hover:bg-white/10"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <CardTitle className="text-3xl font-light text-white">Display Settings</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-8 space-y-8">
            {/* Background Image Upload */}
            <div className="space-y-4">
              <Label className="text-lg text-white/90">Background Image</Label>
              
              <div className="space-y-4">
                <div
                  className="w-full h-48 rounded-xl overflow-hidden border-2 border-white/20 bg-cover bg-center"
                  style={{ backgroundImage: `url(${currentBg})` }}
                />

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  variant="outline"
                  className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20"
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload New Background
                    </>
                  )}
                </Button>
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-white/70">Or paste image URL:</Label>
                <Input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                />
              </div>
            </div>

            {/* Calendar Settings */}
            <div className="space-y-4 pt-4 border-t border-white/10">
              <Label className="text-lg text-white/90">Calendar Settings</Label>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-white/90">Show Sample Events</Label>
                  <p className="text-sm text-white/60">Display demo calendar events</p>
                </div>
                <Switch
                  checked={showSampleEvents}
                  onCheckedChange={setShowSampleEvents}
                />
              </div>

              <div className="space-y-4 pt-4">
                <p className="text-sm text-white/70">Google Calendar Integration (Coming Soon)</p>
                <div className="space-y-2">
                  <Label className="text-sm text-white/70">Google Calendar ID:</Label>
                  <Input
                    value={googleCalendarId}
                    onChange={(e) => setGoogleCalendarId(e.target.value)}
                    placeholder="your-calendar-id@group.calendar.google.com"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-white/70">Google API Key:</Label>
                  <Input
                    type="password"
                    value={googleApiKey}
                    onChange={(e) => setGoogleApiKey(e.target.value)}
                    placeholder="Your Google API Key"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                  />
                </div>
              </div>
            </div>

            {/* Save Button */}
            <Button
              onClick={handleSave}
              disabled={updateSettingsMutation.isPending}
              className="w-full bg-white text-black hover:bg-white/90 text-lg h-12"
            >
              {updateSettingsMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5 mr-2" />
                  Save Settings
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      <style>{`
        .glass-card {
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }
      `}</style>
    </div>
  );
}
