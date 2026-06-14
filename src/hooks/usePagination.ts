import { useEffect, useState } from "react";

export function usePagination<T>(items: T[], pageSize: number) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [items.length, totalPages, page]);

  const pageItems = items.slice((page - 1) * pageSize, page * pageSize);

  return { page, setPage, totalPages, pageItems };
}
