import React from 'react';
import { ConversationSettings } from '../types/conversation.types';

interface SettingsPanelProps {
  settings: ConversationSettings;
  onClose: () => void;
  onSettingsChange: (newSettings: Partial<ConversationSettings>) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  onClose,
  onSettingsChange
}) => {
  const providers = [
    { id: 'openai', name: 'OpenAI' },
    { id: 'anthropic', name: 'Anthropic' },
    { id: 'google', name: 'Google' },
    { id: 'local', name: 'Local LLM' }
  ];

  const models = {
    openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
    anthropic: ['claude-3-haiku', 'claude-3-sonnet', 'claude-3-opus'],
    google: ['gemini-pro', 'gemini-pro-vision'],
    local: ['llama-2-7b', 'llama-2-13b', 'custom']
  };

  const handleSettingChange = (key: keyof ConversationSettings, value: any) => {
    onSettingsChange({ [key]: value });
  };

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <h2>Paramètres</h2>
        <button className="close-btn" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="settings-content">
        <div className="settings-section">
          <h3>Paramètres de conversation</h3>
          <div className="setting-group">
            <label>Température:</label>
            <input 
              type="range" 
              min="0" 
              max="2" 
              step="0.1" 
              value={settings.temperature}
              onChange={(e) => handleSettingChange('temperature', parseFloat(e.target.value))}
            />
            <span>{settings.temperature}</span>
          </div>
          <div className="setting-group">
            <label>Max Tokens:</label>
            <input 
              type="number" 
              value={settings.maxTokens}
              onChange={(e) => handleSettingChange('maxTokens', parseInt(e.target.value))}
            />
          </div>
          <div className="setting-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.streamResponse}
                onChange={(e) => handleSettingChange('streamResponse', e.target.checked)}
              />
              Réponse en streaming
            </label>
          </div>
          <div className="setting-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.includeContext}
                onChange={(e) => handleSettingChange('includeContext', e.target.checked)}
              />
              Inclure le contexte
            </label>
          </div>
          <div className="setting-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.autoSave}
                onChange={(e) => handleSettingChange('autoSave', e.target.checked)}
              />
              Sauvegarde automatique
            </label>
          </div>
          <div className="setting-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.notifications}
                onChange={(e) => handleSettingChange('notifications', e.target.checked)}
              />
              Notifications
            </label>
          </div>
          <div className="setting-group">
            <label>Langue:</label>
            <select
              value={settings.language}
              onChange={(e) => handleSettingChange('language', e.target.value)}
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
              <option value="es">Español</option>
            </select>
          </div>
          <div className="setting-group">
            <label>Thème:</label>
            <select
              value={settings.theme}
              onChange={(e) => handleSettingChange('theme', e.target.value)}
            >
              <option value="light">Clair</option>
              <option value="dark">Sombre</option>
              <option value="auto">Auto</option>
            </select>
          </div>
        </div>

        <div className="settings-section">
          <h3>À propos</h3>
          <div className="about-info">
            <p>TwinMCP Chat Interface</p>
            <p>Version 1.0.0</p>
            <p>Interface de chat moderne avec support multi-providers</p>
          </div>
        </div>
      </div>

      <div className="settings-footer">
        <button className="reset-btn" onClick={() => window.location.reload()}>
          Réinitialiser
        </button>
        <button className="apply-btn" onClick={onClose}>
          Appliquer
        </button>
      </div>
    </div>
  );
};
