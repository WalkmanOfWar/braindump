"use client";

import { signIn, getProviders, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import type { ClientSafeProvider, LiteralUnion } from "next-auth/react";
import type { BuiltInProviderType } from "next-auth/providers";

type Providers = Record<
  LiteralUnion<BuiltInProviderType, string>,
  ClientSafeProvider
>;

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="#1877F2">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

const PROVIDER_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  google: GoogleIcon,
  github: GitHubIcon,
  facebook: FacebookIcon,
};

const PROVIDER_LABELS: Record<string, string> = {
  google: "Zaloguj się przez Google",
  github: "Zaloguj się przez GitHub",
  facebook: "Zaloguj się przez Facebook",
};

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [providers, setProviders] = useState<Providers | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [credLoading, setCredLoading] = useState(false);
  const [credError, setCredError] = useState("");

  useEffect(() => {
    getProviders().then(setProviders);
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/dashboard");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Ładowanie…</p>
      </div>
    );
  }

  if (session) return null;

  const oauthProviders = providers
    ? Object.values(providers).filter((p) => p.type === "oauth")
    : [];

  const hasCredentials = providers && "credentials" in providers;

  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCredError("");
    setCredLoading(true);
    const result = await signIn("credentials", {
      email,
      password,
      callbackUrl: "/dashboard",
      redirect: false,
    });
    setCredLoading(false);
    if (result?.error) {
      setCredError("Nieprawidłowy email lub hasło");
    } else if (result?.url) {
      router.push(result.url);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-background">
      <Card className="w-full max-w-md border-border shadow-sm">
        <CardHeader className="text-center space-y-2 pb-4">
          <h1 className="text-2xl font-bold text-foreground">Brain Dump</h1>
          <p className="text-sm text-muted-foreground">
            Wyrzuć myśli z głowy. Zacznij działać.
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          {oauthProviders.map((provider) => {
            const Icon = PROVIDER_ICONS[provider.id];
            const label = PROVIDER_LABELS[provider.id] ?? `Zaloguj się przez ${provider.name}`;
            return (
              <Button
                key={provider.id}
                onClick={() => signIn(provider.id, { callbackUrl: "/dashboard" })}
                className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {Icon && <Icon className="h-5 w-5 mr-2" />}
                {label}
              </Button>
            );
          })}

          {oauthProviders.length > 0 && hasCredentials && (
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">lub</span>
              </div>
            </div>
          )}

          {hasCredentials && (
            <form onSubmit={handleCredentialsLogin} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jan@example.com"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="password">Hasło</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              {credError && (
                <p className="text-xs text-destructive">{credError}</p>
              )}
              <Button
                type="submit"
                disabled={credLoading}
                className="w-full h-11 bg-accent text-accent-foreground hover:bg-accent/90"
              >
                {credLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Zaloguj się
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Nie masz konta?{" "}
                <a href="/register" className="text-primary underline">
                  Zarejestruj się
                </a>
              </p>
            </form>
          )}

          {!providers && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          <p className="text-xs text-center text-muted-foreground">
            Logując się, akceptujesz warunki korzystania z aplikacji.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
