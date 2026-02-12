import React from 'react';
import { ConversationMessage } from '../types/conversation.types';

interface MessageListProps {
  messages: ConversationMessage[];
  isStreaming: boolean;
  onReaction: (messageId: string, emoji: string) => void;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isStreaming,
  onReaction
}) => {
  const formatTimestamp = (date: Date) => {
    return new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  return (
    <div className="message-list">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`message ${message.role}`}
        >
          <div className="message-content">
            <div className="message-header">
              <span className="message-role">
                {message.role === 'user' ? 'Vous' : 'Assistant'}
              </span>
              <span className="message-timestamp">
                {formatTimestamp(message.timestamp)}
              </span>
            </div>
            
            <div className="message-text">
              {message.content}
            </div>

            {message.attachments && message.attachments.length > 0 && (
              <div className="message-attachments">
                {message.attachments.map((attachment) => (
                  <div key={attachment.id} className="attachment">
                    <span className="attachment-name">{attachment.name}</span>
                    {attachment.type === 'image' && (
                      <img src={attachment.url} alt={attachment.name} />
                    )}
                  </div>
                ))}
              </div>
            )}

            {message.metadata && (
              <div className="message-metadata">
                {message.metadata.tokens && (
                  <span className="tokens">{message.metadata.tokens} tokens</span>
                )}
                {message.metadata.latency && (
                  <span className="latency">{message.metadata.latency}ms</span>
                )}
                {message.metadata.cost && (
                  <span className="cost">${message.metadata.cost.toFixed(4)}</span>
                )}
              </div>
            )}
          </div>

          <div className="message-actions">
            <button
              className="action-button"
              onClick={() => copyMessage(message.content)}
              title="Copier"
            >
              📋
            </button>
            <button
              className="action-button"
              onClick={() => onReaction(message.id, '👍')}
              title="Like"
            >
              👍
            </button>
            <button
              className="action-button"
              onClick={() => onReaction(message.id, '👎')}
              title="Dislike"
            >
              👎
            </button>
          </div>
        </div>
      ))}
      
      {isStreaming && (
        <div className="typing-indicator">
          <div className="typing-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      )}
    </div>
  );
};
