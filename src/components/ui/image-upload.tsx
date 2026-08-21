"use client";

import * as React from "react";
import { Upload, X, Loader2, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageUploadProps {
  value: string | null;
  onChange: (url: string | null) => void;
  folder?: string;
  className?: string;
  placeholder?: string;
  /** Shape of the preview */
  shape?: "circle" | "square";
  /** Aspect ratio for square previews (default 1) */
  aspectRatio?: number;
}

/**
 * ImageUpload — replaces URL input fields with a real file upload.
 *
 * Flow:
 *   1. User selects a file
 *   2. Client requests a signed upload signature from /api/upload/sign
 *   3. Client uploads directly to Cloudinary
 *   4. The returned secure_url is passed to onChange()
 *
 * If Cloudinary is not configured, falls back to base64 data URL in localStorage.
 */
export function ImageUpload({
  value,
  onChange,
  folder = "avatars",
  className,
  placeholder = "اضغط لرفع صورة",
  shape = "circle",
}: ImageUploadProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    if (file.size > 5 * 1024 * 1024) {
      setError("حجم الصورة يجب أن يكون أقل من 5 ميجابايت");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("الملف يجب أن يكون صورة");
      return;
    }

    setUploading(true);
    try {
      // 1. Get signed upload signature from our server
      const signRes = await fetch(`/api/upload/sign?folder=${folder}`);
      if (!signRes.ok) {
        // Cloudinary not configured — fall back to base64 data URL
        const reader = new FileReader();
        reader.onload = () => {
          onChange(reader.result as string);
          setUploading(false);
        };
        reader.readAsDataURL(file);
        return;
      }
      const sign = await signRes.json();

      // 2. Upload directly to Cloudinary via FormData
      const formData = new FormData();
      formData.append("file", file);
      formData.append("signature", sign.signature);
      formData.append("timestamp", String(sign.timestamp));
      formData.append("api_key", sign.apiKey);
      formData.append("folder", sign.folder);

      const uploadRes = await fetch(
        `https://api.cloudinary.com/v1_1/${sign.cloudName}/image/upload`,
        { method: "POST", body: formData }
      );

      if (!uploadRes.ok) {
        throw new Error("فشل رفع الصورة");
      }

      const data = await uploadRes.json();
      if (data.secure_url) {
        onChange(data.secure_url);
      } else {
        throw new Error("لم يتم استلام رابط الصورة");
      }
    } catch (err: any) {
      // Fallback to base64 data URL if Cloudinary fails
      try {
        const reader = new FileReader();
        reader.onload = () => {
          onChange(reader.result as string);
          setUploading(false);
        };
        reader.readAsDataURL(file);
      } catch {
        setError(err.message || "فشل رفع الصورة");
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = ""; // reset for re-selection
        }}
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={cn(
            "flex items-center justify-center overflow-hidden border-2 border-dashed border-border hover:border-emerald-glow/50 transition-colors",
            shape === "circle" ? "size-14 rounded-full" : "size-14 rounded-lg",
            uploading && "opacity-50"
          )}
        >
          {value ? (
            <img src={value} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
          ) : uploading ? (
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          ) : (
            <ImageIcon className="size-5 text-muted-foreground" />
          )}
        </button>
        <div className="flex-1">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="text-xs text-emerald-glow hover:underline disabled:opacity-50"
          >
            {uploading ? "جارٍ الرفع..." : placeholder}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="ms-2 text-xs text-destructive hover:underline"
            >
              إزالة
            </button>
          )}
          {error && <p className="text-xs text-destructive mt-0.5">{error}</p>}
        </div>
      </div>
    </div>
  );
}
