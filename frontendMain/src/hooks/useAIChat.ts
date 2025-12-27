import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface ChatRequest {
  message: string;
  context?: {
    page?: string;
    userTier?: string;
  };
}

interface ChatResponse {
  reply: string;
}

export function useAIChat() {
  return useMutation({
    mutationFn: async (request: ChatRequest): Promise<ChatResponse> => {
      return api.post<ChatResponse>("/api/ai/chat", request);
    },
    onError: (error: any) => {
      const message = error?.data?.message || error?.message || "Failed to get AI response";
      
      // Handle rate limit errors
      if (error?.status === 429) {
        toast.error("Too many requests. Please wait a minute and try again.");
      } else if (error?.status === 400) {
        toast.error(message);
      } else {
        toast.error("AI Copilot is temporarily unavailable. Please try again later.");
      }
    },
  });
}

