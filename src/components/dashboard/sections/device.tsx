"use client";

import * as React from "react";
import {
  Smartphone,
  Battery,
  BatteryCharging,
  MapPin,
  Wifi,
  WifiOff,
  HardDrive,
  Download,
  Upload,
  RefreshCw,
  Vibrate,
  Camera,
  Image as ImageIcon,
  Share2,
  Trash2,
  FileText,
  Loader2,
  Activity,
  Globe,
} from "lucide-react";
import {
  isNative,
  getDeviceInfo,
  getCurrentLocation,
  getNetworkStatus,
  onNetworkChange,
  listFiles,
  readFile,
  deleteFile,
  exportBackup,
  hapticLight,
  hapticMedium,
  hapticHeavy,
  hapticSuccess,
  hapticError,
  takePhoto,
  pickImage,
  share,
  startAccelerometer,
  stopAccelerometer,
  type DeviceInfo,
  type LocationData,
  type NetworkStatus,
  type SensorData,
  type PhotoResult,
} from "@/lib/native/bridge";
import { db } from "@/lib/local/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/lib/api";

export function DeviceSection() {
  const [deviceInfo, setDeviceInfo] = React.useState<DeviceInfo | null>(null);
  const [location, setLocation] = React.useState<LocationData | null>(null);
  const [network, setNetwork] = React.useState<NetworkStatus | null>(null);
  const [files, setFiles] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [locLoading, setLocLoading] = React.useState(false);
  const [sensorData, setSensorData] = React.useState<SensorData | null>(null);
  const [sensorActive, setSensorActive] = React.useState(false);
  const [photo, setPhoto] = React.useState<PhotoResult | null>(null);

  const refreshAll = React.useCallback(async () => {
    setLoading(true);
    try {
      const [info, net, fls] = await Promise.all([
        getDeviceInfo(),
        getNetworkStatus(),
        isNative() ? listFiles() : Promise.resolve([]),
      ]);
      setDeviceInfo(info);
      setNetwork(net);
      setFiles(fls);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refreshAll();
    // Listen for network changes
    const unsubscribe = onNetworkChange((status) => setNetwork(status));
    return () => {
      unsubscribe();
      stopAccelerometer();
    };
  }, [refreshAll]);

  const handleGetLocation = async () => {
    setLocLoading(true);
    try {
      const loc = await getCurrentLocation();
      setLocation(loc);
      if (loc) toast.success("تم الحصول على الموقع");
      else toast.error("تعذر الحصول على الموقع");
    } finally {
      setLocLoading(false);
    }
  };

  const handleExportBackup = async () => {
    try {
      const data = db.exportDB();
      const uri = await exportBackup(data);
      if (uri) toast.success("تم تصدير النسخة الاحتياطية");
      else toast.error("فشل التصدير");
      setFiles(await listFiles());
    } catch {
      toast.error("فشل التصدير");
    }
  };

  const handleImportBackup = async (filename: string) => {
    try {
      const content = await readFile(filename);
      if (content) {
        const parsed = JSON.parse(content);
        db.importDB(parsed);
        toast.success("تم استيراد النسخة الاحتياطية");
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch {
      toast.error("فشل الاستيراد");
    }
  };

  const handleDeleteFile = async (filename: string) => {
    const { deleteFile } = await import("@/lib/native/bridge");
    const ok = await deleteFile(filename);
    if (ok) {
      toast.success("تم حذف الملف");
      setFiles(await listFiles());
    }
  };

  const handleTakePhoto = async () => {
    const result = await takePhoto();
    if (result) {
      setPhoto(result);
      toast.success("تم التقاط الصورة");
    }
  };

  const handlePickImage = async () => {
    const result = await pickImage();
    if (result) {
      setPhoto(result);
      toast.success("تم اختيار الصورة");
    }
  };

  const toggleSensor = async () => {
    if (sensorActive) {
      await stopAccelerometer();
      setSensorActive(false);
      setSensorData(null);
    } else {
      await startAccelerometer((data) => setSensorData(data));
      setSensorActive(true);
    }
  };

  const handleShare = async () => {
    await share("لوحة التحكم الشخصية", "تطبيق إدارة الأعمال الشخصية");
  };

  return (
    <div className="flex h-full flex-col gap-4">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">الجهاز</h1>
          <p className="text-sm text-muted-foreground">
            معلومات الجهاز، الحساسات، النسخ الاحتياطي، والميزات الأصلية
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refreshAll} disabled={loading}>
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          تحديث
        </Button>
      </div>

      {!isNative() && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 text-sm text-amber-700 dark:text-amber-400">
            هذه الميزة تعمل فقط في تطبيق أندرويد. في المتصفح، بعض الوظائف قد تكون محدودة.
          </CardContent>
        </Card>
      )}

      <ScrollArea className="custom-scroll flex-1 -mx-1 px-1">
        <div className="flex flex-col gap-4 pb-4">
          {/* Device Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Smartphone className="size-4 text-emerald-glow" />
                معلومات الجهاز
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-24 w-full" />
              ) : deviceInfo ? (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <InfoRow label="الشركة المصنّعة" value={deviceInfo.manufacturer} />
                  <InfoRow label="الموديل" value={deviceInfo.model} />
                  <InfoRow label="نظام التشغيل" value={`Android ${deviceInfo.osVersion}`} />
                  <InfoRow label="اللغة" value={deviceInfo.languageCode} />
                  <InfoRow label="التطبيق" value={deviceInfo.appName || "لوحة التحكم"} />
                  <InfoRow label="الإصدار" value={deviceInfo.appVersion || "1.0"} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">تعذر الحصول على معلومات الجهاز</p>
              )}
            </CardContent>
          </Card>

          {/* Battery */}
          {deviceInfo && (
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`flex size-10 items-center justify-center rounded-xl ${deviceInfo.isCharging ? "bg-emerald-500/15 text-emerald-500" : "bg-muted text-muted-foreground"}`}>
                  {deviceInfo.isCharging ? <BatteryCharging className="size-5" /> : <Battery className="size-5" />}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">
                    البطارية {deviceInfo.batteryLevel >= 0 ? `${Math.round(deviceInfo.batteryLevel * 100)}%` : "غير معروف"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {deviceInfo.isCharging ? "جاري الشحن" : "تعمل بالبطارية"}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Network */}
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`flex size-10 items-center justify-center rounded-xl ${network?.connected ? "bg-emerald-500/15 text-emerald-500" : "bg-rose-500/15 text-rose-500"}`}>
                {network?.connected ? <Wifi className="size-5" /> : <WifiOff className="size-5" />}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">
                  {network?.connected ? "متصل بالإنترنت" : "غير متصل"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {network?.connectionType === "wifi" ? "عبر Wi-Fi" : network?.connectionType === "cellular" ? "عبر بيانات الهاتف" : network?.connectionType || "غير معروف"}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Location */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <MapPin className="size-4 text-emerald-glow" />
                  الموقع الحالي
                </span>
                <Button size="sm" variant="outline" onClick={handleGetLocation} disabled={locLoading}>
                  {locLoading ? <Loader2 className="size-4 animate-spin" /> : <MapPin className="size-4" />}
                  تحديد الموقع
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {location ? (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <InfoRow label="خط العرض" value={location.latitude.toFixed(6)} />
                  <InfoRow label="خط الطول" value={location.longitude.toFixed(6)} />
                  <InfoRow label="الدقة" value={`±${location.accuracy.toFixed(0)}م`} />
                  <InfoRow label="الارتفاع" value={location.altitude ? `${location.altitude.toFixed(0)}م` : "—"} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">اضغط "تحديد الموقع" للحصول على إحداثياتك</p>
              )}
            </CardContent>
          </Card>

          {/* Sensors */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <Activity className="size-4 text-emerald-glow" />
                  حساس الحركة (التسارع)
                </span>
                <Button size="sm" variant={sensorActive ? "destructive" : "default"} onClick={toggleSensor}>
                  {sensorActive ? "إيقاف" : "تشغيل"}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sensorActive && sensorData ? (
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">X</div>
                    <div className="text-lg font-bold text-emerald-glow">{sensorData.x.toFixed(2)}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">Y</div>
                    <div className="text-lg font-bold text-amber-glow">{sensorData.y.toFixed(2)}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">Z</div>
                    <div className="text-lg font-bold text-rose-500">{sensorData.z.toFixed(2)}</div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {sensorActive ? "بانتظار بيانات الحساس..." : "اضغط تشغيل لقراءة بيانات التسارع"}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Haptics */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Vibrate className="size-4 text-emerald-glow" />
                الاهتزاز
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={hapticLight}>
                  <Vibrate className="size-4" />
                  خفيف
                </Button>
                <Button size="sm" variant="outline" onClick={hapticMedium}>
                  <Vibrate className="size-4" />
                  متوسط
                </Button>
                <Button size="sm" variant="outline" onClick={hapticHeavy}>
                  <Vibrate className="size-4" />
                  قوي
                </Button>
                <Button size="sm" variant="outline" onClick={hapticSuccess} className="text-emerald-500">
                  <Vibrate className="size-4" />
                  نجاح
                </Button>
                <Button size="sm" variant="outline" onClick={hapticError} className="text-rose-500">
                  <Vibrate className="size-4" />
                  خطأ
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Camera */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Camera className="size-4 text-emerald-glow" />
                الكاميرا
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-3">
                <Button size="sm" variant="outline" onClick={handleTakePhoto}>
                  <Camera className="size-4" />
                  التقاط صورة
                </Button>
                <Button size="sm" variant="outline" onClick={handlePickImage}>
                  <ImageIcon className="size-4" />
                  اختيار من المعرض
                </Button>
              </div>
              {photo?.base64 && (
                <img
                  src={`data:image/jpeg;base64,${photo.base64}`}
                  alt="captured"
                  className="max-h-48 rounded-lg border"
                />
              )}
            </CardContent>
          </Card>

          {/* Backup / Storage */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <HardDrive className="size-4 text-emerald-glow" />
                النسخ الاحتياطي والتخزين
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-3">
                <Button size="sm" variant="outline" onClick={handleExportBackup}>
                  <Download className="size-4" />
                  تصدير نسخة احتياطية
                </Button>
                <Button size="sm" variant="outline" onClick={handleShare}>
                  <Share2 className="size-4" />
                  مشاركة التطبيق
                </Button>
              </div>
              {files.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <div className="text-xs text-muted-foreground">الملفات المحفوظة ({files.length}):</div>
                  {files.map((f) => (
                    <div key={f} className="flex items-center gap-2 rounded-lg border p-2">
                      <FileText className="size-4 text-muted-foreground shrink-0" />
                      <span className="text-sm flex-1 truncate">{f}</span>
                      <Button size="sm" variant="ghost" className="size-7 p-0" onClick={() => handleImportBackup(f)}>
                        <Upload className="size-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="size-7 p-0 text-destructive" onClick={() => handleDeleteFile(f)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">لا توجد ملفات محفوظة</p>
              )}
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium capitalize">{value}</div>
    </div>
  );
}
