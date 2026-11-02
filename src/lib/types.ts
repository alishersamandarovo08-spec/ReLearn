export type PageType = 'feed' | 'watch' | 'search' | 'notifications' | 'messages' | 'profile';

export interface User {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  subject: string;
  avatar: string | null;
  createdAt: number;
}

export interface Comment {
  id: string;
  userId: string;
  text: string;
  createdAt: number;
}

export interface Post {
  id: string;
  userId: string;
  kind: 'image' | 'video';
  media: Blob | string;
  caption: string;
  subject: string;
  tags: string[];
  createdAt: number;
  aiVerified: boolean;
  likes: string[];
  saves: string[];
  reposts: string[];
  comments: Comment[];
}

export interface Story {
  id: string;
  userId: string;
  kind: 'image' | 'video';
  media: Blob | string;
  createdAt: number;
  viewedBy: string[];
  subject?: string;
  caption?: string;
  ai?: { status: 'approved' | 'rejected' | 'warning'; message: string; confidence?: number };
}

export interface Follow {
  id: string;
  followerId: string;
  followeeId: string;
}

export interface Notification {
  id: string;
  userId: string;
  actorId: string;
  type: 'like' | 'comment' | 'follow' | 'repost';
  postId?: string;
  text: string;
  createdAt: number;
  read: boolean;
}

export interface Message {
  id: string;
  fromId: string;
  toId: string;
  text: string;
  createdAt: number;
  read: boolean;
}

export type PublicUser = User;
