export interface GalleryUser {
  id: string;
  email: string;
  displayName: string;
}

export interface GalleryUserSession {
  accessToken: string;
  user: GalleryUser;
}

const USER_TOKEN_KEY = "visionary-user-token";
const USER_PROFILE_KEY = "visionary-user-profile";

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

export function getGalleryUserSession(): GalleryUserSession | null {
  if (!canUseStorage()) {
    return null;
  }

  const accessToken = localStorage.getItem(USER_TOKEN_KEY);
  const userPayload = localStorage.getItem(USER_PROFILE_KEY);

  if (!accessToken || !userPayload) {
    return null;
  }

  try {
    return {
      accessToken,
      user: JSON.parse(userPayload) as GalleryUser
    };
  } catch {
    clearGalleryUserSession();
    return null;
  }
}

export function saveGalleryUserSession(session: GalleryUserSession) {
  if (!canUseStorage()) {
    return;
  }

  localStorage.setItem(USER_TOKEN_KEY, session.accessToken);
  localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(session.user));
}

export function clearGalleryUserSession() {
  if (!canUseStorage()) {
    return;
  }

  localStorage.removeItem(USER_TOKEN_KEY);
  localStorage.removeItem(USER_PROFILE_KEY);
}
