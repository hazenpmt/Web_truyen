import type { CSSProperties, ReactNode } from "react";
import type { AvatarFrameReward } from "../../types";
import { getAvatarFrameClass, getAvatarFrameStyle } from "../../utils/helpers";

export function AvatarFrameBox({
  frame,
  className = "",
  style,
  children
}: {
  frame: AvatarFrameReward;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  return (
    <span className={`${className} reader-avatar-frame ${getAvatarFrameClass(frame)}`.trim()} style={{ ...(getAvatarFrameStyle(frame) || {}), ...(style || {}) }}>
      {children}
      {frame.video && (
        <video
          className="avatar-frame-video"
          src={frame.video}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
        />
      )}
    </span>
  );
}
