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
  token_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export type PostStatus =
  | "draft"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed";

export interface Post {
  id: string;
  platform: string;
  content: string;
  status: PostStatus;
  scheduled_for: string | null;
  published_at: string | null;
  platform_post_id: string | null;
  error_message: string | null;
  thread_id: string | null;
  thread_order: number | null;
  media_keys: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface PostCreate {
  platform: string;
  content: string;
  scheduled_for?: string | null;
  thread_id?: string | null;
  thread_order?: number | null;
}

export interface PostAnalytics {
  id: string;
  post_id: string;
  fetched_at: string;
  impressions: number;
  likes: number;
  retweets: number;
  replies: number;
  clicks: number;
  profile_visits: number;
}
