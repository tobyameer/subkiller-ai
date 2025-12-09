import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MessageCircle, Loader2, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { api } from "../lib/api";
import { useAppStore } from "../store/useAppStore";

type ChatMessage = {
  role: "user" | "ai";
  content: string;
};

export default function AICopilotPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [overview, setOverview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAppStore((state) => state.user);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const service = params.get("service");
    if (service) {
      setInput(`Is my ${service} subscription worth keeping?`);
      // clean the URL to avoid repeated prefill on navigation
      navigate("/ai", { replace: true });
    }
  }, [location.search, navigate]);

  const disabled = useMemo(() => sending || !input.trim(), [sending, input]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMessage: ChatMessage = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setSending(true);
    try {
      const res = await api.post<{ reply: string }>("/ai/chat", {
        message: userMessage.content,
      });
      if (res?.reply) {
        setMessages((prev) => [...prev, { role: "ai", content: res.reply }]);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Chat failed", err);
    } finally {
      setSending(false);
    }
  };

  const handleOverview = async () => {
    setLoadingOverview(true);
    try {
      const res = await api.post<{ overview: string }>("/ai/overview", {});
      if (res?.overview) {
        setOverview(res.overview);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Overview failed", err);
    } finally {
      setLoadingOverview(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400">Ask only when you need insight</p>
          <h1 className="text-3xl font-semibold text-slate-50">AI Copilot</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Chat with AI about your payments and subscriptions whenever you need. No noise, just answers when you ask.
          </p>
        </div>
        {user && (
          <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs text-slate-300">
            Signed in as <span className="font-semibold text-slate-100">{user.email}</span>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1 border-slate-800 bg-slate-900/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-100">
              <Sparkles className="h-5 w-5 text-emerald-300" />
              On-demand overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-200">
            {!overview && (
              <p className="text-slate-400">
                Generate a quick AI overview of your subscriptions and spending. We&apos;ll only run it when you ask.
              </p>
            )}
            {overview && (
              <div className="rounded-lg border border-slate-800 bg-slate-900 p-3 text-slate-100 whitespace-pre-wrap">
                {overview}
              </div>
            )}
            <Button
              className="w-full"
              onClick={handleOverview}
              disabled={loadingOverview}
            >
              {loadingOverview ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Generate overview with AI
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-slate-800 bg-slate-900/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-100">
              <MessageCircle className="h-5 w-5 text-emerald-300" />
              Ask a question
            </CardTitle>
          </CardHeader>
          <CardContent className="flex h-[480px] flex-col gap-4">
            <div className="flex-1 space-y-3 overflow-auto rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              {messages.length === 0 && (
                <p className="text-sm text-slate-400">
                  Start a conversation to get tailored insights about your subscriptions and spend.
                </p>
              )}
              {messages.map((msg, idx) => (
                <div
                  key={`${msg.role}-${idx}`}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      msg.role === "user"
                        ? "bg-emerald-600/80 text-slate-50"
                        : "bg-slate-800 text-slate-100"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  AI is thinking…
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Ask AI about your spending…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <Button onClick={handleSend} disabled={disabled}>
                Send
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
