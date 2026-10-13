/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getTowns } from '@/lib/reportAction';
import { restrictedRoute } from '@/lib/auth';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { Building, FileText, Pencil, Plus, Search, Trash2, Settings } from 'lucide-react';

type Town = {
  towncode: string;
  town: string;
};

type MeterReader = {
  id: string;
  fullName: string;
  towncode?:{}
  town?: {
    id: number;
    towncode: string;
    town: string;
  } | null;
};

type RouteAccountabilityRow = {
  id: number;
  book_code: string;
  name?: string | null;
  accountable_town_code: string;
  is_bapa: boolean;
  meter_reader_id: string;
  meter_readers?: {
    id: string;
    fullName: string;
  } | null;
  towncode?: {
    towncode: string;
    town: string;
  } | null;
};

type SearchField = 'book_code' | 'book_name';
const METER_READER_NONE = '__NONE__';

export default function RouteAccountabilityMaintenancePage() {
  const pathname = usePathname();

  const [towns, setTowns] = useState<Town[]>([]);
  const [meterReaders, setMeterReaders] = useState<MeterReader[]>([]);

  const [rows, setRows] = useState<RouteAccountabilityRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filters
  const [searchText, setSearchText] = useState('');
  const [searchField, setSearchField] = useState<SearchField>('book_code');
  const [filterTownCode, setFilterTownCode] = useState<string>('ALL');
  const [filterIsBapa, setFilterIsBapa] = useState<string>('ALL');
  const [filterMeterReaderId, setFilterMeterReaderId] = useState<string>('ALL');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editRow, setEditRow] = useState<RouteAccountabilityRow | null>(null);
  const [formBookCode, setFormBookCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formTownCode, setFormTownCode] = useState('');
  const [formMeterReaderId, setFormMeterReaderId] = useState('');
  const [formIsBapa, setFormIsBapa] = useState(false);

  useEffect(() => {
    const initialize = async () => {
      // Restrict route access (same pattern as DCP-lock)
      const cleanPath = pathname.startsWith('/') ? pathname.slice(1) : pathname;
      await restrictedRoute(cleanPath);

      try {
        const townsData = await getTowns();
        setTowns(townsData || []);
      } catch (e) {
        console.error('Error fetching towns:', e);
      }

      try {
        // use non-paginated list for dropdowns
        const res = await fetch('/api/meter-readers?page=1&pageSize=100');
        const data = await res.json();
        if (res.ok && data?.success) setMeterReaders(data?.data || []);
      } catch (e) {
        console.error('Error fetching meter readers:', e);
      }

      // Auto-populate table on first load
      fetchRows({ page: 1 });
    };

    initialize();
  }, [pathname]);

  const townOptions = useMemo(() => {
    const filtered = (towns || []).filter((t) => t.towncode !== '01' && t.towncode !== '00' && (t.town || '').toLowerCase() !== 'main');
    const sorted = [...filtered].sort((a, b) => (a.towncode || '').localeCompare(b.towncode || ''));
    return sorted;
  }, [towns]);

  const getTownName = (townCode: string) => {
    const found = towns.find((t) => t.towncode === townCode);
    return found?.town ?? townCode;
  };

  const openAddModal = () => {
    setEditRow(null);
    setFormBookCode('');
    setFormName('');
    setFormTownCode('');
    setFormMeterReaderId('');
    setFormIsBapa(false);
    setError('');
    setSuccess('');
    setIsModalOpen(true);
  };

  const openEditModal = (row: RouteAccountabilityRow) => {
    setEditRow(row);
    setFormBookCode(row.book_code ?? '');
    setFormName((row.name ?? '') as string);
    setFormTownCode(row.accountable_town_code ?? '');
    setFormMeterReaderId(row.meter_reader_id ?? METER_READER_NONE);
    setFormIsBapa(Boolean(row.is_bapa));
    setError('');
    setSuccess('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (isSaving) return;
    setIsModalOpen(false);
  };

  const fetchRows = async (opts?: { page?: number; pageSize?: number }) => {
    setIsLoading(true);
    setError('');
    setSuccess('');
    try {
      const targetPage = opts?.page ?? page;
      const targetPageSize = opts?.pageSize ?? pageSize;
      const params = new URLSearchParams();
      if (searchText.trim()) params.set('search', searchText.trim());
      params.set('searchField', searchField);
      if (filterTownCode && filterTownCode !== 'ALL') params.set('townCode', filterTownCode);
      if (filterIsBapa !== 'ALL') params.set('isBapa', filterIsBapa === 'YES' ? 'true' : 'false');
      if (filterMeterReaderId !== 'ALL') params.set('meterReaderId', filterMeterReaderId);
      params.set('page', String(targetPage));
      params.set('pageSize', String(targetPageSize));

      const res = await fetch(`/api/route-accountability?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || !data?.success) {
        setError(data?.error || 'Failed to fetch route accountability');
        setRows([]);
        setTotal(0);
        return;
      }

      setRows(data?.data || []);
      setTotal(Number(data?.total ?? 0));
      setPage(Number(data?.page ?? targetPage));
      setPageSize(Number(data?.pageSize ?? targetPageSize));
      setSuccess(`Found ${Number(data?.total ?? 0)} record(s)`);
    } catch (e) {
      console.error(e);
      setError('An error occurred while fetching records');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    const book_code = formBookCode.trim();
    const accountable_town_code = formTownCode.trim();
    const name = formName.trim();
    const meter_reader_id = formMeterReaderId === METER_READER_NONE ? null : formMeterReaderId.trim();

    if (!book_code) {
      setError('Book code is required');
      return;
    }
    if (!name) {
      setError('Book name is required');
      return;
    }
    if (!accountable_town_code) {
      setError('Accountable town is required');
      return;
    }
    // meter_reader_id is optional; allow clearing it to null

    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      const url = editRow ? `/api/route-accountability/${editRow.id}` : '/api/route-accountability';
      const method = editRow ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book_code,
          name,
          accountable_town_code,
          meter_reader_id,
          is_bapa: formIsBapa,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.success) {
        setError(data?.error || 'Failed to save record');
        return;
      }

      setSuccess(editRow ? 'Record updated successfully' : 'Record added successfully');
      setIsModalOpen(false);
      await fetchRows({ page: 1 });
    } catch (e) {
      console.error(e);
      setError('An error occurred while saving record');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (row: RouteAccountabilityRow) => {
    if (!confirm('Are you sure you want to delete this record?')) return;

    setIsDeleting(row.id);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`/api/route-accountability/${row.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        setError(data?.error || 'Failed to delete record');
        return;
      }
      setSuccess('Record deleted successfully');
      // Re-fetch current page; if it becomes empty, step back one page.
      const remainingOnPage = rows.length - 1;
      const nextPage = remainingOnPage <= 0 ? Math.max(1, page - 1) : page;
      await fetchRows({ page: nextPage });
    } catch (e) {
      console.error(e);
      setError('An error occurred while deleting record');
    } finally {
      setIsDeleting(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil((total || 0) / pageSize));
  const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(total, page * pageSize);

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
              <Settings className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Route Accountability Maintenance</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Manage book/route accountability per town
              </p>
            </div>
          </div>

          <Button onClick={openAddModal} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50">
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add
            </div>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6 shadow-md border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3 text-lg">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Search className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            Search Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
            {/* Search Text */}
            <div className="space-y-2 md:col-span-2">
              <Label className="text-sm font-medium">Search</Label>
              <Input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Type to search..."
                className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') fetchRows({ page: 1 });
                }}
              />
            </div>

            {/* Search Field */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Search By</Label>
              <Select value={searchField} onValueChange={(v) => setSearchField(v as SearchField)}>
                <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                  <SelectValue placeholder="Select field" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="book_code">Book Code</SelectItem>
                  <SelectItem value="book_name">Book Name</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Town Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Building className="w-4 h-4 text-gray-500" />
                Filter Town
              </Label>
              <Select value={filterTownCode} onValueChange={setFilterTownCode}>
                <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                  <SelectValue placeholder="All towns" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  {townOptions.map((town) => (
                    <SelectItem key={town.towncode} value={town.towncode}>
                      {town.towncode} - {town.town}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Is BAPA Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Is BAPA</Label>
              <Select value={filterIsBapa} onValueChange={setFilterIsBapa}>
                <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  <SelectItem value="YES">Yes</SelectItem>
                  <SelectItem value="NO">No</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Meter Reader Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Meter Reader</Label>
              <Select value={filterMeterReaderId} onValueChange={setFilterMeterReaderId}>
                <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  {meterReaders.map((mr) => (
                    <SelectItem key={mr.id} value={mr.id}>
                      ({mr.town?.towncode}) - {mr.fullName || mr.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Search Button */}
            <div className="flex items-end md:col-span-6">
              <Button
                onClick={() => fetchRows({ page: 1 })}
                disabled={isLoading}
                variant="styled"
                className="w-full h-11"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Loading...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4" />
                    Search
                  </div>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error/Success */}
      {error && (
        <Alert className="mb-4 border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800">
          <AlertDescription className="text-red-800 dark:text-red-400">{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="mb-4 border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800">
          <AlertDescription className="text-green-800 dark:text-green-400">{success}</AlertDescription>
        </Alert>
      )}

      {/* Table */}
      {rows.length > 0 ? (
        <Card className="shadow-lg border-0 bg-white dark:bg-gray-800">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <CardTitle className="flex items-center gap-3 text-lg">
                <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                  <FileText className="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
                Route Accountability
                <span className="text-sm font-normal text-gray-500 dark:text-gray-400">({rows.length} entries)</span>
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600">
                      No.
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600">
                      Book Code
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600">
                      Book Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600">
                      Meter Reader
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600">
                      Accountable Town
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600">
                      BAPA
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {rows.map((row, idx) => (
                    <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{idx + 1}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{row.book_code}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{row.name || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{row.meter_readers?.fullName || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {row.towncode?.town ? `${row.accountable_town_code} - ${row.towncode.town}` : getTownName(row.accountable_town_code)}
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-900 dark:text-gray-100">
                        {row.is_bapa ? 'Yes' : 'No'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            onClick={() => openEditModal(row)}
                            disabled={isDeleting === row.id}
                            variant="outline"
                            size="sm"
                            className="border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/20 disabled:opacity-50"
                          >
                            <div className="flex items-center gap-2">
                              <Pencil className="w-4 h-4" />
                              Update
                            </div>
                          </Button>
                          <Button
                            onClick={() => handleDelete(row)}
                            disabled={isDeleting === row.id}
                            variant="outline"
                            size="sm"
                            className="border-red-200 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20 disabled:opacity-50"
                          >
                            <div className="flex items-center gap-2">
                              <Trash2 className="w-4 h-4" />
                              {isDeleting === row.id ? 'Deleting...' : 'Delete'}
                            </div>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="text-sm text-gray-600 dark:text-gray-300">
                Showing <span className="font-medium">{showingFrom}</span>–<span className="font-medium">{showingTo}</span> of{' '}
                <span className="font-medium">{total}</span>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 dark:text-gray-300">Rows</span>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(v) => {
                      const nextSize = Number(v);
                      setPageSize(nextSize);
                      fetchRows({ page: 1, pageSize: nextSize });
                    }}
                  >
                    <SelectTrigger size="small" className="w-[90px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isLoading || page <= 1}
                    onClick={() => fetchRows({ page: Math.max(1, page - 1) })}
                  >
                    Prev
                  </Button>
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    Page <span className="font-medium">{page}</span> / <span className="font-medium">{totalPages}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isLoading || page >= totalPages}
                    onClick={() => fetchRows({ page: Math.min(totalPages, page + 1) })}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        !isLoading &&
        !error && (
          <Card className="shadow-md border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <CardContent className="py-12">
              <div className="text-center">
                <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                  <FileText className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Records</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Use the filters above then click Search.</p>
              </div>
            </CardContent>
          </Card>
        )
      )}

      {/* Add/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editRow ? (
                <>
                  <Pencil className="w-5 h-5" />
                  Update Record
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  Add Record
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Book Code</Label>
              <Input
                value={formBookCode}
                onChange={(e) => setFormBookCode(e.target.value.toUpperCase())}
                placeholder="e.g. 0001"
                maxLength={4}
                disabled={isSaving}
              />
            </div>

            <div className="grid gap-2">
              <Label>Book Name</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Book name"
                disabled={isSaving}
              />
            </div>

            <div className="grid gap-2">
              <Label>Accountable Town</Label>
              <Select value={formTownCode} onValueChange={setFormTownCode}>
                <SelectTrigger className="border-gray-300 focus:border-blue-500 focus:ring-blue-500" disabled={isSaving}>
                  <SelectValue placeholder="Select town" />
                </SelectTrigger>
                <SelectContent>
                  {townOptions.map((town) => (
                    <SelectItem key={town.towncode} value={town.towncode}>
                      {town.towncode} - {town.town}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Meter Reader</Label>
              <Select value={formMeterReaderId} onValueChange={setFormMeterReaderId}>
                <SelectTrigger className="border-gray-300 focus:border-blue-500 focus:ring-blue-500" disabled={isSaving}>
                  <SelectValue placeholder="Select meter reader" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={METER_READER_NONE}>— None (Remove) —</SelectItem>
                  {meterReaders.map((mr) => (
                    <SelectItem key={mr.id} value={mr.id}>
                      {mr.fullName || mr.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Checkbox
                checked={formIsBapa}
                onCheckedChange={(v) => setFormIsBapa(Boolean(v))}
                disabled={isSaving}
                id="is_bapa"
              />
              <Label htmlFor="is_bapa" className="cursor-pointer">
                Is BAPA
              </Label>
            </div>
          </div>

          {error && (
            <Alert className="mt-2 border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800">
              <AlertDescription className="text-red-800 dark:text-red-400">{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={closeModal} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white">
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


