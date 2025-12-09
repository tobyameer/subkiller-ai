import { useEffect } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { useAppStore } from "../store/useAppStore";
import { formatCurrency } from "../lib/utils";

export default function SuggestionsPage() {
  const suggestions = useAppStore((s) => s.suggestions);
  const loadSuggestions = useAppStore((s) => s.loadSuggestions);
  const acceptSuggestion = useAppStore((s) => s.acceptSuggestion);
  const ignoreSuggestion = useAppStore((s) => s.ignoreSuggestion);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">Review AI-generated candidates</p>
          <h1 className="text-3xl font-semibold text-slate-50">Suggestions</h1>
        </div>
      </div>
      {suggestions.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-slate-300">No pending suggestions right now.</CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-slate-100">
              Pending suggestions ({suggestions.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {suggestions.map((s) => (
              <div
                key={s.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-800/70 bg-slate-900/60 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <div className="flex items-center gap-2 text-lg font-semibold text-slate-50">
                    {s.service || "Unknown service"}
                    <span className="text-sm text-slate-400">({s.kind})</span>
                  </div>
                  <div className="text-sm text-slate-300">
                    {s.amount ? formatCurrency(s.amount) : "$0"} • {s.currency || "USD"} • {s.category}
                  </div>
                  <div className="text-sm text-slate-400">
                    Subject: {s.subject} | From: {s.from}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => acceptSuggestion(s.id)}>
                    Add as subscription
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => ignoreSuggestion(s.id)}>
                    Ignore
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
