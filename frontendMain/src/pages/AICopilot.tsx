import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Send, User, Sparkles } from "lucide-react";
import { useAIChat } from "@/hooks/useAIChat";
import { useUser } from "@/hooks/useAuth";

const suggestionChips = [
  "Why is this month higher than last?",
  "Which subs should I cancel first?",
  "Show me all Spotify charges this year",
  "What's my average monthly spend?",
];

interface Message {
  id: string;
  role: "user" | "ai";
  content: string;
}

const initialMessages: Message[] = [
  {
    id: "1",
    role: "ai",
    content: "Hey! I'm your SubKiller AI Copilot. Connect Gmail and run a scan, then ask me about your spending or subscriptions.",
  },
];

export default function AICopilot() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const { data: user } = useUser();
  const aiChat = useAIChat();

  const handleSend = async () => {
    if (!input.trim() || aiChat.isPending) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };

    const messageText = input.trim();
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    try {
      const response = await aiChat.mutateAsync({
        message: messageText,
        context: {
          page: "ai-copilot",
          userTier: user?.plan || "free",
        },
      });

      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        content: response.reply,
      };
      setMessages((prev) => [...prev, aiResponse]);
    } catch (error) {
      // Error is already handled by useAIChat hook (shows toast)
      // Add error message to chat for user visibility
      const errorResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        content: "I'm sorry, I couldn't process your request. Please try again.",
      };
      setMessages((prev) => [...prev, errorResponse]);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      
      <main className="flex-1 pt-16">
        <div className="h-[calc(100vh-4rem)] flex">
          {/* Left Panel - Context */}
          <div className="hidden lg:flex w-80 border-r border-border flex-col bg-card/30">
            <div className="p-6 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground mb-1">Spending Context</h2>
              <p className="text-sm text-muted-foreground">AI uses this after you scan Gmail.</p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="flex flex-col items-start gap-2 text-sm text-muted-foreground">
                <Sparkles className="w-4 h-4 text-primary" />
                <p>No context yet. Connect Gmail and run a scan to see live spend insights here.</p>
              </div>
            </div>
          </div>

          {/* Right Panel - Chat */}
          <div className="flex-1 flex flex-col">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] md:max-w-[60%] ${
                      message.role === "user"
                        ? "bg-primary/10 border border-primary/20 rounded-2xl rounded-tr-md"
                        : "bg-secondary border border-border rounded-2xl rounded-tl-md"
                    } px-4 py-3`}
                  >
                    {message.role === "ai" && (
                      <div className="flex items-center gap-2 mb-2">
                        <Bot className="w-4 h-4 text-primary" />
                        <span className="text-xs text-muted-foreground">SubKiller AI</span>
                      </div>
                    )}
                    {message.role === "user" && (
                      <div className="flex items-center gap-2 mb-2 justify-end">
                        <span className="text-xs text-muted-foreground">You</span>
                        <User className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="text-sm text-foreground whitespace-pre-wrap">
                      {message.content.split("**").map((part, i) =>
                        i % 2 === 1 ? (
                          <strong key={i} className="text-primary">{part}</strong>
                        ) : (
                          part
                        )
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {aiChat.isPending && (
                <div className="flex justify-start">
                  <div className="bg-secondary border border-border rounded-2xl rounded-tl-md px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Bot className="w-4 h-4 text-primary" />
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Suggestion chips */}
            <div className="px-6 pb-2">
              <div className="flex flex-wrap gap-2">
                {suggestionChips.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => handleSuggestionClick(chip)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary/50 border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
                  >
                    <Sparkles className="w-3 h-3" />
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Input area */}
            <div className="p-6 border-t border-border bg-card/30">
              <div className="flex gap-3">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask SubKiller anything about your spending..."
                  className="min-h-[52px] max-h-32 resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <Button
                  variant="hero"
                  size="icon"
                  className="h-[52px] w-[52px] flex-shrink-0"
                  onClick={handleSend}
                  disabled={!input.trim() || aiChat.isPending}
                >
                  <Send className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
