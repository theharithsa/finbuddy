import { observeOperation } from '@/lib/operation-monitoring';
import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import { 
  Loader2, 
  Send, 
  Bot, 
  User, 
  Trash2, 
  History,
  MessageSquare,
  Sparkles,
  Clock,
  Plus,
  ChevronLeft
} from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { collection, addDoc, query, orderBy, onSnapshot, deleteDoc, doc, getDocs, serverTimestamp, where, limit, updateDoc } from 'firebase/firestore';
import { functions, db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { formatCurrency } from '../lib/utils';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sessionId: string;
  actionItems?: any[];
  isError?: boolean;
  // ML Enhancement metadata
  metadata?: {
    dataCount?: number;
    filters?: string[];
    totalAmount?: number;
    dateRange?: string;
  };
  intentType?: 'DATA_RETRIEVAL' | 'ANALYSIS' | 'CRUD_OPERATION' | 'GENERAL_CHAT';
  responseFormat?: 'RAW_DATA' | 'ANALYSIS' | 'CONFIRMATION' | 'CONVERSATIONAL';
}

interface ChatSession {
  id: string;
  title: string;
  lastMessage: string;
  messageCount: number;
  createdAt: Date;
  lastActivity: Date;
}

export const AIChatPage: React.FC = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [showSessions, setShowSessions] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load conversation history from Firestore
  useEffect(() => {
    if (!user) {
      setLoadingHistory(false);
      return;
    }

    // Timeout fallback to ensure loading doesn't hang forever
    const loadingTimeout = setTimeout(() => {
      setLoadingHistory(false);
    }, 10000); // 10 second timeout

    // Load chat sessions with real-time updates
    const sessionsRef = collection(db, `users/${user.uid}/chatSessions`);
    const q = query(sessionsRef, orderBy('lastActivity', 'desc'), limit(10));
    
    const unsubscribeSessions = onSnapshot(q, async (snapshot) => {
      try {
        const loadedSessions: ChatSession[] = [];
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          loadedSessions.push({
            id: doc.id,
            title: data.title || 'New Chat',
            lastMessage: data.lastMessage || '',
            messageCount: data.messageCount || 0,
            createdAt: data.createdAt?.toDate() || new Date(),
            lastActivity: data.lastActivity?.toDate() || new Date(),
          });
        });

        setSessions(loadedSessions);

        // Set current session (most recent or create new)
        if (loadedSessions.length > 0 && !currentSessionId) {
          setCurrentSessionId(loadedSessions[0].id);
        } else if (loadedSessions.length === 0 && !currentSessionId) {
          // Create new session
          const newSessionId = await createNewSession();
          if (newSessionId) {
            setCurrentSessionId(newSessionId);
          } else {
            // If session creation fails, just proceed without sessions
            setLoadingHistory(false);
          }
        }
        
        clearTimeout(loadingTimeout);
        setLoadingHistory(false);
      } catch (error) {
        clearTimeout(loadingTimeout);
        setLoadingHistory(false);
      }
    }, (error) => {
      clearTimeout(loadingTimeout);
      setLoadingHistory(false);
    });

    return () => {
      unsubscribeSessions();
      clearTimeout(loadingTimeout);
    };
  }, [user]);

  // Load messages for current session
  useEffect(() => {
    if (!user || !currentSessionId) {
      // If no user or session, stop loading
      if (!user) setLoadingHistory(false);
      return;
    }


    const conversationRef = collection(db, `users/${user.uid}/conversations`);
    // Use only the where clause to avoid index requirements, then sort in memory
    const q = query(
      conversationRef, 
      where('sessionId', '==', currentSessionId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedMessages: ChatMessage[] = [];
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        loadedMessages.push({
          id: doc.id,
          role: data.role,
          content: data.content,
          timestamp: data.timestamp?.toDate() || new Date(),
          sessionId: data.sessionId || currentSessionId,
          actionItems: data.actionItems,
          isError: data.isError
        });
      });

      // Sort messages by timestamp in memory (since we removed orderBy to avoid index requirements)
      loadedMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      if (loadedMessages.length === 0) {
        // Add welcome message if no history
        loadedMessages.push({
          id: 'welcome',
          role: 'assistant',
          sessionId: currentSessionId,
          content: `## Welcome to KautilyaAI Co-Pilot! 🤖

I'm **KautilyaAI**, your intelligent financial advisor for Budget Buddy. Named after the ancient Indian philosopher and economist Chanakya (Kautilya), I bring wisdom to your wealth management.

I can help you:

- **Analyze your spending patterns** 📊
- **Review your expense categories** 💰
- **Understand shared expenses** 👥
- **Review your category budgets** 📈
- **Get personalized financial advice** 💡
- **Answer questions about your finances** ❓
- **Understand the People module and relationships** 🏠

Try asking me something like:
- *"Show me my spending this month"*
- *"How am I doing with my budget?"*
- *"Who do I spend the most money with?"*
- *"Help me understand the People module"*
- *"Show me shared expenses with family"*
- *"How do I add new people to track expenses?"*

Let's start managing your finances with ancient wisdom and modern AI! 🚀`,
          timestamp: new Date(),
        });
      }

      setMessages(loadedMessages);
      setLoadingHistory(false);
    }, (error) => {
      setLoadingHistory(false);
      toast.error('Failed to load chat history');
    });

    return () => unsubscribe();
  }, [user, currentSessionId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const createNewSession = async (): Promise<string> => {
    if (!user) return '';

    try {
      const sessionsRef = collection(db, `users/${user.uid}/chatSessions`);
      const newSession = await addDoc(sessionsRef, {
        title: 'New Chat',
        lastMessage: '',
        messageCount: 0,
        createdAt: serverTimestamp(),
        lastActivity: serverTimestamp(),
      });

      return newSession.id;
    } catch (error) {
      return '';
    }
  };

  const updateSessionActivity = async (sessionId: string, lastMessage: string) => {
    if (!user || !sessionId) return;

    try {
      const sessionRef = doc(db, `users/${user.uid}/chatSessions`, sessionId);
      await updateDoc(sessionRef, {
        lastMessage: lastMessage.substring(0, 100) + (lastMessage.length > 100 ? '...' : ''),
        lastActivity: serverTimestamp(),
        messageCount: messages.filter(m => m.id !== 'welcome').length + 1,
      });
    } catch {
      toast.error("Couldn’t save chat history.");
    }
  };

  const switchToSession = async (sessionId: string) => {
    setCurrentSessionId(sessionId);
    setShowSessions(false);
  };

  const createNewChatSession = async () => {
    const newSessionId = await createNewSession();
    if (newSessionId) {
      setCurrentSessionId(newSessionId);
      setShowSessions(false);
      toast.success('New chat session created');
    }
  };

  // Save message to Firestore
  const saveMessageToHistory = async (message: ChatMessage) => {
    if (!user || message.id === 'welcome') return;

    try {
      await addDoc(collection(db, `users/${user.uid}/conversations`), {
        role: message.role,
        content: message.content,
        timestamp: message.timestamp,
        sessionId: message.sessionId,
        actionItems: message.actionItems || [],
        isError: message.isError || false
      });
      
      // Update session activity
      if (message.sessionId) {
        await updateSessionActivity(message.sessionId, message.content);
      }
    } catch {
      toast.error("Couldn’t save chat history.");
    }
  };

  const sendMessage = async (message: string) => {
    if (!message.trim() || !user) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: message.trim(),
      timestamp: new Date(),
      sessionId: currentSessionId,
    };

    setMessages(prev => [...prev, userMessage]);
    setCurrentMessage('');
    setIsLoading(true);

    // Save user message
    await saveMessageToHistory(userMessage);

    try {
      const chat = httpsCallable<{ userId: string; message: string }, unknown>(functions, 'chatWithKautilya');
      const { data } = await observeOperation('ai.ask', () => chat({ userId: user.uid, message: message.trim() }));

      if (data && typeof data === 'object' && 'response' in data && typeof data.response === 'string' && data.response.trim()) {
        const aiMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
          sessionId: currentSessionId,
        };

        setMessages(prev => [...prev, aiMessage]);
        await saveMessageToHistory(aiMessage);
      } else {
        throw new Error('KautilyaAI returned an empty response');
      }
      
    } catch (error) {
      
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '**Sorry, I encountered an error.** 😔\n\nPlease try again in a moment. If the problem persists, make sure your internet connection is stable.',
        timestamp: new Date(),
        sessionId: currentSessionId,
        isError: true
      };
      
      setMessages(prev => [...prev, errorMessage]);
      await saveMessageToHistory(errorMessage);
      toast.error('Failed to send message');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = () => {
    sendMessage(currentMessage);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const deleteCurrentSession = async () => {
    if (!user || !currentSessionId) return;

    try {
      // Clear current session messages
      const conversationRef = collection(db, `users/${user.uid}/conversations`);
      const q = query(conversationRef, where('sessionId', '==', currentSessionId));
      
      const snapshot = await getDocs(q);
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      
      await Promise.all(deletePromises);
      
      // Delete the session itself
      await deleteDoc(doc(db, `users/${user.uid}/chatSessions`, currentSessionId));
      
      // Create a new session
      const newSessionId = await createNewSession();
      setCurrentSessionId(newSessionId);
      
      toast.success('Chat session deleted');
    } catch (error) {
      toast.error('Failed to delete session');
    }
  };

  const renameSession = async (sessionId: string, newTitle: string) => {
    if (!user || !newTitle.trim()) return;

    try {
      const sessionRef = doc(db, `users/${user.uid}/chatSessions`, sessionId);
      await updateDoc(sessionRef, {
        title: newTitle.trim(),
        lastActivity: new Date()
      });
      
      // Update local sessions state
      setSessions(prev => prev.map(session => 
        session.id === sessionId 
          ? { ...session, title: newTitle.trim() }
          : session
      ));
      
      toast.success('Session renamed');
    } catch (error) {
      toast.error('Failed to rename session');
    }
  };

  const deleteSession = async (sessionId: string) => {
    if (!user) return;

    try {
      // Delete all messages in the session
      const conversationRef = collection(db, `users/${user.uid}/conversations`);
      const q = query(conversationRef, where('sessionId', '==', sessionId));
      
      const snapshot = await getDocs(q);
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      
      await Promise.all(deletePromises);
      
      // Delete the session itself
      await deleteDoc(doc(db, `users/${user.uid}/chatSessions`, sessionId));
      
      // If this was the current session, create a new one
      if (sessionId === currentSessionId) {
        const newSessionId = await createNewSession();
        setCurrentSessionId(newSessionId);
      }
      
      toast.success('Session deleted');
    } catch (error) {
      toast.error('Failed to delete session');
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loadingHistory) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading conversation history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <Card className="mb-4 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-gradient-to-br from-primary to-primary/80 rounded-xl">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <CardTitle className="text-xl font-semibold">
                    KautilyaAI Co-Pilot
                  </CardTitle>
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-0 text-xs px-2 py-0.5 font-medium">
                    BETA
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Your intelligent financial advisor - bringing ancient wisdom to modern wealth
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {/* Chat Sessions */}
              <Sheet open={showSessions} onOpenChange={setShowSessions}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="shadow-md hover:shadow-lg transition-shadow border-0">
                    <History className="h-4 w-4" />
                    <span className="hidden sm:ml-1 sm:inline">Chat History</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-80 backdrop-blur-md bg-background/95 shadow-2xl border-0">
                  <SheetHeader className="pb-4">
                    <SheetTitle className="flex items-center space-x-2 text-lg">
                      <div className="p-2 bg-primary/10 rounded-lg shadow-sm">
                        <MessageSquare className="h-5 w-5 text-primary" />
                      </div>
                      <span>Chat Sessions</span>
                    </SheetTitle>
                  </SheetHeader>
                  <div className="mt-6 space-y-4 px-4">
                    {/* New Chat Button - Centered and styled */}
                    <div className="flex justify-center px-2">
                      <Button 
                        onClick={createNewChatSession} 
                        className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-xl transition-shadow px-6 py-2 rounded-lg font-medium text-sm border-0" 
                        size="sm"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        New Chat Session
                      </Button>
                    </div>
                    
                    {/* Session List with improved styling */}
                    <div className="space-y-3 px-2">
                      {sessions.map((session) => (
                        <div 
                          key={session.id} 
                          className={`group relative p-3 mx-1 rounded-xl transition-all duration-200 cursor-pointer shadow-md hover:shadow-lg ${
                            currentSessionId === session.id 
                              ? 'bg-primary/5 shadow-lg ring-1 ring-primary/20' 
                              : 'bg-card hover:bg-muted/30'
                          }`}
                          onClick={() => switchToSession(session.id)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0 pr-2">
                              {editingSessionId === session.id ? (
                                <Input
                                  value={editingTitle}
                                  onChange={(e) => setEditingTitle(e.target.value)}
                                  onBlur={() => {
                                    if (editingTitle.trim()) {
                                      renameSession(session.id, editingTitle);
                                    }
                                    setEditingSessionId(null);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      if (editingTitle.trim()) {
                                        renameSession(session.id, editingTitle);
                                      }
                                      setEditingSessionId(null);
                                    } else if (e.key === 'Escape') {
                                      setEditingSessionId(null);
                                    }
                                  }}
                                  className="h-7 text-sm font-medium shadow-sm border-0 focus:ring-2 focus:ring-primary/50"
                                  autoFocus
                                  onClick={(e) => e.stopPropagation()}
                                />
                              ) : (
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingSessionId(session.id);
                                    setEditingTitle(session.title);
                                  }}
                                  className="cursor-text group/title"
                                >
                                  <h4 className="font-semibold text-sm truncate text-foreground group-hover/title:text-primary transition-colors">
                                    {session.title}
                                  </h4>
                                </div>
                              )}
                              <div className="flex items-center space-x-3 mt-2">
                                <div className="flex items-center space-x-1">
                                  <div className="w-2 h-2 rounded-full bg-primary/60"></div>
                                  <span className="text-xs text-muted-foreground font-medium">
                                    {session.messageCount} msgs
                                  </span>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <div className="w-2 h-2 rounded-full bg-muted-foreground/40"></div>
                                  <span className="text-xs text-muted-foreground">
                                    {session.lastActivity.toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            {/* Action buttons */}
                            <div className="flex items-center space-x-1">
                              {currentSessionId === session.id && (
                                <Badge variant="default" className="text-xs px-2 py-1 bg-primary/10 text-primary shadow-sm border-0">
                                  Active
                                </Badge>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteSession(session.id);
                                }}
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {sessions.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
                            <MessageSquare className="h-8 w-8 opacity-50" />
                          </div>
                          <h3 className="font-medium text-sm mb-1">No chat sessions yet</h3>
                          <p className="text-xs">Start a conversation to create your first session</p>
                        </div>
                      )}
                    </div>
                  </div>
                </SheetContent>
              </Sheet>

              <Badge variant="secondary" className="hidden sm:flex shadow-md bg-muted/80 backdrop-blur-sm">
                <MessageSquare className="h-3 w-3 mr-1" />
                {messages.filter(m => m.id !== 'welcome').length} messages
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={deleteCurrentSession}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 shadow-md hover:shadow-lg transition-all border-0"
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:ml-1 sm:inline">Delete Chat</span>
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Chat Messages */}
      <Card className="flex-1 flex flex-col min-h-0 shadow-sm max-w-5xl mx-auto w-full">
        <CardContent className="flex-1 flex flex-col p-6 min-h-0">
          {/* Header with Title and Disclaimer */}
          <div className="mb-4 pb-4 border-b border-border/50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-white">
                      <Bot className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h1 className="text-lg font-semibold text-foreground">KautilyaAI Co-Pilot</h1>
                    <p className="text-sm text-muted-foreground">Your Intelligent Financial Assistant</p>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-0 text-xs px-2 py-0.5 font-medium">
                  BETA
                </Badge>
              </div>
            </div>
            
            {/* Disclaimer */}
            <div className="border rounded-lg p-3" style={{
              backgroundColor: 'var(--disclaimer-bg)',
              borderColor: 'var(--disclaimer-border)',
            }}>
              <div className="flex items-start space-x-2">
                <Sparkles className="h-4 w-4 mt-0.5 flex-shrink-0" style={{
                  color: 'var(--disclaimer-icon)'
                }} />
                <div className="text-sm">
                  <p className="font-medium mb-1" style={{
                    color: 'var(--disclaimer-title)'
                  }}>
                    AI Assistant Disclaimer
                  </p>
                  <p className="text-xs leading-relaxed" style={{
                    color: 'var(--disclaimer-text)'
                  }}>
                    KautilyaAI is here to help you make informed financial decisions, but please remember that AI can make mistakes. 
                    Always verify important financial information and consult with qualified professionals for major financial decisions. 
                    Kautilya is designed to support and guide you, not to replace your judgment or cause emotional distress.
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <div 
                  key={message.id} 
                  className={`flex w-full ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div className={`flex items-start gap-3 max-w-[85%] ${
                    message.role === 'user' ? 'flex-row-reverse' : ''
                  }`}>
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className={message.role === 'user' ? 'bg-blue-500 text-white' : 'bg-primary text-primary-foreground'}>
                        {message.role === 'user' ? (
                          <User className="h-4 w-4" />
                        ) : (
                          <Bot className="h-4 w-4" />
                        )}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <div className={`p-3 rounded-lg shadow-sm ${
                        message.role === 'user'
                          ? 'bg-blue-500 text-white'
                          : message.isError
                          ? 'bg-red-50 border border-red-200 text-red-800 dark:bg-red-950/20 dark:border-red-800 dark:text-red-200'
                          : 'bg-muted text-foreground border'
                      }`}>
                      {message.role === 'assistant' && !message.isError ? (
                        <div className="prose prose-sm max-w-none dark:prose-invert">
                          <ReactMarkdown
                            components={{
                              p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed text-sm">{children}</p>,
                              ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1 text-sm">{children}</ul>,
                              ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1 text-sm">{children}</ol>,
                              li: ({ children }) => <li className="leading-relaxed text-sm">{children}</li>,
                              strong: ({ children }) => <strong className="font-semibold text-blue-600 dark:text-blue-400">{children}</strong>,
                              em: ({ children }) => <em className="italic text-purple-600 dark:text-purple-400">{children}</em>,
                              code: ({ children }) => <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-xs">{children}</code>,
                              h2: ({ children }) => <h2 className="text-base font-semibold mb-2 mt-3 first:mt-0">{children}</h2>,
                              h3: ({ children }) => <h3 className="text-sm font-medium mb-1 mt-2 first:mt-0">{children}</h3>,
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                      )}
                      </div>
                      
                      <p className={`text-xs mt-1 ${
                        message.role === 'user' ? 'text-right text-blue-200' : 'text-muted-foreground'
                      }`}>
                        {formatTime(message.timestamp)}
                      </p>
                    
                    {/* ML Enhancement: Show intent and metadata for assistant messages */}
                    {message.role === 'assistant' && !message.isError && (message.intentType || message.metadata) && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {message.intentType && (
                          <Badge variant="outline" className="text-xs">
                            {message.intentType === 'DATA_RETRIEVAL' && '📊 Data'}
                            {message.intentType === 'ANALYSIS' && '📈 Analysis'}
                            {message.intentType === 'CRUD_OPERATION' && '✏️ Action'}
                            {message.intentType === 'GENERAL_CHAT' && '💬 Chat'}
                          </Badge>
                        )}
                        {message.metadata?.dataCount && (
                          <Badge variant="secondary" className="text-xs">
                            {message.metadata.dataCount} items
                          </Badge>
                        )}
                        {message.metadata?.totalAmount && (
                          <Badge variant="secondary" className="text-xs">
                            Total: {formatCurrency(message.metadata.totalAmount)}
                          </Badge>
                        )}
                      </div>
                    )}
                    
                    {/* Action Items */}
                    {message.actionItems && message.actionItems.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {message.actionItems.map((action, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {action.suggestion}
                          </Badge>
                        ))}
                      </div>
                    )}
                    </div>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex items-start space-x-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-muted p-3 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="mt-4 flex space-x-2">
            <Input
              ref={inputRef}
              value={currentMessage}
              onChange={(e) => setCurrentMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me about your finances..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button 
              onClick={handleSend} 
              disabled={!currentMessage.trim() || isLoading}
              size="default"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
