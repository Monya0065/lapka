import Image from 'next/image';

function isLocalAsset(src) {
  return typeof src === 'string' && src.startsWith('/');
}

export default function AppImage({
  src,
  alt,
  className,
  fill = false,
  sizes,
  width = 1200,
  height = 900,
  priority = false,
  ...rest
}) {
  const safeSrc = src || '/assets/photos/pets/cat-generic-photo.jpg';
  const useUnoptimized = !isLocalAsset(safeSrc);

  if (fill) {
    return (
      <Image
        src={safeSrc}
        alt={alt}
        fill
        sizes={sizes || '100vw'}
        className={className}
        priority={priority}
        unoptimized={useUnoptimized}
        {...rest}
      />
    );
  }

  return (
    <Image
      src={safeSrc}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      className={className}
      priority={priority}
      unoptimized={useUnoptimized}
      {...rest}
    />
  );
}
