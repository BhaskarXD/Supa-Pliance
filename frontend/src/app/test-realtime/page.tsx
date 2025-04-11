'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Database } from '@/types/supabase';
import { createClient } from '@supabase/supabase-js';

type Message = Database['public']['Tables']['test_messages']['Row'];

// Initialize Supabase client
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function TestRealtimePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');

  useEffect(() => {
    // Fetch initial messages
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('test_messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching messages:', error);
        toast.error('Failed to fetch messages');
        return;
      }

      setMessages(data || []);
    };

    fetchMessages();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('test-messages-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'test_messages',
        },
        (payload) => {
          console.log('Received real-time update:', payload);
          
          if (payload.eventType === 'INSERT') {
            setMessages(current => [payload.new as Message, ...current]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      const { error } = await supabase
        .from('test_messages')
        .insert({ message: newMessage.trim() });

      if (error) throw error;

      setNewMessage('');
      toast.success('Message sent!');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-8">Real-time Updates Test</h1>
      
      <form onSubmit={handleSubmit} className="flex gap-2 mb-8">
        <Input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a test message..."
          className="flex-1"
        />
        <Button type="submit">Send</Button>
      </form>

      <div className="space-y-4">
        {messages.map((msg) => (
          <Card key={msg.id}>
            <CardContent className="py-3">
              <div className="flex justify-between items-start gap-4">
                <p>{msg.message}</p>
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  {msg.created_at ? new Date(msg.created_at).toLocaleString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric', 
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    timeZoneName: 'short'
                  }) : 'N/A'}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {messages.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            No messages yet. Send one to test real-time updates!
          </p>
        )}
      </div>
    </div>
  );
} 