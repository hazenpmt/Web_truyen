import type { CSSProperties, ReactNode, MouseEvent } from "react";
import { navigate } from "../../utils/routing";

export function IconButton({
  active,
  icon,
  label,
  onClick,
  className
}: {
  active?: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button className={`${active ? "active" : ""} ${className || ""}`.trim()} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

export function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

export function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="meta-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function Notice({ tone, message }: { tone: "error" | "success"; message: string }) {
  return <div className={`notice ${tone}`}>{message}</div>;
}

export function PaginationControls({
  page,
  totalPages,
  totalItems,
  onPageChange
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1 && totalItems <= 0) return null;

  const getPages = (): (number | "...")[] => {
    const delta = 2;
    const range: number[] = [];
    const result: (number | "...")[] = [];
    for (let i = Math.max(2, page - delta); i <= Math.min(totalPages - 1, page + delta); i++) {
      range.push(i);
    }
    if (page - delta > 2) result.push(1, "...");
    else result.push(1);
    result.push(...range);
    if (page + delta < totalPages - 1) result.push("...", totalPages);
    else if (totalPages > 1) result.push(totalPages);
    return result;
  };

  const pages = getPages();

  return (
    <div className="pager-dots">
      <button
        className="pager-dot pager-nav"
        disabled={page <= 1}
        onClick={() => onPageChange(1)}
        title="Trang đầu"
      >
        «
      </button>
      <button
        className="pager-dot pager-nav"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        title="Trang trước"
      >
        ⬹
      </button>

      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`ellipsis-${i}`} className="pager-ellipsis">⬦</span>
        ) : (
          <button
            key={p}
            className={`pager-dot${p === page ? " pager-dot-active" : ""}`}
            onClick={() => onPageChange(p as number)}
          >
            {p}
          </button>
        )
      )}

      <button
        className="pager-dot pager-nav"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        title="Trang sau"
      >
        ⬺
      </button>
      <button
        className="pager-dot pager-nav"
        disabled={page >= totalPages}
        onClick={() => onPageChange(totalPages)}
        title="Trang cuối"
      >
        »
      </button>
    </div>
  );
}

export function Link({
  href,
  className,
  style,
  children,
  onClick,
  title,
  ariaLabel
}: {
  href: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
  title?: string;
  ariaLabel?: string;
}) {
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      e.preventDefault();
      if (onClick) {
        onClick(e);
      }
      navigate(href);
    }
  };

  return (
    <a
      href={href.startsWith("#") ? href : `#${href}`}
      className={className}
      style={{ textDecoration: "none", color: "inherit", cursor: "pointer", ...style }}
      onClick={handleClick}
      title={title}
      aria-label={ariaLabel}
    >
      {children}
    </a>
  );
}
