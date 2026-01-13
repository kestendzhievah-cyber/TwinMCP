# E8-Story8-1-Interface-Chat.md

## Epic 8: Chat Interface

### Story 8.1: Interface de chat

**Description**: Interface utilisateur moderne pour le chat avec LLM

---

## Objectif

Développer une interface de chat moderne et réactive avec support multi-providers, historique des conversations, gestion des contextes et interface responsive.

---

## Prérequis

- Service d'intégration LLM (Epic 7) opérationnel
- Service de prompts (Epic 7) disponible
- API Gateway (Epic 3) configurée
- Framework frontend (React/Next.js) prêt

---

## Spécifications Techniques

### 1. Architecture Frontend

#### 1.1 Composants Principaux

```typescript
// src/types/chat.types.ts
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata: {
    provider?: string;
    model?: string;
    tokens?: number;
    latency?: number;
    cost?: number;
    context?: any;
  };
  status: 'sending' | 'streaming' | 'completed' | 'error';
  reactions?: MessageReaction[];
  attachments?: MessageAttachment[];
}

export interface ChatConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  metadata: {
    userId: string;
    provider: string;
    model: string;
    systemPrompt?: string;
    createdAt: Date;
    updatedAt: Date;
    messageCount: number;
    totalTokens: number;
    totalCost: number;
  };
  settings: ConversationSettings;
}

export interface ConversationSettings {
  temperature: number;
  maxTokens: number;
  streamResponse: boolean;
  includeContext: boolean;
  contextSources: string[];
  autoSave: boolean;
  shareEnabled: boolean;
}

export interface ChatState {
  conversations: ChatConversation[];
  activeConversation: string | null;
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  settings: ChatSettings;
}

export interface ChatSettings {
  defaultProvider: string;
  defaultModel: string;
  theme: 'light' | 'dark' | 'auto';
  fontSize: 'small' | 'medium' | 'large';
  soundEnabled: boolean;
  notifications: boolean;
  autoSave: boolean;
}

export interface MessageReaction {
  id: string;
  emoji: string;
  userId: string;
  timestamp: Date;
}

export interface MessageAttachment {
  id: string;
  type: 'image' | 'file' | 'code' | 'link';
  name: string;
  url: string;
  size?: number;
  metadata?: any;
}
```

#### 1.2 Hook Principal de Chat

