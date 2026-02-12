import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '../hooks/useChat';
import { Conversation } from '../types/conversation.types';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { ConversationSidebar } from './ConversationSidebar';
import { SettingsPanel } from './SettingsPanel';

export const ChatInterface: React.FC = () => {
  const {
    conversations,
    activeConversation,
    isStreaming,
    error,
    settings,
    sendMessage,
    stopStreaming,
    setActiveConversation,
    createConversation,
    deleteConversation
  } = useChat();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeConversationData = conversations.find(c => c.id === activeConversation);

  // Auto-scroll vers le bas
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversationData?.messages]);

  const handleSendMessage = async (content: string, options?: any) => {
    if (!activeConversation) {
      await createConversation();
    }
    await sendMessage(content, options);
  };

  return (
    <div className={`chat-interface ${settings.theme} ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      {/* Sidebar */}
      <ConversationSidebar
        conversations={conversations as any}
        activeConversation={activeConversation}
        onConversationSelect={setActiveConversation}
        onNewConversation={createConversation}
        onConversationDelete={deleteConversation}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        isOpen={sidebarOpen}
      />

      {/* Zone principale */}
      <div className="chat-main">
        {/* Header */}
        <div className="chat-header">
          <div className="header-left">
            <button
              className="sidebar-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              ☰
            </button>
            <h2>
              {activeConversationData?.title || 'Nouvelle conversation'}
            </h2>
          </div>
          <div className="header-right">
            {activeConversationData && (
              <span className="model-info">
                {activeConversationData.metadata.provider} - {activeConversationData.metadata.model}
              </span>
            )}
            <button
              className="settings-button"
              onClick={() => setSettingsOpen(!settingsOpen)}
            >
              ⚙️
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="chat-messages">
          <MessageList
            messages={(activeConversationData?.messages || []) as any}
            isStreaming={isStreaming}
            onReaction={(messageId, emoji) => {
              // Gestion des réactions
            }}
          />
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="chat-input">
          <MessageInput
            onSend={handleSendMessage}
            onStop={stopStreaming}
            isStreaming={isStreaming}
            placeholder="Tapez votre message..."
          />
        </div>

        {/* Erreur */}
        {error && (
          <div className="error-banner">
            <span>⚠️ {error}</span>
            <button onClick={() => window.location.reload()}>Réessayer</button>
          </div>
        )}
      </div>

      {/* Settings Panel */}
      {settingsOpen && (
        <SettingsPanel
          settings={settings as any}
          onClose={() => setSettingsOpen(false)}
          onSettingsChange={(newSettings) => {
            // Mise à jour des settings
          }}
        />
      )}
    </div>
  );
};
