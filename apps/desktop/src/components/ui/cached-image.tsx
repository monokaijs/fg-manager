import { useState, useEffect } from 'react';
import { get, set } from 'idb-keyval';
import { invoke } from '@tauri-apps/api/core';

export interface CachedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  fallback?: string;
}

export function CachedImage({ src, alt, className, fallback, ...props }: CachedImageProps) {
  const [imgSrc, setImgSrc] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let objectUrl = '';
    
    async function fetchImage() {
      if (!src) {
        setLoading(false);
        return;
      }
      
      try {
        const cacheKey = `img-cache-${src}`;
        const cachedBlob = await get<Blob>(cacheKey);
        
        if (cachedBlob) {
          objectUrl = URL.createObjectURL(cachedBlob);
          setImgSrc(objectUrl);
          setLoading(false);
          return;
        }
        
        const responseBytes = await invoke<number[]>('native_fetch_bytes', { url: src });
        const blob = new Blob([new Uint8Array(responseBytes)]);
        await set(cacheKey, blob);
        objectUrl = URL.createObjectURL(blob);
        setImgSrc(objectUrl);
      } catch (err) {
        console.warn("Image caching failed, falling back to network:", err);
        setImgSrc(src);
      } finally {
        setLoading(false);
      }
    }
    
    fetchImage();
    
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [src]);

  if (loading) {
    return <div className={`bg-muted animate-pulse ${className}`} />;
  }

  if (!imgSrc && fallback) {
    return <img src={fallback} alt={alt} className={className} {...props} />;
  }

  if (!imgSrc) {
     return <div className={`bg-muted flex items-center justify-center text-xs text-muted-foreground ${className}`}>No Image</div>;
  }

  return <img src={imgSrc} alt={alt} className={className} {...props} />;
}
