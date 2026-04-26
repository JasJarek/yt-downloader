export interface VideoFormat {
  format_id: string;
  height: number | null;
  fps: number | null;
  label: string;
}

export interface VideoMetadata {
  title: string;
  duration: number;
  thumbnail: string;
  uploader: string;
  upload_date: string;
  formats: VideoFormat[];
}

export type DownloadFormat = 'mp4' | 'mp3';
export type Mp3Bitrate = '128' | '192' | '320';
export type DownloadStatus = 'pending' | 'downloading' | 'converting' | 'completed' | 'failed' | 'cancelled';

export interface DownloadJob {
  id: string;
  url: string;
  title: string;
  thumbnail: string;
  format: DownloadFormat;
  quality: string;
  outputDir: string;
  status: DownloadStatus;
  percent: number;
  speed: string;
  eta: string;
  stage: string;
  createdAt: string;
}

export interface DownloadProgress {
  id: string;
  percent: number;
  speed: string;
  eta: string;
  stage: string;
}

export interface DownloadFinished {
  id: string;
  status: 'completed' | 'failed';
}

export interface AppSettings {
  defaultOutputDir: string;
  defaultVideoQuality: string;
  defaultMp3Bitrate: Mp3Bitrate;
  maxParallelDownloads: number;
  language: 'pl' | 'en';
  acceptedTerms: boolean;
}

export interface DownloadRecord {
  id: string;
  title: string;
  url: string;
  format: string;
  quality: string;
  file_path: string;
  status: string;
  created_at: string;
}
