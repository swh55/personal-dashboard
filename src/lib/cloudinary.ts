// =============================================================================
// Cloudinary server-side helper.
// =============================================================================
// ALL functions in this file are SERVER-ONLY. They read
// CLOUDINARY_API_SECRET from the environment — never expose it to the client.
//
// Client flow for uploading an image:
//   1. Client calls GET /api/upload/sign?folder=avatars
//      → receives { signature, timestamp, apiKey, cloudName, folder }
//   2. Client POSTs the file directly to
//      https://api.cloudinary.com/v1_1/<cloudName>/auto/upload
//      with FormData: file, signature, timestamp, api_key, folder
//   3. Cloudinary responds with { secure_url, public_id, ... }
//   4. Client stores secure_url in the relevant record (e.g. contact.avatar).
//
// This "signed upload" pattern keeps the API secret server-side while letting
// the browser upload directly to Cloudinary (no file touches our server).

import { v2 as cloudinary } from "cloudinary";

let configured = false;

function ensureConfigured() {
  if (configured) return;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  configured = true;
}

export interface UploadSignature {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
  resourceType: string;
}

/**
 * Generate a signed upload signature for client-direct uploads.
 * The signature is bound to (timestamp, folder, resourceType) and is valid
 * for ~1 hour. The client must use the same values when posting to
 * Cloudinary.
 */
export function signUpload(params: {
  folder?: string;
  resourceType?: "image" | "raw" | "video";
  maxFileSize?: number; // bytes
  allowedFormats?: string[];
}): UploadSignature {
  ensureConfigured();
  const folder = params.folder || "dashboard";
  const resourceType = params.resourceType || "image";
  const timestamp = Math.floor(Date.now() / 1000);

  // Optional upload preset options encoded into the signature
  const signParams: Record<string, unknown> = {
    timestamp,
    folder,
    resource_type: resourceType,
  };
  if (params.allowedFormats) {
    signParams.allowed_formats = params.allowedFormats.join(",");
  }

  const signature = cloudinary.utils.api_sign_request(
    signParams as any,
    process.env.CLOUDINARY_API_SECRET as string
  );

  return {
    signature,
    timestamp,
    apiKey: process.env.CLOUDINARY_API_KEY as string,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME as string,
    folder,
    resourceType,
  };
}

/**
 * Delete a Cloudinary asset by public_id. Server-only. Used when a user
 * deletes a record that had an uploaded image, so we don't leak orphan
 * files in their Cloudinary account.
 */
export async function deleteAsset(publicId: string): Promise<void> {
  ensureConfigured();
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error("[cloudinary] deleteAsset failed:", err);
  }
}

/**
 * Whether Cloudinary is configured (all 3 env vars present).
 * Used by the /api/upload route to return a clear error if not.
 */
export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}
