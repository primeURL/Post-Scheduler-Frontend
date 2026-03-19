export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  created_at: string;
}

export interface ConnectedAccount {
  id: string;
  platform: string;
  platform_user_id: string;
  platform_username: string;
  scopes: string | null;
  subscription_type: string | null;
  avatar_url: string | null;
  token_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export type SubscriptionTier = "Basic" | "Premium" | "PremiumPlus";

export type PostStatus =
  | "draft"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed";

export interface Post {
  id: string;
  connected_account_id: string | null;
  platform: string;
  content: string;
  status: PostStatus;
  scheduled_for: string | null;
  published_at: string | null;
  platform_post_id: string | null;
  reposted_at: string | null;
  quote_of_platform_post_id: string | null;
  error_message: string | null;
  thread_id: string | null;
  thread_order: number | null;
  media_keys: string[] | null;
  media: PostMedia[] | null;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PostMedia {
  key: string;
  public_url: string;
  type: string;
  content_type?: string | null;
  file_name?: string | null;
  size?: number | null;
}

export interface PostCreate {
  connected_account_id?: string | null;
  platform: string;
  content: string;
  scheduled_for?: string | null;
  thread_id?: string | null;
  thread_order?: number | null;
  media?: PostMedia[] | null;
}

export interface XConnectResponse {
  authorization_url: string;
}

export interface UploadUrlResponse {
  upload_url: string;
  public_url: string;
  file_key: string;
  content_type: string;
  expires_in: number;
  user_id: string;
}

export interface DownloadUrlResponse {
  download_url: string;
  file_key: string;
  expires_in: number;
}

export interface PostAnalytics {
  id: string;
  post_id: string;
  fetched_at: string;
  impressions: number;
  likes: number;
  retweets: number;
  replies: number;
  quoted_count: number;
  bookmarks: number;
  clicks: number;
  profile_visits: number;
}

export interface PostAnalyticsLatest {
  post_id: string;
  x_post_id: string | null;
  content: string;
  status: string;
  is_deleted: boolean;
  scheduled_for: string | null;
  published_at: string | null;
  fetched_at: string | null;
  impression_count: number;
  like_count: number;
  repost_count: number;
  reply_count: number;
  quoted_count: number;
  bookmarks: number;
  has_repost_action: boolean;
  has_quote_action: boolean;
}
