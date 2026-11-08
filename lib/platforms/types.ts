export interface ProfileInfo {
  externalId: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  profileUrl: string | null;
  followers: number | null;
}

export interface VideoData {
  externalId: string;
  title: string | null;
  thumbnailUrl: string | null;
  url: string | null;
  publishedAt: Date | null;
  durationSec: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
}

export interface FetchResult {
  videos: VideoData[];
  /** true = wir haben ALLE Videos geladen (nicht wegen Seitenlimit abgebrochen) */
  complete: boolean;
}

export interface TokenSet {
  accessToken: string;
  expiresAt: Date | null;
  refreshToken: string | null;
  refreshExpiresAt: Date | null;
}
