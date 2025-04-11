// import { v4 as uuidv4 } from 'uuid';
import { v4 as uuidv4 } from 'uuid';
import { 
  ChatMessage, 
} from '@/types';
import { createClient } from './supabase-client';

// Define expanded context interface
export interface AIChatContext {
  projectName?: string;
  checkType?: 'mfa' | 'rls' | 'pitr';
  checkStatus?: string;
  checkResult?: boolean;
  // IDs for database lookup
  currentCheckId?: string | null;
  projectId?: string | null;
  // Recent chat history
  chatHistory?: Array<{
    role: string;
    content: string;
  }>;
  // Added comprehensive context
  currentScan?: {
    timestamp: string;
    status: string;
    checks: Array<{
      type: 'mfa' | 'rls' | 'pitr';
      status: string;
      result: boolean | null;
      details: any;
    }>;
  };
  scanHistory?: Array<{
    timestamp: string;
    status: string;
    checks: Array<{
      type: 'mfa' | 'rls' | 'pitr';
      status: string;
      result: boolean | null;
      details: any;
    }>;
  }>;
  // Comprehensive context with current view and full history
  projectContext?: {
    currentScan: {
      id: string;
      timestamp: string;
      status: string;
      checks: Array<{
        id: string;
        type: 'mfa' | 'rls' | 'pitr';
        status: string;
        result: boolean | null;
        details: any;
      }>;
    },
    scanHistory: Array<{
      id: string;
      timestamp: string;
      status: string;
      checks: Array<{
        id: string;
        type: 'mfa' | 'rls' | 'pitr';
        status: string;
        result: boolean | null;
        details: any;
      }>;
    }>;
  };
}

/**
 * AI Service to handle AI-based features using secure backend API routes
 */
class AIService {
  // Create a Supabase client
  private supabase;
  
  constructor() {
    this.supabase = createClient();
  }
  
  /**
   * Get or create a chat session for the current user and project
   */
  async getOrCreateChatSession(projectId: string): Promise<string> {
    try {
      // Skip database operations for invalid project IDs
      if (!projectId || projectId === 'undefined' || !this.supabase) {
        return `temp_${uuidv4()}`;
      }
      
      // First try to get an existing session
      const { data: existingSession } = await this.supabase
        .from('ai_chat_sessions')
        .select('id')
        .eq('project_id', projectId)
        .maybeSingle();
      
      if (existingSession?.id) {
        // Update the session's timestamp
        await this.supabase
          .from('ai_chat_sessions')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', existingSession.id);
          
        return existingSession.id;
      }
      
      // Create a new session if none exists
      const { data: newSession, error } = await this.supabase
        .from('ai_chat_sessions')
        .insert({
          project_id: projectId
        })
        .select('id')
        .single();
      
      if (error) throw error;
      return newSession.id;
    } catch (error) {
      console.error('Error managing chat session:', error);
      // Fallback to a client-side UUID if DB operations fail
      return `local_${uuidv4()}`;
    }
  }
  
  /**
   * Load chat messages for a specific session
   */
  async loadChatMessages(sessionId: string): Promise<ChatMessage[]> {
    try {
      // Skip database query for local sessions
      if (!sessionId || sessionId.startsWith('local_') || sessionId.startsWith('temp_') || !this.supabase) {
        return [];
      }
      
      const { data, error } = await this.supabase
        .from('ai_chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      // Transform from database format to application format
      return data.map((msg: {
        id: string;
        role: string;
        content: string;
        created_at: string;
        session_id: string;
        context: any;
      }) => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        timestamp: msg.created_at
      }));
    } catch (error) {
      console.error('Error loading chat messages:', error);
      // Return default welcome message if we can't load from DB
      return [{
        id: '1',
        role: 'assistant',
        content: "👋 I'm your Supabase compliance assistant. How can I help you with MFA, RLS, or PITR compliance today?",
        timestamp: new Date().toISOString()
      }];
    }
  }
  
  /**
   * Save a chat message to the database
   */
  async saveChatMessage(message: ChatMessage, sessionId: string, projectId: string): Promise<void> {
    try {
      // Skip database operation for local sessions or invalid data
      if (!sessionId || !projectId || 
          sessionId.startsWith('local_') || 
          sessionId.startsWith('temp_') ||
          projectId === 'undefined' ||
          !this.supabase) {
        return;
      }
      
      await this.supabase
        .from('ai_chat_messages')
        .insert({
          id: message.id,
          session_id: sessionId,
          role: message.role as 'user' | 'assistant',
          content: message.content,
          created_at: message.timestamp
        });
        
      // Update the session's timestamp
      await this.supabase
        .from('ai_chat_sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', sessionId);
        
    } catch (error) {
      console.error('Error saving chat message:', error);
      // Silently fail - messages will still appear in UI even if save fails
    }
  }

  async generateChatResponse(message: string, context?: AIChatContext): Promise<ChatMessage> {
    try {
      // Call our secure backend endpoint that will use the OpenAI API
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message,
          context
        })
      });

      if (!response.ok) {
        throw new Error('AI chat API error');
      }

      const data = await response.json();
      
      return {
        id: uuidv4(),
        role: 'assistant',
        content: data.content,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error generating chat response:', error);
      
      // Return a fallback message
      return {
        id: uuidv4(),
        role: 'assistant',
        content: 'I apologize, but I encountered an error while processing your request. Please try again later or contact support if the issue persists.',
        timestamp: new Date().toISOString()
      };
    }
  }
 
}

export const aiService = new AIService(); 