'use client';

import React from 'react';
import { FiImage, FiVideo, FiMic, FiFile, FiMapPin } from 'react-icons/fi';

export function MessageTypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'image':
      return <FiImage className="w-3 h-3 text-blue-400" />;
    case 'video':
      return <FiVideo className="w-3 h-3 text-purple-400" />;
    case 'audio':
      return <FiMic className="w-3 h-3 text-green-400" />;
    case 'document':
      return <FiFile className="w-3 h-3 text-amber-400" />;
    case 'location':
      return <FiMapPin className="w-3 h-3 text-red-400" />;
    case 'sticker':
      return <span className="text-xs">🏷️</span>;
    case 'contacts':
      return <span className="text-xs">👤</span>;
    default:
      return null;
  }
}
