import { renderHook, act, waitFor } from '@testing-library/react';
import { useChat } from '../hooks/useChat';

// Mock fetch
global.fetch = jest.fn();

describe('useChat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useChat());

    expect(result.current.conversations).toEqual([]);
    expect(result.current.activeConversation).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.settings.defaultProvider).toBe('openai');
    expect(result.current.settings.defaultModel).toBe('gpt-3.5-turbo');
  });

  it('should load conversations on mount', async () => {
    const mockConversations = [
      {
        id: '1',
        title: 'Test Conversation',
        messages: [],
        metadata: {
          userId: 'user1',
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          createdAt: new Date(),
          updatedAt: new Date(),
          messageCount: 0,
          totalTokens: 0,
          totalCost: 0
        },
        settings: {
          temperature: 0.7,
          maxTokens: 2048,
          streamResponse: true,
          includeContext: false,
          contextSources: [],
          autoSave: true,
          shareEnabled: false
        }
      }
    ];

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ conversations: mockConversations })
    });

    const { result } = renderHook(() => useChat());

    await waitFor(() => {
      expect(result.current.conversations).toEqual(mockConversations);
      expect(result.current.isLoading).toBe(false);
    });

    expect(fetch).toHaveBeenCalledWith('/api/chat/conversations');
  });

  it('should create new conversation', async () => {
    const newConversation = {
      id: '2',
      title: 'New Conversation',
      messages: [],
      metadata: {
        userId: 'user1',
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        createdAt: new Date(),
        updatedAt: new Date(),
        messageCount: 0,
        totalTokens: 0,
        totalCost: 0
      },
      settings: {
        temperature: 0.7,
        maxTokens: 2048,
        streamResponse: true,
        includeContext: false,
        contextSources: [],
        autoSave: true,
        shareEnabled: false
      }
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ conversation: newConversation })
    });

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.createConversation('New Conversation');
    });

    expect(result.current.conversations).toContain(newConversation);
    expect(result.current.activeConversation).toBe('2');
    expect(fetch).toHaveBeenCalledWith('/api/chat/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'New Conversation',
        provider: 'openai',
        model: 'gpt-3.5-turbo'
      })
    });
  });

  it('should send message with streaming', async () => {
    // Mock conversation creation
    const mockConversation = {
      id: '1',
      title: 'Test',
      messages: [],
      metadata: {
        userId: 'user1',
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        createdAt: new Date(),
        updatedAt: new Date(),
        messageCount: 0,
        totalTokens: 0,
        totalCost: 0
      },
      settings: {
        temperature: 0.7,
        maxTokens: 2048,
        streamResponse: true,
        includeContext: false,
        contextSources: [],
        autoSave: true,
        shareEnabled: false
      }
    };

    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ conversation: mockConversation })
      })
      .mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: async () => ({
              done: true,
              value: new TextEncoder().encode('data: {"content": "test response", "done": true}\n\n')
            })
          })
        }
      });

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage('Hello', { stream: true });
    });

    expect(result.current.conversations[0].messages).toHaveLength(2); // User + Assistant
    expect(result.current.conversations[0].messages[0].role).toBe('user');
    expect(result.current.conversations[0].messages[0].content).toBe('Hello');
    expect(result.current.conversations[0].messages[1].role).toBe('assistant');
  });

  it('should handle errors gracefully', async () => {
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.loadConversations();
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.isLoading).toBe(false);
  });

  it('should delete conversation', async () => {
    const mockConversation = {
      id: '1',
      title: 'Test',
      messages: [],
      metadata: {
        userId: 'user1',
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        createdAt: new Date(),
        updatedAt: new Date(),
        messageCount: 0,
        totalTokens: 0,
        totalCost: 0
      },
      settings: {
        temperature: 0.7,
        maxTokens: 2048,
        streamResponse: true,
        includeContext: false,
        contextSources: [],
        autoSave: true,
        shareEnabled: false
      }
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ conversations: [mockConversation] })
    }).mockResolvedValueOnce({
      ok: true
    });

    const { result } = renderHook(() => useChat());

    // Set initial state
    await act(async () => {
      await result.current.loadConversations();
      result.current.setActiveConversation('1');
    });

    await act(async () => {
      await result.current.deleteConversation('1');
    });

    expect(result.current.conversations).toEqual([]);
    expect(result.current.activeConversation).toBeNull();
    expect(fetch).toHaveBeenCalledWith('/api/chat/conversations/1', {
      method: 'DELETE'
    });
  });

  it('should update settings', () => {
    const { result } = renderHook(() => useChat());

    act(() => {
      result.current.updateSettings({
        defaultProvider: 'anthropic',
        theme: 'dark'
      });
    });

    expect(result.current.settings.defaultProvider).toBe('anthropic');
    expect(result.current.settings.theme).toBe('dark');
  });

  it('should set active conversation', () => {
    const { result } = renderHook(() => useChat());

    act(() => {
      result.current.setActiveConversation('test-id');
    });

    expect(result.current.activeConversation).toBe('test-id');
  });
});
