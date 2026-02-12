import { useState, useCallback, useEffect, useRef } from 'react';
import { ChatState, ChatMessage, ChatConversation, MessageAttachment, ChatSettings } from '../types/chat.types';
import { ContextQuery, ContextResult, ContextOptions, ContextFilters } from '../types/context-intelligent.types';

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
  const [contextEnabled, setContextEnabled] = useState(true);
  const [contextResults, setContextResults] = useState<Map<string, ContextResult>>(new Map());

  // Traitement du contexte intelligent
  const processContext = useCallback(async (message: string, conversationId: string): Promise<ContextResult | null> => {
    if (!contextEnabled) return null;

    try {
      const contextQuery: ContextQuery = {
        id: crypto.randomUUID(),
        conversationId,
        messageId: crypto.randomUUID(),
        query: message,
        intent: {} as any,
        entities: [],
        filters: {
          languages: ['javascript', 'typescript'],
          types: ['documentation', 'code', 'example'],
          minRelevance: 0.7,
          maxResults: 20
        },
        options: {
          includeCode: true,
          includeExamples: true,
          includeAPI: true,
          preferRecent: true,
          maxContextLength: 4000,
          chunkOverlap: 100,
          diversityThreshold: 0.7,
          rerankResults: true,
          maxResults: 20
        },
        timestamp: new Date()
      };

      const response = await fetch('/api/context/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contextQuery)
      });

      if (!response.ok) return null;

      const result = await response.json() as ContextResult;
      setContextResults(prev => new Map(prev.set(conversationId, result)));
      
      return result;
    } catch (error) {
      console.error('Context processing error:', error);
      return null;
    }
  }, [contextEnabled]);

  // Chargement des conversations
  const loadConversations = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      
      const response = await fetch('/api/chat/conversations');
      if (!response.ok) throw new Error('Failed to load conversations');
      
      const data = await response.json() as { conversations: ChatConversation[] };
      
      setState(prev => ({
        ...prev,
        conversations: data.conversations || [],
        isLoading: false
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error',
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

      if (!response.ok) throw new Error('Failed to create conversation');

      const data = await response.json() as { conversation: ChatConversation };
      
      setState(prev => ({
        ...prev,
        conversations: [...prev.conversations, data.conversation],
        activeConversation: data.conversation.id
      }));

      return data.conversation;
    } catch (error) {
      setState(prev => ({ ...prev, error: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error' }));
      throw error;
    }
  }, [state.settings]);

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

      if (!response.ok) throw new Error('Stream request failed');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No reader available');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
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
                                content: msg.content + (data.content || ''),
                                metadata: { ...msg.metadata, ...data.metadata }
                              }
                            : msg
                        )
                      }
                    : conv
                )
              }));

              if (data.done) {
                break;
              }
            } catch (parseError) {
              console.error('Error parsing stream data:', parseError);
            }
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
      if (error instanceof Error && error.name !== 'AbortError') {
        throw error;
      }
    } finally {
      setStreamController(null);
    }
  };

  // Envoi bloquant
  const sendMessageBlocking = async (
    conversationId: string,
    content: string,
    options: any
  ) => {
    try {
      const response = await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          message: content,
          ...options
        })
      });

      if (!response.ok) throw new Error('Message request failed');

      const data = await response.json() as { id: string; content: string; metadata?: any };

      const assistantMessage: ChatMessage = {
        id: data.id || crypto.randomUUID(),
        role: 'assistant',
        content: data.content,
        timestamp: new Date(),
        metadata: data.metadata || {},
        status: 'completed'
      };

      setState(prev => ({
        ...prev,
        conversations: prev.conversations.map(conv =>
          conv.id === conversationId
            ? { ...conv, messages: [...conv.messages, assistantMessage] }
            : conv
        )
      }));

    } catch (error) {
      throw error;
    }
  };

  // Envoi d'un message
  const sendMessage = useCallback(async (
    content: string,
    options: {
      stream?: boolean;
      context?: any;
      attachments?: MessageAttachment[];
      enableContext?: boolean;
    } = {}
  ) => {
    if (!state.activeConversation) {
      await createConversation();
    }

    const conversationId = state.activeConversation!;
    const messageId = crypto.randomUUID();

    // Traitement du contexte si activé
    let contextResult: ContextResult | null = null;
    if (options.enableContext !== false && contextEnabled) {
      contextResult = await processContext(content, conversationId);
    }

    // Message utilisateur
    const userMessage: ChatMessage = {
      id: messageId,
      role: 'user',
      content,
      timestamp: new Date(),
      metadata: {
        context: contextResult
      },
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
      const messageOptions = {
        ...options,
        context: contextResult
      };

      if (options.stream) {
        await sendMessageStream(conversationId, content, messageOptions);
      } else {
        await sendMessageBlocking(conversationId, content, messageOptions);
      }
    } catch (error) {
      // Message d'erreur
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Erreur: ${error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error'}`,
        timestamp: new Date(),
        metadata: { error: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error' },
        status: 'error'
      };

      setState(prev => ({
        ...prev,
        conversations: prev.conversations.map(conv =>
          conv.id === conversationId
            ? { ...conv, messages: [...conv.messages, errorMessage] }
            : conv
        ),
        error: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error'
      }));
    }
  }, [state.activeConversation, createConversation, contextEnabled, processContext]);

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

  // Suppression d'une conversation
  const deleteConversation = useCallback(async (id: string) => {
    try {
      await fetch(`/api/chat/conversations/${id}`, { method: 'DELETE' });
      
      setState(prev => ({
        ...prev,
        conversations: prev.conversations.filter(conv => conv.id !== id),
        activeConversation: prev.activeConversation === id ? null : prev.activeConversation
      }));
    } catch (error) {
      setState(prev => ({ ...prev, error: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error' }));
    }
  }, []);

  // Mise à jour des settings
  const updateSettings = useCallback((newSettings: Partial<ChatSettings>) => {
    setState(prev => ({
      ...prev,
      settings: { ...prev.settings, ...newSettings }
    }));
  }, []);

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
    deleteConversation,
    updateSettings,
    // Fonctions de contexte intelligent
    contextEnabled,
    setContextEnabled,
    contextResults,
    processContext,
    getContextForConversation: (conversationId: string) => contextResults.get(conversationId) || null
  };
};
