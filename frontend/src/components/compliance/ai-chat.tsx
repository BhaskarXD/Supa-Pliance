'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage } from '@/types';
import { aiService } from '@/lib/ai';
import { Loader2, Send, Bot, MinusCircle, Maximize, Minimize, GripVertical, ChevronRight, User, ArrowUpCircle, Expand, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { v4 as uuidv4 } from 'uuid';
import { AIChatContext } from '@/lib/ai';

interface AIChatProps {
  projectName?: string;
  checkType?: 'mfa' | 'rls' | 'pitr';
  checkStatus?: string;
  checkResult?: boolean;
  className?: string;
  currentScan?: {
    timestamp: string;
    status: string;
    checks: Array<{
      id: string;
      type: 'mfa' | 'rls' | 'pitr';
      status: string;
      result: boolean | null;
      details: string | null;
    }>;
    currentCheckId?: string | null;
    projectId?: string | null;
  };
  scanHistory?: Array<{
    timestamp: string;
    status: string;
    checks: Array<{
      type: 'mfa' | 'rls' | 'pitr';
      status: string;
      result: boolean | null;
      details?: string | null;
    }>;
  }>;
}

export function AIChat({ projectName, checkType, checkStatus, checkResult, currentScan, scanHistory, className }: AIChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [chatHeight, setChatHeight] = useState(320); // Default height
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resizeStartYRef = useRef<number | null>(null);
  const initialHeightRef = useRef<number>(0);
  
  // We'll use this to track when the chat is opened for the auto-fix component
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Extract the project ID from URL when component loads
  useEffect(() => {
    const extractedProjectId = typeof window !== 'undefined' ? 
      window.location.pathname.split('/').find((segment, i, arr) => arr[i-1] === 'projects') : null;
    
    setProjectId(extractedProjectId || null);
  }, []);
  
  // Get or create a chat session and load messages when the project ID is available
  useEffect(() => {
    const initializeChat = async () => {
      if (projectId) {
        try {
          // Get or create a session
          const sessionId = await aiService.getOrCreateChatSession(projectId);
          setSessionId(sessionId);
          
          // Load messages for this session
          const loadedMessages = await aiService.loadChatMessages(sessionId);
          
          // Only set messages if we got some back from the database
          if (loadedMessages && loadedMessages.length > 0) {
            setMessages(loadedMessages);
          } else {
            // Fall back to default welcome message
            const welcomeMessage: ChatMessage = {
              id: uuidv4(),
              role: 'assistant',
              content: "👋 I'm your Supabase compliance assistant. How can I help you with MFA, RLS, or PITR compliance today?",
              timestamp: new Date().toISOString()
            };
            setMessages([welcomeMessage]);
            
            // Save the welcome message to the database
            if (sessionId && projectId) {
              await aiService.saveChatMessage(welcomeMessage, sessionId, projectId);
            }
          }
          
          setMessagesLoaded(true);
        } catch (error) {
          console.error('Error initializing chat:', error);
          // Fall back to welcome message
          setMessages([{
            id: uuidv4(),
            role: 'assistant',
            content: "👋 I'm your Supabase compliance assistant. How can I help you with MFA, RLS, or PITR compliance today?",
            timestamp: new Date().toISOString()
          }]);
          setMessagesLoaded(true);
        }
      }
    };
    
    if (projectId && !messagesLoaded) {
      initializeChat();
    }
  }, [projectId, messagesLoaded]);

  // Toggle expanded state
  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
    setIsChatOpen(!isExpanded); // Update isChatOpen when expanded state changes
    if (!isExpanded) {
      // Save current height before expanding
      initialHeightRef.current = chatHeight;
      setChatHeight(600); // Increased expanded height
    } else {
      // Restore original height
      setChatHeight(initialHeightRef.current);
    }
  };

  // Update the isChatOpen state when minimized state changes
  useEffect(() => {
    setIsChatOpen(!isMinimized);
  }, [isMinimized]);
  
  // Handle resize start
  const handleResizeStart = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    resizeStartYRef.current = e.clientY;
    initialHeightRef.current = chatHeight;
    
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  };

  // Handle resize move
  const handleResizeMove = (e: MouseEvent) => {
    if (resizeStartYRef.current === null) return;
    
    const deltaY = resizeStartYRef.current - e.clientY;
    const newHeight = Math.max(200, Math.min(600, initialHeightRef.current + deltaY));
    setChatHeight(newHeight);
  };

  // Handle resize end
  const handleResizeEnd = () => {
    resizeStartYRef.current = null;
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  };
  
  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !sessionId || !projectId) return;

    // Create user message
    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: input,
      timestamp: new Date().toISOString()
    };

    // Add user message to chat
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    try {
      // Save user message to database
      await aiService.saveChatMessage(userMessage, sessionId, projectId);
      
      // Get last few messages (excluding the one we just added) to provide conversation history
      const recentMessages = updatedMessages
        .slice(-5, -1) // Get up to 4 previous messages (if available)
        .map(msg => ({
          role: msg.role,
          content: msg.content
        }));

      // Find the current check ID related to this conversation
      const currentCheckId = currentScan?.checks.find(check => check.type === checkType)?.id;
      
      // Generate AI response
      const response = await aiService.generateChatResponse(input, {
        currentCheckId: currentCheckId || null,
        projectId,
        checkType: checkType,
        projectName: projectName,
        chatHistory: recentMessages
      });
      
      // Update UI with AI response
      setMessages(prev => [...prev, response]);
      
      // Save AI response to database
      await aiService.saveChatMessage(response, sessionId, projectId);
    } catch (error) {
      console.error('Error in chat workflow:', error);
      
      // Add error message to UI
      const errorMessage: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: 'Sorry, I had trouble responding. Please try again later.',
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, errorMessage]);
      
      // Save error message to database
      if (sessionId && projectId) {
        await aiService.saveChatMessage(errorMessage, sessionId, projectId);
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const renderMessageContent = (content: string) => {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Apply styling to the root div
          root: ({ node, ...props }) => (
            <div 
              className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1.5 prose-pre:my-2 prose-pre:p-3 prose-pre:rounded-md prose-pre:bg-muted/80 prose-code:text-primary prose-code:bg-muted/50 prose-code:rounded prose-code:p-0.5 prose-headings:my-2 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-blockquote:my-2 prose-blockquote:pl-3 prose-blockquote:border-l-2 prose-blockquote:border-muted-foreground/30 prose-blockquote:italic prose-table:my-2 break-words" 
              style={{ width: '100%' }}
              {...props} 
            />
          ),
          pre: ({ node, ...props }) => (
            <pre className="overflow-auto p-3 bg-muted/80 rounded-md text-xs whitespace-pre-wrap break-all" style={{ maxWidth: '100%' }} {...props} />
          ),
          code: ({ node, inline, ...props }) => (
            inline 
              ? <code className="bg-muted/50 px-1 py-0.5 rounded text-primary break-all" {...props} />
              : <code className="break-all" style={{ maxWidth: '100%' }} {...props} />
          ),
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto w-full">
              <table className="w-full" style={{ maxWidth: '100%' }} {...props} />
            </div>
          )
        }}
      >
        {content}
      </ReactMarkdown>
    );
  };

  if (isMinimized) {
    return (
      <div data-ai-chat-open="false">
        <Button
          variant="outline"
          size="sm"
          className="fixed bottom-4 right-4 shadow-md flex items-center gap-2 z-50 bg-background/80 backdrop-blur-[2px] border-muted"
          onClick={() => setIsMinimized(false)}
        >
          <Bot className="h-4 w-4 text-primary" />
          <span>Open AI Assistant</span>
        </Button>
      </div>
    );
  }

  return (
    <Card 
      className={cn(
        "fixed bottom-4 right-4 shadow-lg z-50",
        isExpanded ? "w-[640px]" : "w-80",
        className
      )}
      style={{ 
        resize: 'both',
        maxWidth: '90vw',
        maxHeight: '80vh',
        minWidth: isExpanded ? '500px' : '280px',
        minHeight: '200px',
        overflow: 'hidden',
        padding: '0px'
      }}
      data-ai-chat-open={!isMinimized ? "true" : "false"}
    >
      <CardHeader className="bg-primary text-primary-foreground px-4 flex flex-row items-center justify-between cursor-move py-2">
        <CardTitle className="text-sm font-medium flex items-center">
          <Bot className="mr-2 h-4 w-4" />
          Compliance Assistant
        </CardTitle>
        <div className="flex gap-1">
          {isExpanded ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-primary-foreground"
              onClick={toggleExpanded}
            >
              <Minimize className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-primary-foreground"
              onClick={toggleExpanded}
            >
              <Maximize className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-primary-foreground"
            onClick={() => setIsMinimized(true)}
          >
            <MinusCircle className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <div className="flex flex-col" style={{ height: `${chatHeight}px` }}>
        <div ref={scrollAreaRef} className="h-full flex-1 min-h-0">
          <ScrollArea className="h-full">
            <CardContent className="p-4 space-y-4">
              {!messagesLoaded ? (
                <div className="flex justify-center items-center h-32">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex justify-center items-center h-32 text-muted-foreground text-sm">
                  No messages yet
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex",
                      message.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "rounded-lg px-4 py-3 max-w-[95%] text-sm overflow-hidden",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                      style={{ 
                        width: message.role === "assistant" ? "95%" : "auto",
                        overflowWrap: "break-word",
                        wordBreak: "break-word"
                      }}
                    >
                      {message.role === "assistant" 
                        ? renderMessageContent(message.content)
                        : message.content}
                    </div>
                  </div>
                ))
              )}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="rounded-lg px-3 py-2 max-w-[80%] bg-muted flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="text-sm">Thinking...</span>
                  </div>
                </div>
              )}
            </CardContent>
          </ScrollArea>
        </div>
        <CardFooter className="p-2 border-t">
          <form onSubmit={handleSubmit} className="flex gap-2 w-full">
            <Input
              ref={inputRef}
              placeholder="Ask about compliance..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 h-9 text-sm"
              disabled={isLoading || !sessionId}
            />
            <Button 
              type="submit" 
              size="icon" 
              className="h-9 w-9"
              disabled={isLoading || !input.trim() || !sessionId}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </CardFooter>
      </div>
    </Card>
  );
} 