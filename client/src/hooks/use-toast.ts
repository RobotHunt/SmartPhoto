// Simple toast hook for notifications
import { useState, useCallback } from "react";

export interface Toast {
  title: string;
  description?: string;
  variant?: "default" | "destructive";
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((props: Toast) => {
    // For now, just use console.log
    // In a real app, this would show a toast notification
    console.log(`[Toast] ${props.title}${props.description ? `: ${props.description}` : ""}`);
    
    // You can also use alert for immediate feedback
    if (props.variant === "destructive") {
      console.error(`[Error] ${props.title}: ${props.description}`);
    }
  }, []);

  return { toast, toasts };
}
