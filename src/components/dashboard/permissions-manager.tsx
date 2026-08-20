"use client";

import * as React from "react";
import {
  Shield,
  Camera,
  MapPin,
  Users,
  Bell,
  Check,
  X,
  Loader2,
  Smartphone,
} from "lucide-react";
import {
  requestAllPermissions,
  checkAllPermissions,
  isNative,
  type PermissionStatus,
} from "@/lib/native/bridge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const PERMISSION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  camera: Camera,
  location: MapPin,
  contacts: Users,
  notifications: Bell,
};

export function PermissionsManager() {
  const [permissions, setPermissions] = React.useState<PermissionStatus[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [showDialog, setShowDialog] = React.useState(false);
  const [checked, setChecked] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const statuses = await checkAllPermissions();
      setPermissions(statuses);
      setChecked(true);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const handleRequestAll = async () => {
    setLoading(true);
    try {
      const statuses = await requestAllPermissions();
      setPermissions(statuses);
      setShowDialog(false);
    } finally {
      setLoading(false);
    }
  };

  // Only show in native mode
  if (!isNative()) return null;

  const allGranted = permissions.length > 0 && permissions.every((p) => p.granted);
  const someDenied = permissions.some((p) => !p.granted);

  return (
    <>
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500 shrink-0">
            <Shield className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold">صلاحيات التطبيق</span>
              {allGranted && (
                <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30">
                  <Check className="size-3 ms-1" />
                  ممنوحة
                </Badge>
              )}
              {someDenied && (
                <Badge className="bg-amber-500/15 text-amber-500 border-amber-500/30">
                  يحتاج صلاحيات
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {allGranted
                ? "جميع الصلاحيات ممنوحة — التطبيق يعمل بكامل ميزاته"
                : "امنح الصلاحيات لتفعيل المزامنة والمكالمات والكاميرا والموقع"}
            </p>
          </div>
          <Button
            size="sm"
            variant={allGranted ? "outline" : "default"}
            onClick={() => setShowDialog(true)}
            disabled={loading}
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Shield className="size-4" />}
            <span className="hidden sm:inline">{allGranted ? "إدارة" : "منح الصلاحيات"}</span>
          </Button>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="size-5 text-emerald-glow" />
              صلاحيات التطبيق
            </DialogTitle>
            <DialogDescription>
              يحتاج التطبيق إلى هذه الصلاحيات ليعمل بكامل ميزاته على جهازك
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[50vh]">
            <div className="flex flex-col gap-2">
              {!checked && loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                permissions.map((perm) => {
                  const Icon = PERMISSION_ICONS[perm.name] || Shield;
                  return (
                    <div
                      key={perm.name}
                      className="flex items-center gap-3 rounded-lg border p-3"
                    >
                      <div
                        className={`flex size-9 items-center justify-center rounded-lg shrink-0 ${
                          perm.granted
                            ? "bg-emerald-500/15 text-emerald-500"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <Icon className="size-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{perm.label}</div>
                      </div>
                      {perm.granted ? (
                        <Check className="size-4 text-emerald-500" />
                      ) : (
                        <X className="size-4 text-muted-foreground" />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              إغلاق
            </Button>
            <Button onClick={handleRequestAll} disabled={loading}>
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Shield className="size-4" />
              )}
              طلب جميع الصلاحيات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
