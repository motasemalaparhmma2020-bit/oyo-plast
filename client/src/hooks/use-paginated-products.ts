import { useQuery } from "@tanstack/react-query";
import { Product } from "@shared/schema";
import { useState, useMemo } from "react";

const ITEMS_PER_PAGE = 12; // Show 12 products per page

export function usePaginatedProducts(
  allProducts: Product[] | undefined,
  itemsPerPage = ITEMS_PER_PAGE
) {
  const [currentPage, setCurrentPage] = useState(1);

  const paginationData = useMemo(() => {
    if (!allProducts) {
      return {
        items: [],
        totalPages: 0,
        currentPage: 1,
        totalItems: 0,
        hasNextPage: false,
        hasPrevPage: false,
      };
    }

    const totalItems = allProducts.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;

    return {
      items: allProducts.slice(startIndex, endIndex),
      totalPages,
      currentPage,
      totalItems,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1,
    };
  }, [allProducts, currentPage, itemsPerPage]);

  const goToPage = (page: number) => {
    const validPage = Math.max(1, Math.min(page, paginationData.totalPages));
    setCurrentPage(validPage);
    // Scroll to top
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const nextPage = () => goToPage(currentPage + 1);
  const prevPage = () => goToPage(currentPage - 1);

  return {
    ...paginationData,
    goToPage,
    nextPage,
    prevPage,
  };
}
