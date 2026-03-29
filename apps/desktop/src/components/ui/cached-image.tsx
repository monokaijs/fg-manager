import { useState, useEffect } from 'react';

export interface CachedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  fallback?: string;
}

export function CachedImage({ src, alt, className, fallback, ...props }: CachedImageProps) {
  const [imgSrc, setImgSrc] = useState<string | undefined>(src);
  const [error, setError] = useState(false);

  useEffect(() => {
    setImgSrc(src);
    setError(false);
  }, [src]);

  if (!imgSrc && fallback) {
    return <img src={fallback} alt={alt} className={className} {...props} />;
  }

  if (!imgSrc && !fallback) {
    return <div className={`bg-muted flex items-center justify-center text-xs text-muted-foreground ${className}`}>No Image</div>;
  }

  return (
    <img 
      src={error && fallback ? fallback : imgSrc} 
      alt={alt} 
      className={className} 
      onError={() => {
        if (!error) {
          setError(true);
          if (!fallback) {
             setImgSrc(undefined);
          }
        }
      }}
      {...props} 
    />
  );
}
