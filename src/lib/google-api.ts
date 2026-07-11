// Google API helpers — stubbed for offline/demo usage.
// In production, implement OAuth 2.0 flow and real API calls.

/**
 * Returns a valid access token for the given Google service, or null if not connected.
 * Stub: returns null (no real OAuth flow).
 */
export async function getValidAccessToken(
  service: string
): Promise<string | null> {
  // In production: check DB for refresh token, refresh if expired, return access token.
  // For demo / offline use, we return null so the API informs the user to connect.
  console.log(`[google-api] getValidAccessToken(${service}) — no token (stub)`);
  return null;
}

export interface GoogleContact {
  names?: Array<{ displayName: string }>;
  phoneNumbers?: Array<{ value: string }>;
  emailAddresses?: Array<{ value: string }>;
}

/**
 * Lists Google Contacts. Stub: returns empty array.
 */
export async function listGoogleContacts(
  _accessToken: string,
  _pageSize: number = 200
): Promise<GoogleContact[]> {
  return [];
}

export interface GoogleCalendarEvent {
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  location?: string;
}

/**
 * Lists upcoming Google Calendar events. Stub: returns empty array.
 */
export async function listGoogleCalendarEvents(
  _accessToken: string
): Promise<GoogleCalendarEvent[]> {
  return [];
}

export interface CreateEventInput {
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  location?: string;
}

/**
 * Creates a Google Calendar event. Stub: returns null.
 */
export async function createGoogleCalendarEvent(
  _accessToken: string,
  _input: CreateEventInput
): Promise<string | null> {
  return null;
}

export interface GoogleDriveFile {
  id: string;
  name: string;
  size?: string;
  modifiedTime?: string;
}

/**
 * Uploads a file to Google Drive. Stub: returns null.
 */
export async function uploadToGoogleDrive(
  _accessToken: string,
  _filename: string,
  _content: string,
  _mimeType: string
): Promise<string | null> {
  return null;
}

/**
 * Lists Google Drive files. Stub: returns empty array.
 */
export async function listGoogleDriveFiles(
  _accessToken: string,
  _pageSize: number = 10
): Promise<GoogleDriveFile[]> {
  return [];
}
