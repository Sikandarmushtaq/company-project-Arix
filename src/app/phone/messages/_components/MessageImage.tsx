'use client';

import React, { useState, useEffect } from 'react';
import { FiImage, FiDownload } from 'react-icons/fi';
import { isTwilioUrl, getAuthToken } from './utils';

interface MessageImageProps {
  url: string;
  index: number;
  onImageClick?: (url: string) => void;
  onDownload: (e: React.MouseEvent, url: string) => void;
}

/**
 * Single image with error handling
 * Handles Twilio URLs by fetching via authenticated proxy
 */
export const MessageImage = React.memo(function MessageImage({
  url,
  index,
  onImageClick,
  onDownload,
}: MessageImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  // Fetch Twilio URLs via authenticated proxy
  useEffect(() => {
    if (!isTwilioUrl(url)) {
      setBlobUrl(null);
      return;
    }

    let mounted = true;
    setIsLoading(true);
    setHasError(false);

    const fetchTwilioMedia = async () => {
      try {
        const token = getAuthToken();
        if (!token) {
          throw new Error('No auth token');
        }

        const encodedUrl = btoa(url);
        const proxyUrl = `/api/proxy/media/proxy?url=${encodeURIComponent(encodedUrl)}`;

        const response = await fetch(proxyUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const blob = await response.blob();
        if (mounted) {
          const objectUrl = URL.createObjectURL(blob);
          setBlobUrl(objectUrl);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Failed to fetch Twilio media:', err);
        if (mounted) {
          setHasError(true);
          setIsLoading(false);
        }
      }
    };

    fetchTwilioMedia();

    return () => {
      mounted = false;
      // blobUrl cleanup is handled by the separate useEffect below
    };
  }, [url]);

  // Clean up blob URL when component unmounts
  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center p-4 bg-[var(--muted)] text-[var(--muted-foreground)] w-full aspect-square max-h-64">
        <FiImage className="w-8 h-8 mb-2" aria-hidden="true" />
        <span className="text-xs">Image unavailable</span>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-4 bg-[var(--muted)] text-[var(--muted-foreground)] w-full aspect-square max-h-64">
        <div className="w-6 h-6 border-2 border-[var(--border)] border-t-transparent rounded-full animate-spin mb-2" />
        <span className="text-xs">Loading...</span>
      </div>
    );
  }

  const displayUrl = blobUrl || url;

  return (
    <div className="relative group">
      {/* eslint-disable-next-line @next/next/no-img-element -- Dynamic external URLs from Twilio require native img */}
      <img
        src={displayUrl}
        alt={`Attachment ${index + 1}`}
        className="w-full max-h-64 object-cover cursor-pointer hover:opacity-90 transition-opacity block"
        onClick={() => onImageClick?.(displayUrl)}
        onError={() => setHasError(true)}
        loading="lazy"
      />
      <button
        type="button"
        className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
        onClick={(e) => onDownload(e, displayUrl)}
        aria-label="Download image"
      >
        <FiDownload className="w-4 h-4" />
      </button>
    </div>
  );
});

export default MessageImage;
