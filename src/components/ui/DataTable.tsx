import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  ColumnDef,
  SortingState,
  ColumnFiltersState,
  VisibilityState,
  flexRender,
} from '@tanstack/react-table';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Download,
  SlidersHorizontal,
  ChevronRight,
  ChevronLeft,
  ChevronsRight,
  ChevronsLeft,
} from 'lucide-react';
import { cn, exportToCSV } from '../../core/utils';
import { t } from '../../i18n/ar';
import { Button } from './Button';
import { Skeleton } from './Skeleton';
import { EmptyState } from './EmptyState';

export interface DataTableProps<TData extends object = Record<string, unknown>> {
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  exportFilename?: string;
  exportFileName?: string;
  isLoading?: boolean;
  searchPlaceholder?: string;
  enableRowSelection?: boolean;
  onRowSelect?: (selectedRows: TData[]) => void;
  onRowClick?: (row: TData) => void;
  className?: string;
  initialPageSize?: number;
}

const ROW_HEIGHT = 44;
const OVERSCAN = 6;

export function DataTable<TData extends object = Record<string, unknown>>({
  data,
  columns,
  exportFilename,
  exportFileName,
  isLoading = false,
  searchPlaceholder = t('table_search_placeholder'),
  enableRowSelection = true,
  onRowSelect,
  onRowClick,
  className,
  initialPageSize = 10,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [globalFilter, setGlobalFilter] = useState('');
  const [showColMenu, setShowColMenu] = useState(false);

  // Memoized data and columns for high-speed selector efficiency
  const memoizedData = useMemo(() => data, [data]);
  const memoizedColumns = useMemo(() => columns, [columns]);

  // TanStack Table Instance
  const table = useReactTable({
    data: memoizedData,
    columns: memoizedColumns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
    },
    enableRowSelection,
    onRowSelectionChange: (updater) => {
      setRowSelection(updater);
      if (onRowSelect) {
        setTimeout(() => {
          const selected = table.getSelectedRowModel().flatRows.map((r) => r.original);
          onRowSelect(selected);
        }, 0);
      }
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: initialPageSize,
      },
    },
  });

  const handleExportCSV = useCallback(() => {
    const rowsToExport = table.getFilteredRowModel().flatRows.map((r) => r.original);
    exportToCSV(rowsToExport as unknown as Record<string, unknown>[], exportFileName || exportFilename || 'export_data');
  }, [table, exportFileName, exportFilename]);

  const selectedRowsCount = table.getFilteredSelectedRowModel().rows.length;
  const pageRows = table.getRowModel().rows;
  const totalPageRows = pageRows.length;

  // Virtualization window calculation for fast rendering of large page sizes (> 50 items)
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(400);

  const isVirtualized = totalPageRows > 50;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isVirtualized) return;

    const handleScroll = () => {
      setScrollTop(container.scrollTop);
    };

    const handleResize = () => {
      setViewportHeight(container.clientHeight || 400);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [isVirtualized]);

  const startIndex = isVirtualized
    ? Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
    : 0;
  const endIndex = isVirtualized
    ? Math.min(totalPageRows, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN)
    : totalPageRows;

  const paddingTop = isVirtualized ? startIndex * ROW_HEIGHT : 0;
  const paddingBottom = isVirtualized ? (totalPageRows - endIndex) * ROW_HEIGHT : 0;
  const visibleRows = isVirtualized ? pageRows.slice(startIndex, endIndex) : pageRows;

  return (
    <div className={cn('bg-white rounded-[16px] border border-[#E5EAF2] shadow-[0_1px_3px_rgba(15,23,42,0.06)] overflow-hidden flex flex-col', className)}>
      {/* Top Toolbar */}
      <div className="p-4 border-b border-[#E5EAF2] flex flex-wrap items-center justify-between gap-3">
        {/* Global Search with accessible focus ring */}
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="w-4 h-4 text-[#64748B] absolute inset-y-0 start-3 my-auto pointer-events-none" />
          <input
            type="text"
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="w-full bg-[#F4F7FB] border border-[#E5EAF2] rounded-xl text-xs text-[#0F172A] placeholder-[#64748B] ps-9 pe-3 py-2 transition-all focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0FA37F] focus:border-[#0FA37F]"
          />
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {selectedRowsCount > 0 && (
            <span className="text-xs text-[#0FA37F] font-semibold bg-[#0FA37F]/10 px-2.5 py-1 rounded-lg">
              {t('table_selected_count', { count: selectedRowsCount })}
            </span>
          )}

          {/* Column Visibility Toggle */}
          <div className="relative">
            <Button
              variant="secondary"
              size="sm"
              icon={<SlidersHorizontal className="w-3.5 h-3.5" />}
              onClick={() => setShowColMenu(!showColMenu)}
              aria-label={t('table_columns_toggle')}
            >
              {t('table_columns_toggle')}
            </Button>
            {showColMenu && (
              <div className="absolute end-0 mt-2 w-48 bg-white border border-[#E5EAF2] rounded-xl shadow-lg p-2 z-30 text-xs">
                <div className="font-bold text-[#0F172A] pb-1.5 mb-1.5 border-b border-[#E5EAF2]">
                  {t('table_columns_toggle')}
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {table.getAllLeafColumns().map((column) => {
                    if (column.id === 'select') return null;
                    return (
                      <label
                        key={column.id}
                        className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-[#F4F7FB] cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={column.getIsVisible()}
                          onChange={column.getToggleVisibilityHandler()}
                          className="rounded text-[#0FA37F] focus:ring-[#0FA37F]"
                        />
                        <span className="text-[#0F172A] truncate">
                          {typeof column.columnDef.header === 'string'
                            ? column.columnDef.header
                            : column.id}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* CSV Export Button */}
          <Button
            variant="secondary"
            size="sm"
            icon={<Download className="w-3.5 h-3.5" />}
            onClick={handleExportCSV}
            aria-label={t('action_export_csv')}
          >
            {t('action_export_csv')}
          </Button>
        </div>
      </div>

      {/* Table Body Area with Virtualization Container */}
      <div
        ref={containerRef}
        className="overflow-x-auto relative flex-1 min-h-[300px] max-h-[600px] overflow-y-auto focus-visible:ring-1 focus-visible:ring-[#0FA37F]"
        tabIndex={0}
        aria-label="جدول البيانات"
      >
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : totalPageRows === 0 ? (
          <EmptyState
            title={t('table_no_data')}
            description={t('empty_description')}
            className="my-8 border-none bg-transparent"
          />
        ) : (
          <table className="w-full text-start text-xs border-collapse">
            <thead className="bg-[#F4F7FB] sticky top-0 z-10 border-b border-[#E5EAF2]">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const canSort = header.column.getCanSort();
                    const sortDirection = header.column.getIsSorted();

                    return (
                      <th
                        key={header.id}
                        className="py-3 px-4 text-start font-bold text-[#64748B] select-none whitespace-nowrap"
                      >
                        {header.isPlaceholder ? null : (
                          <div
                            tabIndex={canSort ? 0 : undefined}
                            role={canSort ? 'button' : undefined}
                            aria-label={canSort ? `ترتيب حسب ${String(header.column.columnDef.header || header.id)}` : undefined}
                            className={cn(
                              'flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0FA37F] rounded',
                              canSort && 'cursor-pointer hover:text-[#0F172A]'
                            )}
                            onClick={header.column.getToggleSortingHandler()}
                            onKeyDown={(e) => {
                              if (canSort && (e.key === 'Enter' || e.key === ' ')) {
                                e.preventDefault();
                                header.column.toggleSorting();
                              }
                            }}
                          >
                            <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
                            {canSort && (
                              <span className="text-[#64748B]">
                                {sortDirection === 'asc' ? (
                                  <ArrowUp className="w-3.5 h-3.5 text-[#0FA37F]" />
                                ) : sortDirection === 'desc' ? (
                                  <ArrowDown className="w-3.5 h-3.5 text-[#0FA37F]" />
                                ) : (
                                  <ArrowUpDown className="w-3 h-3 opacity-40 hover:opacity-100" />
                                )}
                              </span>
                            )}
                          </div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-[#E5EAF2] text-[#0F172A]">
              {paddingTop > 0 && (
                <tr>
                  <td style={{ height: `${paddingTop}px` }} colSpan={table.getAllLeafColumns().length} />
                </tr>
              )}
              {visibleRows.map((row) => {
                const isSelected = row.getIsSelected();
                return (
                  <tr
                    key={row.id}
                    onClick={() => onRowClick && onRowClick(row.original)}
                    className={cn(
                      'hover:bg-[#F4F7FB]/70 transition-colors',
                      onRowClick && 'cursor-pointer',
                      isSelected && 'bg-[#0FA37F]/5 font-medium'
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="py-3 px-4 text-start whitespace-nowrap">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {paddingBottom > 0 && (
                <tr>
                  <td style={{ height: `${paddingBottom}px` }} colSpan={table.getAllLeafColumns().length} />
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Footer */}
      <div className="p-3 border-t border-[#E5EAF2] bg-[#F4F7FB] flex flex-wrap items-center justify-between gap-3 text-xs text-[#64748B]">
        <div className="flex items-center gap-2">
          <span>{t('table_rows_per_page')}</span>
          <select
            value={table.getState().pagination.pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
            aria-label={t('table_rows_per_page')}
            className="bg-white border border-[#E5EAF2] rounded-lg px-2 py-1 text-xs font-mono text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0FA37F]"
          >
            {[10, 20, 50, 100, 500].map((pageSize) => (
              <option key={pageSize} value={pageSize}>
                {pageSize}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1 font-mono text-xs">
          {t('table_page_of', {
            page: table.getState().pagination.pageIndex + 1,
            total: Math.max(1, table.getPageCount()),
          })}
        </div>

        {/* RTL Navigation controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            className="p-1.5 rounded-lg bg-white border border-[#E5EAF2] disabled:opacity-40 hover:bg-[#E5EAF2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0FA37F] transition-colors"
            title="الصفحة الأولى"
            aria-label="الصفحة الأولى"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="p-1.5 rounded-lg bg-white border border-[#E5EAF2] disabled:opacity-40 hover:bg-[#E5EAF2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0FA37F] transition-colors"
            title="السابق"
            aria-label="السابق"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="p-1.5 rounded-lg bg-white border border-[#E5EAF2] disabled:opacity-40 hover:bg-[#E5EAF2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0FA37F] transition-colors"
            title="التالي"
            aria-label="التالي"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
            className="p-1.5 rounded-lg bg-white border border-[#E5EAF2] disabled:opacity-40 hover:bg-[#E5EAF2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0FA37F] transition-colors"
            title="الصفحة الأخيرة"
            aria-label="الصفحة الأخيرة"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
