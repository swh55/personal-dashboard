"use client";

import * as React from "react";
import { useSession, signOut, signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogIn, LogOut, User as UserIcon, Loader2 } from "lucide-react";
import { migrateGuestData } from "@/lib/sync/migrate-guest";

/**
 * Auth button for the top bar.
 * - Loading state shows a spinner.
 * - Guest → "تسجيل الدخول" button that triggers the NextAuth sign-in flow.
 * - Authenticated → avatar + name dropdown with "تسجيل الخروج" and the
 *   user's email. On first login after a guest session, we kick off the
 *   guest→cloud migration in the background and surface a toast.
 */
export function AuthButton() {
  const { data: session, status } = useSession();
  const [migrating, setMigrating] = React.useState(false);

  // Trigger guest→cloud migration once when the user becomes authenticated.
  React.useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const already = localStorage.getItem("guest-migrated");
        if (already === session.user.id) return; // already migrated for this user
        setMigrating(true);
        const result = await migrateGuestData();
        if (!cancelled && result && result.migrated > 0) {
          console.log(
            `[auth] Migrated ${result.migrated} guest records to cloud for user ${session.user.id}`
          );
        }
        localStorage.setItem("guest-migrated", session.user.id);
      } catch (err) {
        console.error("[auth] Guest migration failed:", err);
      } finally {
        if (!cancelled) setMigrating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, session?.user?.id]);

  if (status === "loading") {
    return (
      <Button variant="ghost" size="sm" className="size-8 p-0" disabled>
        <Loader2 className="size-4 animate-spin" />
      </Button>
    );
  }

  if (status === "authenticated" && session?.user) {
    const initial = (session.user.name || session.user.email || "؟").charAt(0);
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="flex h-8 items-center gap-1.5 rounded-full bg-emerald-glow/10 px-1.5 text-emerald-glow"
            aria-label="حساب المستخدم"
          >
            {session.user.image ? (
              <img
                src={session.user.image}
                alt=""
                className="size-6 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="flex size-6 items-center justify-center rounded-full bg-emerald-glow/20 text-xs font-bold">
                {initial}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="flex flex-col">
            <span className="text-sm font-medium">{session.user.name || "مستخدم"}</span>
            <span className="text-xs text-muted-foreground truncate">
              {session.user.email}
            </span>
            {migrating && (
              <span className="mt-1 flex items-center gap-1 text-xs text-amber-glow">
                <Loader2 className="size-3 animate-spin" />
                جارٍ نقل بيانات الزائر…
              </span>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => signOut({ callbackUrl: "/" })}
            className="cursor-pointer text-rose-400 focus:text-rose-300"
          >
            <LogOut className="ms-2 size-4" />
            <span>تسجيل الخروج</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Guest — show sign-in button
  return (
    <Button
      variant="ghost"
      size="sm"
      className="flex h-8 items-center gap-1.5 rounded-md px-2 text-emerald-glow"
      onClick={() => signIn()}
      aria-label="تسجيل الدخول"
    >
      <LogIn className="size-4" />
      <span className="text-xs">دخول</span>
    </Button>
  );
}

export { UserIcon };
