"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

// Toasts are small white cards: 12px radius, hairline, soft shadow. Success
// and error toasts keep sonner's icons, tinted with the status tokens, so the
// state never relies on colour alone.
export function Toaster(props: ToasterProps) {
  const { theme = "light" } = useTheme();
  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        style: { borderRadius: "0.75rem" },
        classNames: {
          toast:
            "group toast group-[.toaster]:rounded-xl group-[.toaster]:border-border group-[.toaster]:bg-card group-[.toaster]:font-sans group-[.toaster]:text-foreground group-[.toaster]:shadow-lg",
          title: "group-[.toast]:font-semibold",
          description: "group-[.toast]:text-muted-foreground",
          success: "[&_[data-icon]]:text-success",
          error: "[&_[data-icon]]:text-destructive",
          warning: "[&_[data-icon]]:text-warning",
          info: "[&_[data-icon]]:text-info",
          actionButton:
            "group-[.toast]:rounded-lg group-[.toast]:bg-primary group-[.toast]:font-semibold group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:rounded-lg group-[.toast]:bg-secondary group-[.toast]:text-foreground",
        },
      }}
      {...props}
    />
  );
}
