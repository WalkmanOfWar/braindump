import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  emoji: string;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({ emoji, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 text-center gap-4", className)}>
      {/* Animated illustration */}
      <div className="relative flex items-center justify-center">
        <div className="absolute w-24 h-24 rounded-full bg-primary/5 animate-ping [animation-duration:3s]" />
        <div className="relative w-20 h-20 rounded-full bg-primary/8 flex items-center justify-center">
          <span
            className="text-4xl select-none animate-bounce [animation-duration:2s]"
            role="img"
            aria-hidden="true"
          >
            {emoji}
          </span>
        </div>
      </div>

      <div className="max-w-xs space-y-1.5">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>

      {action && (
        <Button onClick={action.onClick} className="mt-1">
          {action.label}
        </Button>
      )}
    </div>
  );
}
