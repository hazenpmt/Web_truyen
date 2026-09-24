import type { ImgHTMLAttributes } from "react";

export function OptimizedImage({
  priority = false,
  referrerPolicy = "no-referrer",
  loading,
  decoding,
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) {
  return (
    <img
      {...props}
      loading={loading || (priority ? "eager" : "lazy")}
      decoding={decoding || "async"}
      referrerPolicy={referrerPolicy}
    />
  );
}
