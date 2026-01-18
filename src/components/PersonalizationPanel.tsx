import React, { useState, useEffect } from 'react';
import { 
  UserPreferences, 
  Theme, 
  ThemePreferences,
  LayoutPreferences,
  ChatPreferences,
  NotificationPreferences,
  AccessibilityPreferences,
  PrivacyPreferences,
  PerformancePreferences,
  ShortcutPreferences
} from '../types/personalization.types';

interface PersonalizationPanelProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (preferences: UserPreferences) => void;
}

export const PersonalizationPanel: React.FC<PersonalizationPanelProps> = ({
  userId,
  isOpen,
  onClose,
  onSave
}) => {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [activeTab, setActiveTab] = useState<string>('theme');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Charger les préférences et thèmes au montage
  useEffect(() => {
    if (isOpen && userId) {
      loadPreferences();
      loadThemes();
    }
  }, [isOpen, userId]);

  const loadPreferences = async () => {
    try {
      const response = await fetch(`/api/personalization/preferences`, {
        headers: {
          'x-user-id': userId
        }
      });
      
      if (response.ok) {
        const result = await (response.json() as any);
        setPreferences(result.data);
      }
    } catch (err) {
      setError('Failed to load preferences');
    } finally {
      setIsLoading(false);
    }
  };

  const loadThemes = async () => {
    try {
      const response = await fetch(`/api/personalization/themes`, {
        headers: {
          'x-user-id': userId
        }
      });
      
      if (response.ok) {
        const result = await (response.json() as any);
        setThemes(result.data);
      }
    } catch (err) {
      console.error('Failed to load themes:', err);
    }
  };

  const handleSave = async () => {
    if (!preferences) return;

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/personalization/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId
        },
        body: JSON.stringify(preferences)
      });

      if (response.ok) {
        const result = await (response.json() as any);
        onSave(result.data);
        onClose();
      } else {
        setError('Failed to save preferences');
      }
    } catch (err) {
      setError('Failed to save preferences');
    } finally {
      setIsSaving(false);
    }
  };

  const updatePreferences = (section: keyof UserPreferences, updates: any) => {
    if (!preferences) return;

    setPreferences({
      ...preferences,
      [section]: {
        ...(preferences?.[section as keyof UserPreferences] as any),
        ...updates
      }
    });
  };

  const applyTheme = async (themeId: string) => {
    try {
      const response = await fetch(`/api/personalization/themes/${themeId}/apply`, {
        method: 'POST',
        headers: {
          'x-user-id': userId
        }
      });

      if (response.ok) {
        // Recharger les préférences après l'application du thème
        loadPreferences();
      }
    } catch (err) {
      setError('Failed to apply theme');
    }
  };

  const exportPreferences = async () => {
    try {
      const response = await fetch('/api/personalization/export', {
        headers: {
          'x-user-id': userId
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `personalization-preferences-${userId}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (err) {
      setError('Failed to export preferences');
    }
  };

  const importPreferences = async (file: File) => {
    try {
      const text = await file.text();
      const response = await fetch('/api/personalization/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId
        },
        body: JSON.stringify({ data: text })
      });

      if (response.ok) {
        const result = await (response.json() as any);
        setPreferences(result.data);
      } else {
        setError('Failed to import preferences');
      }
    } catch (err) {
      setError('Failed to import preferences');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Personalization Settings
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {['theme', 'layout', 'chat', 'notifications', 'accessibility', 'privacy', 'performance', 'shortcuts'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 text-sm font-medium capitalize ${
                activeTab === tab
                  ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          ) : error ? (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-red-600 dark:text-red-400">{error}</p>
            </div>
          ) : (
            <>
              {/* Theme Tab */}
              {activeTab === 'theme' && preferences && (
                <ThemeSettings
                  themePreferences={preferences.theme}
                  themes={themes}
                  onUpdate={(updates) => updatePreferences('theme', updates)}
                  onApplyTheme={applyTheme}
                />
              )}

              {/* Layout Tab */}
              {activeTab === 'layout' && preferences && (
                <LayoutSettings
                  layoutPreferences={preferences.layout}
                  onUpdate={(updates) => updatePreferences('layout', updates)}
                />
              )}

              {/* Chat Tab */}
              {activeTab === 'chat' && preferences && (
                <ChatSettings
                  chatPreferences={preferences.chat}
                  onUpdate={(updates) => updatePreferences('chat', updates)}
                />
              )}

              {/* Notifications Tab */}
              {activeTab === 'notifications' && preferences && (
                <NotificationSettings
                  notificationPreferences={preferences.notifications}
                  onUpdate={(updates) => updatePreferences('notifications', updates)}
                />
              )}

              {/* Accessibility Tab */}
              {activeTab === 'accessibility' && preferences && (
                <AccessibilitySettings
                  accessibilityPreferences={preferences.accessibility}
                  onUpdate={(updates) => updatePreferences('accessibility', updates)}
                />
              )}

              {/* Privacy Tab */}
              {activeTab === 'privacy' && preferences && (
                <PrivacySettings
                  privacyPreferences={preferences.privacy}
                  onUpdate={(updates) => updatePreferences('privacy', updates)}
                />
              )}

              {/* Performance Tab */}
              {activeTab === 'performance' && preferences && (
                <PerformanceSettings
                  performancePreferences={preferences.performance}
                  onUpdate={(updates) => updatePreferences('performance', updates)}
                />
              )}

              {/* Shortcuts Tab */}
              {activeTab === 'shortcuts' && preferences && (
                <ShortcutSettings
                  shortcutPreferences={preferences.shortcuts}
                  onUpdate={(updates) => updatePreferences('shortcuts', updates)}
                />
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex space-x-2">
            <button
              onClick={exportPreferences}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
            >
              Export
            </button>
            <label className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600">
              Import
              <input
                type="file"
                accept=".json"
                onChange={(e) => e.target.files?.[0] && importPreferences(e.target.files[0])}
                className="hidden"
              />
            </label>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Composants pour chaque section
const ThemeSettings: React.FC<{
  themePreferences: ThemePreferences;
  themes: Theme[];
  onUpdate: (updates: Partial<ThemePreferences>) => void;
  onApplyTheme: (themeId: string) => void;
}> = ({ themePreferences, themes, onUpdate, onApplyTheme }) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Theme Selection</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {themes.map((theme) => (
            <div
              key={theme.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-blue-500 cursor-pointer"
              onClick={() => onApplyTheme(theme.id)}
            >
              <div className="flex items-center space-x-3 mb-2">
                <div
                  className="w-8 h-8 rounded-full border-2 border-gray-300"
                  style={{ backgroundColor: theme.colors.primary }}
                />
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">{theme.name}</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{theme.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Custom Colors</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Primary Color
            </label>
            <input
              type="color"
              value={themePreferences.primaryColor}
              onChange={(e) => onUpdate({ primaryColor: e.target.value })}
              className="w-full h-10 rounded border border-gray-300 dark:border-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Accent Color
            </label>
            <input
              type="color"
              value={themePreferences.accentColor}
              onChange={(e) => onUpdate({ accentColor: e.target.value })}
              className="w-full h-10 rounded border border-gray-300 dark:border-gray-600"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Display Options</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Theme Mode
            </label>
            <select
              value={themePreferences.mode}
              onChange={(e) => onUpdate({ mode: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="auto">Auto</option>
              <option value="system">System</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Font Size
            </label>
            <select
              value={themePreferences.fontSize}
              onChange={(e) => onUpdate({ fontSize: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="xs">Extra Small</option>
              <option value="sm">Small</option>
              <option value="md">Medium</option>
              <option value="lg">Large</option>
              <option value="xl">Extra Large</option>
            </select>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="animations"
              checked={themePreferences.animations}
              onChange={(e) => onUpdate({ animations: e.target.checked })}
              className="rounded border-gray-300"
            />
            <label htmlFor="animations" className="text-sm text-gray-700 dark:text-gray-300">
              Enable animations
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

const LayoutSettings: React.FC<{
  layoutPreferences: LayoutPreferences;
  onUpdate: (updates: Partial<LayoutPreferences>) => void;
}> = ({ layoutPreferences, onUpdate }) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Sidebar Layout</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Sidebar Position
            </label>
            <select
              value={layoutPreferences.sidebarPosition}
              onChange={(e) => onUpdate({ sidebarPosition: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Sidebar Width
            </label>
            <input
              type="range"
              min="200"
              max="400"
              value={layoutPreferences.sidebarWidth}
              onChange={(e) => onUpdate({ sidebarWidth: parseInt(e.target.value) })}
              className="w-full"
            />
            <span className="text-sm text-gray-500">{layoutPreferences.sidebarWidth}px</span>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Display Options</h3>
        <div className="space-y-2">
          {[
            { key: 'showConversationList', label: 'Show conversation list' },
            { key: 'showModelSelector', label: 'Show model selector' },
            { key: 'showTimestamps', label: 'Show timestamps' },
            { key: 'showAvatars', label: 'Show avatars' },
            { key: 'showReactions', label: 'Show reactions' },
            { key: 'compactMode', label: 'Compact mode' }
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center space-x-2">
              <input
                type="checkbox"
                id={key}
                checked={layoutPreferences[key as keyof LayoutPreferences] as boolean}
                onChange={(e) => onUpdate({ [key]: e.target.checked })}
                className="rounded border-gray-300"
              />
              <label htmlFor={key} className="text-sm text-gray-700 dark:text-gray-300">
                {label}
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const ChatSettings: React.FC<{
  chatPreferences: ChatPreferences;
  onUpdate: (updates: Partial<ChatPreferences>) => void;
}> = ({ chatPreferences, onUpdate }) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Chat Configuration</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Default Provider
            </label>
            <input
              type="text"
              value={chatPreferences.defaultProvider}
              onChange={(e) => onUpdate({ defaultProvider: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Default Model
            </label>
            <input
              type="text"
              value={chatPreferences.defaultModel}
              onChange={(e) => onUpdate({ defaultModel: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Temperature
            </label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={chatPreferences.temperature}
              onChange={(e) => onUpdate({ temperature: parseFloat(e.target.value) })}
              className="w-full"
            />
            <span className="text-sm text-gray-500">{chatPreferences.temperature}</span>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Display Options</h3>
        <div className="space-y-2">
          {[
            { key: 'streamResponse', label: 'Stream responses' },
            { key: 'autoSave', label: 'Auto-save conversations' },
            { key: 'showContext', label: 'Show context' },
            { key: 'showTokenCount', label: 'Show token count' },
            { key: 'showCost', label: 'Show cost' },
            { key: 'showLatency', label: 'Show latency' },
            { key: 'autoScroll', label: 'Auto-scroll to new messages' }
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center space-x-2">
              <input
                type="checkbox"
                id={key}
                checked={chatPreferences[key as keyof ChatPreferences] as boolean}
                onChange={(e) => onUpdate({ [key]: e.target.checked })}
                className="rounded border-gray-300"
              />
              <label htmlFor={key} className="text-sm text-gray-700 dark:text-gray-300">
                {label}
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const NotificationSettings: React.FC<{
  notificationPreferences: NotificationPreferences;
  onUpdate: (updates: Partial<NotificationPreferences>) => void;
}> = ({ notificationPreferences, onUpdate }) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Notification Types</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            {[
              { key: 'desktop', label: 'Desktop notifications' },
              { key: 'sound', label: 'Sound notifications' },
              { key: 'email', label: 'Email notifications' }
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id={key}
                  checked={notificationPreferences[key as keyof NotificationPreferences] as boolean}
                  onChange={(e) => onUpdate({ [key]: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <label htmlFor={key} className="text-sm text-gray-700 dark:text-gray-300">
                  {label}
                </label>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Event Types</h3>
        <div className="space-y-2">
          {Object.entries(notificationPreferences.types).map(([key, value]) => (
            <div key={key} className="flex items-center space-x-2">
              <input
                type="checkbox"
                id={key}
                checked={value}
                onChange={(e) => onUpdate({
                  types: {
                    ...notificationPreferences.types,
                    [key]: e.target.checked
                  }
                })}
                className="rounded border-gray-300"
              />
              <label htmlFor={key} className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const AccessibilitySettings: React.FC<{
  accessibilityPreferences: AccessibilityPreferences;
  onUpdate: (updates: Partial<AccessibilityPreferences>) => void;
}> = ({ accessibilityPreferences, onUpdate }) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Accessibility Options</h3>
        <div className="space-y-2">
          {Object.entries(accessibilityPreferences).map(([key, value]) => {
            if (typeof value === 'boolean') {
              return (
                <div key={key} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={key}
                    checked={value}
                    onChange={(e) => onUpdate({ [key]: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor={key} className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </label>
                </div>
              );
            }
            return null;
          })}
        </div>
      </div>
    </div>
  );
};

const PrivacySettings: React.FC<{
  privacyPreferences: PrivacyPreferences;
  onUpdate: (updates: Partial<PrivacyPreferences>) => void;
}> = ({ privacyPreferences, onUpdate }) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Privacy Options</h3>
        <div className="space-y-2">
          {[
            { key: 'shareAnalytics', label: 'Share analytics data' },
            { key: 'shareConversations', label: 'Share conversations' },
            { key: 'saveHistory', label: 'Save conversation history' },
            { key: 'encryptMessages', label: 'Encrypt messages' },
            { key: 'gdprCompliance', label: 'GDPR compliance' }
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center space-x-2">
              <input
                type="checkbox"
                id={key}
                checked={privacyPreferences[key as keyof PrivacyPreferences] as boolean}
                onChange={(e) => onUpdate({ [key]: e.target.checked })}
                className="rounded border-gray-300"
              />
              <label htmlFor={key} className="text-sm text-gray-700 dark:text-gray-300">
                {label}
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const PerformanceSettings: React.FC<{
  performancePreferences: PerformancePreferences;
  onUpdate: (updates: Partial<PerformancePreferences>) => void;
}> = ({ performancePreferences, onUpdate }) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Performance Options</h3>
        <div className="space-y-2">
          {[
            { key: 'enableAnimations', label: 'Enable animations' },
            { key: 'enableTransitions', label: 'Enable transitions' },
            { key: 'enableShadows', label: 'Enable shadows' },
            { key: 'enableBlur', label: 'Enable blur effects' },
            { key: 'preloadContent', label: 'Preload content' },
            { key: 'lazyLoading', label: 'Lazy loading' }
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center space-x-2">
              <input
                type="checkbox"
                id={key}
                checked={performancePreferences[key as keyof PerformancePreferences] as boolean}
                onChange={(e) => onUpdate({ [key]: e.target.checked })}
                className="rounded border-gray-300"
              />
              <label htmlFor={key} className="text-sm text-gray-700 dark:text-gray-300">
                {label}
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const ShortcutSettings: React.FC<{
  shortcutPreferences: ShortcutPreferences;
  onUpdate: (updates: Partial<ShortcutPreferences>) => void;
}> = ({ shortcutPreferences, onUpdate }) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Keyboard Shortcuts</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Modifier Key
            </label>
            <select
              value={shortcutPreferences.modifierKey}
              onChange={(e) => onUpdate({ modifierKey: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="ctrl">Ctrl</option>
              <option value="alt">Alt</option>
              <option value="meta">Meta (Cmd)</option>
            </select>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="showHelp"
              checked={shortcutPreferences.showHelp}
              onChange={(e) => onUpdate({ showHelp: e.target.checked })}
              className="rounded border-gray-300"
            />
            <label htmlFor="showHelp" className="text-sm text-gray-700 dark:text-gray-300">
              Show shortcut help
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
