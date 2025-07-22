// GOMFLOW Team Chat Component
// Real-time team communication interface

"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Send, 
  Smile, 
  Paperclip, 
  Search, 
  MoreVertical, 
  Reply,
  Edit,
  Trash2,
  Pin,
  Star,
  MessageSquare,
  Users,
  Clock,
  CheckCircle,
  Volume2,
  VolumeX,
  Filter,
  Hash,
  AtSign,
  Heart,
  ThumbsUp,
  Zap,
  AlertCircle,
  Info,
  MessageCircle,
  X
} from 'lucide-react';
import { useCollaboration } from '@/hooks/useCollaboration';
import PresenceIndicator from './PresenceIndicator';
import {
  ChatMessage,
  WorkspaceMember,
  MessageType,
  MessageReaction,
  MessageThread
} from '@/lib/collaboration/types';

interface TeamChatProps {
  workspaceId: string;
  userId: string;
  authToken: string;
  threadId?: string;
  onClose?: () => void;
  compact?: boolean;
  height?: string;
}

interface MessageWithMember extends ChatMessage {
  member?: WorkspaceMember;
  isThreadParent?: boolean;
  threadCount?: number;
}

interface EmojiReaction {
  emoji: string;
  count: number;
  users: string[];
  userReacted: boolean;
}

