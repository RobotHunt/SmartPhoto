import { useState, useCallback } from "react";
import { toast as sonnerToast } from "sonner";

export interface Toast {
  title: string;
  description?: string;
  variant?: "default" | "destructive";
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((props: Toast) => {
    setToasts((previous) => [...previous, props]);

    const options = props.description ? { description: props.description } : undefined;
    if (props.variant === "destructive") {
      sonnerToast.error(props.title, options);
      return;
    }

    sonnerToast(props.title, options);
  }, []);

  return { toast, toasts };
}
