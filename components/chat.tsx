'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useSession } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, AlertCircle, RotateCcw, MessageSquare, ImageIcon, Download, Loader2 } from 'lucide-react';
import { UIMessage } from 'ai';
import { Streamdown } from 'streamdown';
import { CONVERSATIONS_CHANGED_EVENT } from '@/components/chat-sidebar';
import { DEFAULT_CONVERSATION_TITLE, deriveTitle } from '@/lib/conversation-title';
import { IMAGE_USER_PREFIX, parseImageMessage } from '@/lib/image-message';

type Mode = 'chat' | 'image';
type Aspect = 'square' | 'landscape' | 'portrait';

function notifySidebar() {
  window.dispatchEvent(new Event(CONVERSATIONS_CHANGED_EVENT));
}

function GeneratedImage({ imageId, prompt }: { imageId: string; prompt: string }) {
  const src = `/api/images/${imageId}`;
  return (
    <div className="space-y-2">
      <a href={src} target="_blank" rel="noopener noreferrer" title="Open full size">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={prompt}
          loading="lazy"
          className="h-auto w-full max-w-md rounded-xl border border-gray-200 bg-white"
        />
      </a>
      <div className="flex items-start justify-between gap-3">
        <p className="line-clamp-2 text-xs text-gray-500">{prompt}</p>
        <a
          href={src}
          download
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-rose-200 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
        >
          <Download className="h-3 w-3" />
          Download
        </a>
      </div>
    </div>
  );
}

interface ChatProps {
  conversationId: string;
  initialMessages?: UIMessage[];
  conversationTitle?: string;
}