```typescript
// src/hooks/useChat.ts
import { useState, useCallback, useEffect, useRef } from 'react';
import { ChatState, ChatMessage, ChatConversation } from '../types/chat.types';

export const useChat = () => {
  const [state, setState] = useState<ChatState>({
    conversations: [],
    activeConversation: null,
    isLoading: false,
    isStreaming: false,
    error: null,
    settings: {
      defaultProvider: 'openai',
      defaultModel: 'gpt-3.5-turbo',
      theme: 'auto',
      fontSize: 'medium',
      soundEnabled: true,
      notifications: true,
      autoSave: true
    }
  });

  const [streamController, setStreamController] = useState<AbortController | null>(null);

  // Chargement des conversations
  const loadConversations = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      
      const response = await fetch('/api/chat/conversations');
      const data = await response.json();
      
      setState(prev => ({
        ...prev,
        conversations: data.conversations,
        isLoading: false
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error.message,
        isLoading: false
      }));
    }
  }, []);

  // Création d'une nouvelle conversation
  const createConversation = useCallback(async (title?: string) => {
    try {
      const response = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title || 'Nouvelle conversation',
          provider: state.settings.defaultProvider,
          model: state.settings.defaultModel
        })
      });

      const data = await response.json();
      
      setState(prev => ({
        ...prev,
        conversations: [...prev.conversations, data.conversation],
        activeConversation: data.conversation.id
      }));

      return data.conversation;
    } catch (error) {
      setState(prev => ({ ...prev, error: error.message }));
      throw error;
    }
  }, [state.settings]);

  // Envoi d'un message
  const sendMessage = useCallback(async (
    content: string,
    options: {
      stream?: boolean;
      context?: any;
      attachments?: MessageAttachment[];
    } = {}
  ) => {
    if (!state.activeConversation) {
      await createConversation();
    }

    const conversationId = state.activeConversation!;
    const messageId = crypto.randomUUID();

    // Message utilisateur
    const userMessage: ChatMessage = {
      id: messageId,
      role: 'user',
      content,
      timestamp: new Date(),
      metadata: {},
      status: 'completed',
      attachments: options.attachments
    };

    setState(prev => ({
      ...prev,
      conversations: prev.conversations.map(conv =>
        conv.id === conversationId
          ? { ...conv, messages: [...conv.messages, userMessage] }
          : conv
      )
    }));

    try {
      if (options.stream) {
        await sendMessageStream(conversationId, content, options);
      } else {
        await sendMessageBlocking(conversationId, content, options);
      }
    } catch (error) {
      // Message d'erreur
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Erreur: ${error.message}`,
        timestamp: new Date(),
        metadata: { error: error.message },
        status: 'error'
      };

      setState(prev => ({
        ...prev,
        conversations: prev.conversations.map(conv =>
          conv.id === conversationId
            ? { ...conv, messages: [...conv.messages, errorMessage] }
            : conv
        ),
        error: error.message
      }));
    }
  }, [state.activeConversation, createConversation]);

  // Envoi avec streaming
  const sendMessageStream = async (
    conversationId: string,
    content: string,
    options: any
  ) => {
    const controller = new AbortController();
    setStreamController(controller);

    // Message assistant en streaming
    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      metadata: {},
      status: 'streaming'
    };

    setState(prev => ({
      ...prev,
      isStreaming: true,
      conversations: prev.conversations.map(conv =>
        conv.id === conversationId
          ? { ...conv, messages: [...conv.messages, assistantMessage] }
          : conv
      )
    }));

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          message: content,
          ...options
        }),
        signal: controller.signal
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            
            setState(prev => ({
              ...prev,
              conversations: prev.conversations.map(conv =>
                conv.id === conversationId
                  ? {
                      ...conv,
                      messages: conv.messages.map(msg =>
                        msg.id === assistantMessage.id
                          ? {
                              ...msg,
                              content: msg.content + data.content,
                              metadata: { ...msg.metadata, ...data.metadata }
                            }
                          : msg
                      )
                    }
                  : conv
              )
            }));
          }
        }
      }

      // Finalisation
      setState(prev => ({
        ...prev,
        isStreaming: false,
        conversations: prev.conversations.map(conv =>
          conv.id === conversationId
            ? {
                ...conv,
                messages: conv.messages.map(msg =>
                  msg.id === assistantMessage.id
                    ? { ...msg, status: 'completed' }
                    : msg
                )
              }
            : conv
        )
      }));

    } catch (error) {
      if (error.name !== 'AbortError') {
        throw error;
      }
    } finally {
      setStreamController(null);
    }
  };

  // Arrêt du streaming
  const stopStreaming = useCallback(() => {
    if (streamController) {
      streamController.abort();
      setStreamController(null);
    }
    
    setState(prev => ({
      ...prev,
      isStreaming: false,
      conversations: prev.conversations.map(conv =>
        conv.id === prev.activeConversation
          ? {
              ...conv,
              messages: conv.messages.map(msg =>
                msg.status === 'streaming'
                  ? { ...msg, status: 'completed' }
                  : msg
              )
            }
          : conv
      )
    }));
  }, [streamController, state.activeConversation]);

  // Effet de chargement initial
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  return {
    ...state,
    loadConversations,
    createConversation,
    sendMessage,
    stopStreaming,
    setActiveConversation: (id: string) => setState(prev => ({ ...prev, activeConversation: id })),
    deleteConversation: async (id: string) => {
      await fetch(`/api/chat/conversations/${id}`, { method: 'DELETE' });
      setState(prev => ({
        ...prev,
        conversations: prev.conversations.filter(conv => conv.id !== id),
        activeConversation: prev.activeConversation === id ? null : prev.activeConversation
      }));
    }
  };
};
```

### 2. Composants UI

#### 2.1 Interface Principale

```typescript
// src/components/ChatInterface.tsx
import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '../hooks/useChat';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import ConversationSidebar from './ConversationSidebar';
import SettingsPanel from './SettingsPanel';

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
        conversations={conversations}
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
            messages={activeConversationData?.messages || []}
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
          settings={settings}
          onClose={() => setSettingsOpen(false)}
          onSettingsChange={(newSettings) => {
            // Mise à jour des settings
          }}
        />
      )}
    </div>
  );
};
```

#### 2.2 Composant Message Input

```typescript
// src/components/MessageInput.tsx
import React, { useState, useRef, useEffect } from 'react';
import { MessageAttachment } from '../types/chat.types';

