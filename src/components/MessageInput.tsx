import React, { useState, useRef, useEffect } from 'react';
import { MessageAttachment } from '../types/conversation.types';

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
        messageId: '', // Sera rempli lors de l'envoi
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
