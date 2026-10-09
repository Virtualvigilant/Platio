import { cn } from "./cn";

/** The product mark is the name set in type. There is no drawn logo (the name is provisional). */
export function Wordmark({ size = "md", className }: { size?: "sm" | "md"; className?: string }) {
  return (
    <span
      className={cn(
        "font-serif font-bold tracking-[0.02em] text-brand uppercase",
        size === "sm" ? "text-[20px] leading-6" : "text-wordmark",
        className,
      )}
    >
      DineFlow
    </span>
  );
}

/** The flat teal bar from the brief's cover, about 6.5 times wider than tall. */
export function AccentBar({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("block h-6 w-39 rounded-0 bg-brand", className)} />;
}
