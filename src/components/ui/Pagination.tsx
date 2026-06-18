import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
};

export default function Pagination({ page, totalPages, totalItems, pageSize, onPageChange }: Props) {
  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  const pages = buildPageNumbers(page, totalPages);

  return (
    <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-[#94a3b8]">
        Mostrando <strong className="text-[#64748b]">{from}–{to}</strong> de{" "}
        <strong className="text-[#64748b]">{totalItems}</strong> itens
      </p>

      <div className="flex items-center gap-1">
        <PageBtn
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          aria-label="Anterior"
        >
          <ChevronLeft size={15} />
        </PageBtn>

        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`ellipsis-${i}`} className="px-1 text-sm text-[#94a3b8]">
              …
            </span>
          ) : (
            <PageBtn
              key={p}
              onClick={() => onPageChange(p as number)}
              active={p === page}
            >
              {p}
            </PageBtn>
          )
        )}

        <PageBtn
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          aria-label="Próxima"
        >
          <ChevronRight size={15} />
        </PageBtn>
      </div>
    </div>
  );
}

function PageBtn({
  children,
  onClick,
  active,
  disabled,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`flex h-8 min-w-8 items-center justify-center rounded-xl px-2 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
        active
          ? "bg-[#16a34a] text-white shadow-sm shadow-[#16a34a]/40"
          : "bg-white border border-[#e2e8f0] text-[#64748b] hover:bg-[#f8fafc] hover:text-[#0f172a]"
      }`}
    >
      {children}
    </button>
  );
}

function buildPageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | "…")[] = [1];

  if (current > 3) pages.push("…");

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);

  if (current < total - 2) pages.push("…");
  pages.push(total);

  return pages;
}
