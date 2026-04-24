'use client';

import { useEffect } from 'react';
import { useQaState } from '@/components/modules/workspace/qa/use-qa-state';
import { ConversationList } from '@/components/modules/workspace/qa/conversation-list';
import { ChatHeader } from '@/components/modules/workspace/qa/chat-header';
import { ChatMessages } from '@/components/modules/workspace/qa/chat-messages';
import { ChatInputBar } from '@/components/modules/workspace/qa/chat-input-bar';
import { groupConversationsByDate } from '@/components/modules/workspace/qa/helpers';

export default function QAChat() {
  const qa = useQaState();

  // Load language preference from localStorage on mount
  useEffect(() => {
    qa.loadLanguagePreference();
  }, []);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    qa.messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [qa.messages]);

  // Fetch conversations on mount; auto-select most recent or create first
  useEffect(() => {
    qa.fetchConversations().then((convs) => {
      if (!convs || convs.length === 0) {
        qa.createConversation();
      } else {
        qa.selectConversation(convs[0].id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groups = groupConversationsByDate(qa.conversations);

  return (
    <div className="flex h-screen fixed inset-0 md:left-64 z-10 bg-background">
      <ConversationList
        groups={groups}
        activeConvId={qa.activeConvId}
        hoveredConvId={qa.hoveredConvId}
        loadingConvs={qa.loadingConvs}
        totalCount={qa.conversations.length}
        sidebarOpen={qa.sidebarOpen}
        onSelect={qa.selectConversation}
        onDelete={qa.deleteConversation}
        onCreate={qa.createConversation}
        onHover={qa.setHoveredConvId}
      />

      <div className="flex flex-col flex-1 min-w-0">
        <ChatHeader
          sidebarOpen={qa.sidebarOpen}
          language={qa.language}
          onToggleSidebar={() => qa.setSidebarOpen(!qa.sidebarOpen)}
          onChangeLanguage={qa.changeLanguage}
        />

        <ChatMessages
          messages={qa.messages}
          loading={qa.loading}
          showContext={qa.showContext}
          messagesEndRef={qa.messagesEndRef}
          onSend={qa.handleSend}
          onToggleContext={(id) =>
            qa.setShowContext(qa.showContext === id ? null : id)
          }
        />

        <ChatInputBar
          input={qa.input}
          loading={qa.loading}
          inputRef={qa.inputRef}
          onChange={qa.setInput}
          onSend={() => qa.handleSend()}
        />
      </div>
    </div>
  );
}