interface MessageInputProps {
  onSend: (content: string, options?: any) => void;
  onStop: () => void;
  isStreaming: boolean;
  placeholder?: string;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  onSend,
  onStop,
  isStreaming,
  placeholder = "Tapez votre message..."
}) => {
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
  const [showOptions, setShowOptions] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize du textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [content]);

  const handleSend = () => {
    if (content.trim() || attachments.length > 0) {
      onSend(content.trim(), {
        stream: true,
        attachments
      });
      setContent('');
      setAttachments([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    files.forEach(file => {
      const attachment: MessageAttachment = {
        id: crypto.randomUUID(),
        type: file.type.startsWith('image/') ? 'image' : 'file',
        name: file.name,
        url: URL.createObjectURL(file),
        size: file.size
      };
      
      setAttachments(prev => [...prev, attachment]);
    });
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(att => att.id !== id));
  };

  return (
    <div className="message-input">
      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="attachments">
          {attachments.map(attachment => (
            <div key={attachment.id} className="attachment">
              <span className="attachment-name">{attachment.name}</span>
              <button
                className="attachment-remove"
                onClick={() => removeAttachment(attachment.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="input-container">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="message-textarea"
          disabled={isStreaming}
          rows={1}
        />

        <div className="input-actions">
          {/* File upload */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          
          <button
            className="action-button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isStreaming}
            title="Joindre un fichier"
          >
            📎
          </button>

          {/* Options */}
          <button
            className="action-button"
            onClick={() => setShowOptions(!showOptions)}
            disabled={isStreaming}
            title="Options"
          >
            ⚙️
          </button>

          {/* Send/Stop */}
          {isStreaming ? (
            <button
              className="stop-button"
              onClick={onStop}
              title="Arrêter"
            >
              ⏹️
            </button>
          ) : (
            <button
              className="send-button"
              onClick={handleSend}
              disabled={!content.trim() && attachments.length === 0}
              title="Envoyer"
            >
              ➤
            </button>
          )}
        </div>
      </div>

      {/* Options panel */}
      {showOptions && (
        <div className="input-options">
          <label>
            <input type="checkbox" defaultChecked />
            Inclure le contexte
          </label>
          <label>
            <input type="checkbox" defaultChecked />
            Réponse en streaming
          </label>
          <div>
            <label>Température:</label>
            <input type="range" min="0" max="2" step="0.1" defaultValue="0.7" />
          </div>
        </div>
      )}
    </div>
  );
};
```

---

## Tâches Détaillées

### 1. Hook de Chat
- [ ] Implémenter useChat hook
- [ ] Gérer l'état des conversations
- [ ] Ajouter le support streaming
- [ ] Gérer les erreurs et reconnexion

### 2. Composants UI
- [ ] Créer ChatInterface principal
- [ ] Développer MessageInput
- [ ] Implémenter MessageList
- [ ] Ajouter ConversationSidebar

### 3. Fonctionnalités Avancées
- [ ] Support des attachments
- [ ] Gestion des réactions
- [ ] Export des conversations
- [ ] Mode sombre/clair

### 4. Performance et UX
- [ ] Virtualisation des messages
- [ ] Auto-scroll intelligent
- [ ] Notifications
- [ ] Raccourcis clavier

---

## Validation

### Tests des Composants

```typescript
// __tests__/useChat.test.ts
import { renderHook, act } from '@testing-library/react';
import { useChat } from '../hooks/useChat';

describe('useChat', () => {
  it('should create new conversation', async () => {
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.createConversation('Test conversation');
    });

    expect(result.current.conversations).toHaveLength(1);
    expect(result.current.activeConversation).toBeDefined();
  });

  it('should send message with streaming', async () => {
    const { result } = renderHook(() => useChat());

    // Mock fetch
    global.fetch = jest.fn().mockResolvedValue({
      body: {
        getReader: () => ({
          read: () => Promise.resolve({
            done: true,
            value: new TextEncoder().encode('data: {"content": "test"}\n\n')
          })
        })
      }
    });

    await act(async () => {
      await result.current.sendMessage('Hello', { stream: true });
    });

    expect(result.current.isStreaming).toBe(false);
  });
});
```

---

## Architecture

### Composants

1. **useChat Hook**: Logique principale du chat
2. **ChatInterface**: Interface principale
3. **MessageList**: Liste des messages
4. **MessageInput**: Input des messages
5. **ConversationSidebar**: Sidebar des conversations

### Flux de Données

```
User Input → useChat Hook → API Request → Streaming Response → UI Update
```

---

## Performance

### Optimisations

- **Virtual Scrolling**: Pour les longues conversations
- **Message Caching**: Cache local des messages
- **Lazy Loading**: Chargement à la demande
- **Debounced Input**: Anti-rebond sur l'input

### Métriques Cibles

- **First Render**: < 100ms
- **Message Send**: < 50ms
- **Stream Latency**: < 200ms
- **Memory Usage**: < 50MB

---

## Monitoring

### Métriques

- `chat.messages.total`: Messages envoyés
- `chat.conversations.active`: Conversations actives
- `chat.streaming.duration`: Durée du streaming
- `chat.errors.rate`: Taux d'erreurs
- `chat.performance.latency`: Latence des réponses

---

## Livrables

1. **useChat Hook**: Hook complet
2. **ChatInterface**: Interface principale
3. **Message Components**: Composants de messages
4. **Settings Panel**: Panneau de configuration
5. **Tests**: Tests unitaires et intégration

---

## Critères de Succès

- [ ] Interface responsive et moderne
- [ ] Streaming temps réel fonctionnel
- [ ] Support multi-providers
- [ ] Performance < 100ms
- [ ] Tests avec couverture > 90%
- [ ] Accessibilité WCAG 2.1

---

## Suivi

### Post-Implémentation

1. **User Analytics**: Analyse du comportement
2. **Performance Monitoring**: Surveillance des performances
3. **A/B Testing**: Tests d'interface
4. **User Feedback**: Collecte des retours