export default function Chat({ conversationId, initialMessages = [], conversationTitle }: ChatProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<Mode>('chat');
  const [aspect, setAspect] = useState<Aspect>('square');
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, setMessages, sendMessage, status, error, stop } = useChat({
    id: conversationId, // Use conversation ID for persistence
    messages: initialMessages, // Load initial messages
    onFinish: () => notifySidebar(), // refresh the chat history list
    transport: new DefaultChatTransport({
      api: '/api/chat',
      // Optimized: only send the last message to reduce data transfer
      prepareSendMessagesRequest({ messages, id }) {
        return { 
          body: { 
            message: messages[messages.length - 1], 
            id 
          } 
        };
      },
    }),
  });

  // Auto-scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, status, imageLoading]);

  // Ask the server to generate an image and add the exchange to the chat
  async function generateImage(prompt: string) {
    setImageError(null);
    setImageLoading(true);

    const tempId = `pending-${Date.now()}`;
    setMessages(prev => [
      ...prev,
      { id: tempId, role: 'user', parts: [{ type: 'text', text: `${IMAGE_USER_PREFIX}${prompt}` }] },
    ]);

    try {
      const res = await fetch('/api/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: conversationId, prompt, aspect }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Image generation failed. Please try again.');
      }
      setMessages(prev => [
        ...prev.filter(m => m.id !== tempId),
        data.userMessage,
        data.assistantMessage,
      ]);
      notifySidebar();
    } catch (err) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setImageError(err instanceof Error ? err.message : 'Image generation failed.');
      setInput(prompt); // let the user edit and retry
    } finally {
      setImageLoading(false);
    }
  }

  const busy = status !== 'ready' || imageLoading;

  // Until the server-side title is refreshed, show a title based on the first message
  const firstUserText = messages
    .find(m => m.role === 'user')
    ?.parts.find(part => part.type === 'text')?.text;
  const headerTitle =
    conversationTitle && conversationTitle !== DEFAULT_CONVERSATION_TITLE
      ? conversationTitle
      : firstUserText
        ? deriveTitle(firstUserText)
        : conversationTitle;

  if (!session) {
    return null;
  }

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="bg-white border-b border-rose-100 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Avatar className="h-9 w-9">
              <AvatarImage src={session.user.image || ''} />
              <AvatarFallback className="bg-rose-500 text-white font-medium">
                {session.user.name?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">
                {headerTitle || 'AI Chat'}
              </h1>
              <p className="text-sm text-rose-500">Chat or create images with AI</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            onClick={() => router.push('/dashboard')}
            className="border-rose-200 text-rose-600 hover:bg-rose-50"
          >
            Back to Dashboard
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="text-center py-20">
              <div className="w-16 h-16 mx-auto mb-6 bg-rose-100 rounded-full flex items-center justify-center">
                <Bot className="h-8 w-8 text-rose-500" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Start a conversation
              </h3>
              <p className="text-gray-500">
                Ask me anything, or switch to <span className="font-medium text-rose-500">Image</span> mode to create a picture.
              </p>
            </div>
          )}
          
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex items-start space-x-3 max-w-2xl ${message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                <Avatar className="h-7 w-7 flex-shrink-0">
                  {message.role === 'user' ? (
                    <>
                      <AvatarImage src={session.user.image || ''} />
                      <AvatarFallback className="bg-rose-500 text-white text-xs">
                        <User className="h-3 w-3" />
                      </AvatarFallback>
                    </>
                  ) : (
                    <AvatarFallback className="bg-rose-100">
                      <Bot className="h-3 w-3 text-rose-500" />
                    </AvatarFallback>
                  )}
                </Avatar>
                
                <div className={`rounded-2xl px-4 py-3 ${
                  message.role === 'user' 
                    ? 'bg-rose-500 text-white' 
                    : 'bg-gray-50 text-gray-900 border border-gray-100'
                }`}>
                  <div className="text-sm leading-relaxed">
                    {message.parts.map((part, i) => {
                      switch (part.type) {
                        case 'text': {
                          const image = message.role === 'assistant' ? parseImageMessage(part.text) : null;
                          if (image) {
                            return <GeneratedImage key={i} imageId={image.imageId} prompt={image.prompt} />;
                          }
                          return message.role === 'assistant' ? (
                            <Streamdown 
                              key={i}
                              className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-strong:text-gray-900 prose-code:text-rose-600 prose-code:bg-rose-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-gray-100 prose-pre:border prose-pre:border-gray-200"
                              parseIncompleteMarkdown={true}
                            >
                              {part.text}
                            </Streamdown>
                          ) : (
                            <span key={i} className="whitespace-pre-wrap">{part.text}</span>
                          );
                        }
                        default:
                          return null;
                      }
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {(status === 'submitted' || status === 'streaming') && (
            <div className="flex justify-start">
              <div className="flex items-start space-x-3 max-w-2xl">
                <Avatar className="h-7 w-7 flex-shrink-0">
                  <AvatarFallback className="bg-rose-100">
                    <Bot className="h-3 w-3 text-rose-500" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3">
                  <div className="flex items-center space-x-2">
                    {status === 'submitted' && (
                      <div className="flex space-x-1">
                        <div className="w-1.5 h-1.5 bg-rose-400 rounded-full animate-bounce"></div>
                        <div className="w-1.5 h-1.5 bg-rose-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-1.5 h-1.5 bg-rose-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    )}
                    <span className="text-gray-500 text-sm">
                      {status === 'submitted' ? 'AI is thinking...' : 'AI is responding...'}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => stop()}
                      className="ml-2 h-5 px-2 text-xs text-rose-500 hover:bg-rose-50"
                    >
                      Stop
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {imageLoading && (
            <div className="flex justify-start">
              <div className="flex items-start space-x-3 max-w-2xl">
                <Avatar className="h-7 w-7 flex-shrink-0">
                  <AvatarFallback className="bg-rose-100">
                    <ImageIcon className="h-3 w-3 text-rose-500" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3">
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin text-rose-500" />
                    <span>Creating your image… this can take up to a minute</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {imageError && (
            <div className="flex justify-start">
              <div className="flex items-start space-x-3 max-w-2xl">
                <Avatar className="h-7 w-7 flex-shrink-0">
                  <AvatarFallback className="bg-red-100">
                    <AlertCircle className="h-3 w-3 text-red-500" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
                  <p className="text-red-800 font-medium text-sm">Couldn&apos;t create the image</p>
                  <p className="text-red-600 text-xs mt-0.5 break-words">{imageError}</p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex justify-start">
              <div className="flex items-start space-x-3 max-w-2xl">
                <Avatar className="h-7 w-7 flex-shrink-0">
                  <AvatarFallback className="bg-red-100">
                    <AlertCircle className="h-3 w-3 text-red-500" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-red-800 font-medium text-sm">Something went wrong</p>
                      <p className="text-red-600 text-xs">Please try again</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.location.reload()}
                      className="ml-2 h-6 px-2 text-xs border-red-200 text-red-600 hover:bg-red-100"
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Retry
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Invisible element to scroll to */}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="bg-white border-t border-rose-100 p-4 md:p-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const text = input.trim();
            if (!text || busy) return;
            setInput('');
            if (mode === 'image') {
              generateImage(text);
            } else {
              setImageError(null);
              sendMessage({ text });
            }
          }}
          className="max-w-4xl mx-auto space-y-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-rose-200 p-0.5" role="group" aria-label="Mode">
              <button
                type="button"
                onClick={() => setMode('chat')}
                aria-pressed={mode === 'chat'}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                  mode === 'chat' ? 'bg-rose-500 text-white' : 'text-gray-600 hover:bg-rose-50'
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Chat
              </button>
              <button
                type="button"
                onClick={() => setMode('image')}
                aria-pressed={mode === 'image'}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                  mode === 'image' ? 'bg-rose-500 text-white' : 'text-gray-600 hover:bg-rose-50'
                }`}
              >
                <ImageIcon className="h-3.5 w-3.5" />
                Image
              </button>
            </div>

            {mode === 'image' && (
              <select
                value={aspect}
                onChange={(e) => setAspect(e.target.value as Aspect)}
                aria-label="Image shape"
                className="rounded-lg border border-rose-200 bg-white px-2 py-1.5 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="square">Square</option>
                <option value="landscape">Landscape</option>
                <option value="portrait">Portrait</option>
              </select>
            )}
          </div>

          <div className="flex space-x-3">
            <input
              className="min-w-0 flex-1 p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-colors"
              value={input}
              placeholder={
                mode === 'image'
                  ? 'Describe the image you want to create...'
                  : 'Type your message...'
              }
              onChange={(e) => setInput(e.target.value)}
              disabled={busy}
            />
            <Button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label={mode === 'image' ? 'Generate image' : 'Send message'}
              className="px-4 bg-rose-500 hover:bg-rose-600 text-white rounded-xl"
            >
              {mode === 'image' ? <ImageIcon className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
