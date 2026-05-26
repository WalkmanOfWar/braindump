"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    output[i] = rawData.charCodeAt(i);
  }

  return output;
}

export function PushSubscribeButton() {
  const [state, setState] = useState<"idle" | "subscribed" | "loading" | "unsupported">("idle");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    navigator.serviceWorker.ready.then((reg) =>
      reg.pushManager.getSubscription().then((sub) => {
        setState(sub ? "subscribed" : "idle");
      })
    );
  }, []);

  const subscribe = async () => {
    setState("loading");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });
      setState("subscribed");
      toast.success("Powiadomienia włączone!");
    } catch {
      setState("idle");
      toast.error("Nie udało się włączyć powiadomień");
    }
  };

  const unsubscribe = async () => {
    setState("loading");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("idle");
      toast.success("Powiadomienia wyłączone");
    } catch {
      setState("subscribed");
      toast.error("Nie udało się wyłączyć powiadomień");
    }
  };

  const sendTest = async () => {
    const res = await fetch("/api/push/test", { method: "POST" });
    if (res.ok) toast.success("Powiadomienie testowe wysłane");
    else toast.error("Nie udało się wysłać");
  };

  if (state === "unsupported") return null;

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={state === "subscribed" ? unsubscribe : subscribe}
        disabled={state === "loading"}
        title={state === "subscribed" ? "Wyłącz powiadomienia push" : "Włącz powiadomienia push"}
        className="h-8 w-8 p-0"
      >
        {state === "loading" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : state === "subscribed" ? (
          <BellOff className="h-4 w-4" />
        ) : (
          <Bell className="h-4 w-4" />
        )}
      </Button>
      {state === "subscribed" && (
        <Button
          variant="ghost"
          size="sm"
          onClick={sendTest}
          title="Wyślij testowe powiadomienie"
          className="h-8 w-8 p-0 text-muted-foreground"
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