const TeamChat: React.FC<TeamChatProps> = ({
  workspaceId,
  userId,
  authToken,
  threadId,
  onClose,
  compact = false,
  height = "h-96"
}) => {
  const { state, actions } = useCollaboration({
    workspaceId,
    userId,
    authToken,
    autoConnect: true
  });

  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [showThread, setShowThread] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<ChatMessage[]>([]);
  const [messageFilter, setMessageFilter] = useState<'all' | 'mentions' | 'threads'>('all');
  const [isMuted, setIsMuted] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState<Set<string>>(new Set());
  const [reactions, setReactions] = useState<Map<string, EmojiReaction[]>>(new Map());
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);

  // Enhanced messages with member data
  const messagesWithMembers: MessageWithMember[] = state.chatMessages.map(msg => ({
    ...msg,
    member: state.workspaceMembers.find(m => m.user_id === msg.user_id)
  }));

  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [state.chatMessages]);

  // Load thread messages
  useEffect(() => {
    if (showThread) {
      loadThreadMessages(showThread);
    }
  }, [showThread]);

  // Handle typing indicator
  useEffect(() => {
    if (isTyping && typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    if (isTyping) {
      actions.startTyping();
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        actions.stopTyping();
      }, 3000);
    }
    
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [isTyping, actions]);

  const loadThreadMessages = async (messageId: string) => {
    try {
      const response = await fetch(`/api/collaboration/chat/thread/${messageId}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (response.ok) {
        const thread = await response.json();
        setThreadMessages(thread.messages || []);
      }
    } catch (error) {
      console.error('Error loading thread messages:', error);
    }
  };

  const handleSendMessage = useCallback(() => {
    if (!message.trim()) return;

    const messageType: MessageType = replyingTo ? 'reply' : 'text';
    const parentId = replyingTo?.id || threadId;
    
    actions.sendMessage(message.trim(), messageType, parentId);
    setMessage('');
    setReplyingTo(null);
    setIsTyping(false);
    actions.stopTyping();
  }, [message, replyingTo, threadId, actions]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);
    if (!isTyping) {
      setIsTyping(true);
    }
  };

  const handleEditMessage = async (messageId: string, newContent: string) => {
    try {
      await fetch(`/api/collaboration/chat/messages/${messageId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ content: newContent })
      });
      setEditingMessage(null);
      setEditContent('');
    } catch (error) {
      console.error('Error editing message:', error);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await fetch(`/api/collaboration/chat/messages/${messageId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  const handlePinMessage = async (messageId: string) => {
    try {
      await fetch(`/api/collaboration/chat/messages/${messageId}/pin`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      setPinnedMessages(prev => new Set(prev).add(messageId));
    } catch (error) {
      console.error('Error pinning message:', error);
    }
  };

  const handleAddReaction = async (messageId: string, emoji: string) => {
    try {
      await fetch(`/api/collaboration/chat/messages/${messageId}/reactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ emoji })
      });
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  };

  const getMessageTime = (timestamp: string) => {
    const now = new Date();
    const messageTime = new Date(timestamp);
    const diff = now.getTime() - messageTime.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return messageTime.toLocaleDateString();
  };

  const getMessageTypeIcon = (type: MessageType) => {
    switch (type) {
      case 'reply': return <Reply className="w-3 h-3 text-blue-500" />;
      case 'system': return <Info className="w-3 h-3 text-gray-500" />;
      case 'mention': return <AtSign className="w-3 h-3 text-green-500" />;
      default: return <MessageCircle className="w-3 h-3 text-gray-500" />;
    }
  };

  const filteredMessages = messagesWithMembers.filter(msg => {
    if (searchTerm && !msg.content.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    
    switch (messageFilter) {
      case 'mentions':
        return msg.content.includes(`@${userId}`) || msg.user_id === userId;
      case 'threads':
        return msg.thread_id || msg.type === 'reply';
      default:
        return true;
    }
  });

  const typingUsers = Array.from(state.typingUsers)
    .filter(id => id !== userId)
    .map(id => state.workspaceMembers.find(m => m.user_id === id))
    .filter(Boolean);

  return (
    <Card className={`flex flex-col ${height} ${compact ? 'w-80' : 'w-full'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-500" />
            <CardTitle className="text-sm font-medium">Team Chat</CardTitle>
            {state.unreadCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {state.unreadCount}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSearch(!showSearch)}
            >
              <Search className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMuted(!isMuted)}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </Button>
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
        
        {showSearch && (
          <div className="mt-2 space-y-2">
            <Input
              placeholder="Search messages..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="text-sm"
            />
            <div className="flex gap-1">
              <Button
                variant={messageFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMessageFilter('all')}
              >
                All
              </Button>
              <Button
                variant={messageFilter === 'mentions' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMessageFilter('mentions')}
              >
                <AtSign className="w-3 h-3 mr-1" />
                Mentions
              </Button>
              <Button
                variant={messageFilter === 'threads' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMessageFilter('threads')}
              >
                <MessageSquare className="w-3 h-3 mr-1" />
                Threads
              </Button>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 flex flex-col overflow-hidden p-0">
        {/* Messages Area */}
        <div 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-3"
        >
          {filteredMessages.map((msg, index) => {
            const isOwn = msg.user_id === userId;
            const showAvatar = index === 0 || filteredMessages[index - 1].user_id !== msg.user_id;
            const isPinned = pinnedMessages.has(msg.id);
            const msgReactions = reactions.get(msg.id) || [];
            
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''} group`}
                onMouseEnter={() => setSelectedMessage(msg.id)}
                onMouseLeave={() => setSelectedMessage(null)}
              >
                {/* Avatar */}
                {showAvatar && (
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-semibold">
                      {msg.member?.user?.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  </div>
                )}
                
                {/* Message Content */}
                <div className={`flex-1 ${showAvatar ? '' : 'ml-11'} ${isOwn ? 'mr-11' : ''}`}>
                  {/* Message Header */}
                  {showAvatar && (
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold">
                        {msg.member?.user?.name || 'Unknown User'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {getMessageTime(msg.created_at)}
                      </span>
                      {getMessageTypeIcon(msg.type)}
                      {isPinned && <Pin className="w-3 h-3 text-yellow-500" />}
                    </div>
                  )}
                  
                  {/* Reply Context */}
                  {msg.parent_id && (
                    <div className="mb-2 p-2 bg-gray-50 rounded border-l-2 border-gray-300">
                      <div className="text-xs text-gray-600">
                        Replying to {msg.parent_message?.user?.name || 'Unknown'}
                      </div>
                      <div className="text-sm text-gray-800 truncate">
                        {msg.parent_message?.content || 'Message not found'}
                      </div>
                    </div>
                  )}
                  
                  {/* Message Body */}
                  <div className={`rounded-lg p-3 ${
                    isOwn 
                      ? 'bg-blue-500 text-white' 
                      : msg.type === 'system' 
                        ? 'bg-gray-100 text-gray-600 italic' 
                        : 'bg-white border border-gray-200'
                  }`}>
                    {editingMessage === msg.id ? (
                      <div className="space-y-2">
                        <Input
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="text-sm"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            onClick={() => handleEditMessage(msg.id, editContent)}
                          >
                            Save
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => setEditingMessage(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                    )}
                    
                    {/* Message Status */}
                    {isOwn && (
                      <div className="flex items-center justify-end mt-1 gap-1">
                        <CheckCircle className="w-3 h-3 opacity-60" />
                        <span className="text-xs opacity-60">
                          {msg.read_by?.length || 0} read
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* Reactions */}
                  {msgReactions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {msgReactions.map((reaction, idx) => (
                        <Button
                          key={idx}
                          variant="outline"
                          size="sm"
                          className={`h-6 px-2 text-xs ${
                            reaction.userReacted ? 'bg-blue-50 border-blue-300' : ''
                          }`}
                          onClick={() => handleAddReaction(msg.id, reaction.emoji)}
                        >
                          {reaction.emoji} {reaction.count}
                        </Button>
                      ))}
                    </div>
                  )}
                  
                  {/* Thread Info */}
                  {msg.thread_count && msg.thread_count > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 text-xs text-blue-600 hover:text-blue-800"
                      onClick={() => setShowThread(msg.id)}
                    >
                      <MessageSquare className="w-3 h-3 mr-1" />
                      {msg.thread_count} replies
                    </Button>
                  )}
                </div>
                
                {/* Message Actions */}
                {selectedMessage === msg.id && (
                  <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setReplyingTo(msg)}
                      title="Reply"
                    >
                      <Reply className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAddReaction(msg.id, '👍')}
                      title="React"
                    >
                      <ThumbsUp className="w-3 h-3" />
                    </Button>
                    {isOwn && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingMessage(msg.id);
                            setEditContent(msg.content);
                          }}
                          title="Edit"
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteMessage(msg.id)}
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePinMessage(msg.id)}
                      title="Pin"
                    >
                      <Pin className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
          
          {/* Typing Indicator */}
          {typingUsers.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-gray-500 italic">
              <div className="flex -space-x-1">
                {typingUsers.slice(0, 3).map((user, idx) => (
                  <div
                    key={idx}
                    className="w-6 h-6 rounded-full bg-gray-300 border-2 border-white flex items-center justify-center text-xs"
                  >
                    {user?.user?.name?.charAt(0).toUpperCase()}
                  </div>
                ))}
              </div>
              <span>
                {typingUsers.length === 1 
                  ? `${typingUsers[0]?.user?.name} is typing...`
                  : `${typingUsers.length} people are typing...`
                }
              </span>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
        
        {/* Reply Context */}
        {replyingTo && (
          <div className="px-4 py-2 bg-gray-50 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Reply className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-600">
                  Replying to {replyingTo.member?.user?.name || 'Unknown'}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setReplyingTo(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="text-sm text-gray-800 truncate mt-1">
              {replyingTo.content}
            </div>
          </div>
        )}
        
        {/* Message Input */}
        <div className="p-4 border-t">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Input
                ref={messageInputRef}
                placeholder="Type a message..."
                value={message}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                className="pr-20"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <Button variant="ghost" size="sm" title="Attach file">
                  <Paperclip className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" title="Add emoji">
                  <Smile className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <Button
              onClick={handleSendMessage}
              disabled={!message.trim()}
              size="sm"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TeamChat;