import React from 'react';
import { Conversation } from '../types/conversation.types';

interface ConversationSidebarProps {
  conversations: Conversation[];
  activeConversation: string | null;
  onConversationSelect: (id: string) => void;
  onNewConversation: () => void;
  onConversationDelete: (id: string) => void;
  onToggle: () => void;
  isOpen: boolean;
}

export const ConversationSidebar: React.FC<ConversationSidebarProps> = ({
  conversations,
  activeConversation,
  onConversationSelect,
  onNewConversation,
  onConversationDelete,
  onToggle,
  isOpen
}) => {
  const formatDate = (date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Aujourd'hui";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Hier";
    } else {
      return new Intl.DateTimeFormat('fr-FR', {
        day: 'numeric',
        month: 'short'
      }).format(date);
    }
  };

  const truncateTitle = (title: string, maxLength: number = 30) => {
    return title.length > maxLength ? title.substring(0, maxLength) + '...' : title;
  };

  const handleDeleteConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Êtes-vous sûr de vouloir supprimer cette conversation ?')) {
      onConversationDelete(id);
    }
  };

  return (
    <div className={`conversation-sidebar ${isOpen ? 'open' : 'closed'}`}>
      <div className="sidebar-header">
        <button className="new-conversation-btn" onClick={onNewConversation}>
          + Nouvelle conversation
        </button>
        <button className="sidebar-toggle-btn" onClick={onToggle}>
          {isOpen ? '◀' : '▶'}
        </button>
      </div>

      <div className="sidebar-content">
        {conversations.length === 0 ? (
          <div className="empty-state">
            <p>Aucune conversation</p>
            <p>Commencez une nouvelle conversation pour voir apparaître vos discussions ici.</p>
          </div>
        ) : (
          <div className="conversation-list">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`conversation-item ${
                  activeConversation === conversation.id ? 'active' : ''
                }`}
                onClick={() => onConversationSelect(conversation.id)}
              >
                <div className="conversation-info">
                  <h3 className="conversation-title">
                    {truncateTitle(conversation.title)}
                  </h3>
                  <div className="conversation-meta">
                    <span className="message-count">
                      {conversation.metadata.messageCount} messages
                    </span>
                    <span className="conversation-date">
                      {formatDate(conversation.metadata.updatedAt)}
                    </span>
                  </div>
                  <div className="conversation-model">
                    {conversation.metadata.provider} - {conversation.metadata.model}
                  </div>
                </div>
                <button
                  className="delete-conversation-btn"
                  onClick={(e) => handleDeleteConversation(conversation.id, e)}
                  title="Supprimer la conversation"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="sidebar-footer">
        <div className="stats">
          <span>{conversations.length} conversations</span>
          <span>
            {conversations.reduce((total, conv) => total + conv.metadata.messageCount, 0)} messages
          </span>
        </div>
      </div>
    </div>
  );
};
