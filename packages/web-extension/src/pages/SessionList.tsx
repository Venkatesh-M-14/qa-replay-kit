import { useEffect, useMemo, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import {
  Box,
  Button,
  Checkbox,
  Editable,
  EditableInput,
  EditablePreview,
  Flex,
  IconButton,
  Select,
  Spacer,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useEditableControls,
  useToast,
} from '@chakra-ui/react';
import {
  createColumnHelper,
  useReactTable,
  flexRender,
  getCoreRowModel,
  type SortingState,
  getSortedRowModel,
  type PaginationState,
} from '@tanstack/react-table';
import { VscTriangleDown, VscTriangleUp } from 'react-icons/vsc';
import { FiEdit3 as EditIcon } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import type { eventWithTime } from 'rrweb';
import { type Session, EventName } from '~/types';
import Channel from '~/utils/channel';
import {
  deleteSessions,
  getAllSessions,
  downloadSessions,
  addSession,
  updateSession,
  getEvents,
} from '~/utils/storage';
import { buildReport } from '~/utils/report';
import { getLogServerUrl, saveToLogServer } from '~/utils/logServer';
import { Card, EmptyState, PageHeader } from '~/components/ui';
import {
  FiDownload,
  FiPlayCircle,
  FiTrash2,
  FiUpload,
  FiUploadCloud,
  FiChevronLeft,
  FiChevronRight,
  FiChevronsLeft,
  FiChevronsRight,
} from 'react-icons/fi';

const columnHelper = createColumnHelper<Session>();
const channel = new Channel();

export function SessionList() {
  const navigate = useNavigate();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [saving, setSaving] = useState(false);

  const saveSelectedToLogServer = async (selected: Session[]) => {
    setSaving(true);
    const serverUrl = await getLogServerUrl();
    let saved = 0;
    let issues = 0;
    try {
      for (const session of selected) {
        const events = await getEvents(session.id);
        const result = await saveToLogServer(
          session,
          events,
          buildReport(events),
        );
        saved += 1;
        issues += result.issues;
      }
      toast({
        status: 'success',
        title: `Saved ${saved} session(s) with ${issues} issue(s)`,
        description: `Open ${serverUrl} to see the log and Jira drafts.`,
        duration: 10000,
        isClosable: true,
      });
    } catch (err) {
      toast({
        status: 'error',
        title: `Saved ${saved} of ${selected.length}, then failed`,
        description: `Is the log server running at ${serverUrl}? ${String(
          (err as Error).message,
        )}`,
        duration: 10000,
        isClosable: true,
      });
    } finally {
      setSaving(false);
    }
  };
  const [sorting, setSorting] = useState<SortingState>([
    {
      id: 'createTimestamp',
      desc: true,
    },
  ]);
  const [rowSelection, setRowSelection] = useState({});

  const [{ pageIndex, pageSize }, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const fetchDataOptions = {
    pageIndex,
    pageSize,
  };

  const fetchData = (options: { pageIndex: number; pageSize: number }) => {
    return {
      rows: sessions.slice(
        options.pageIndex * options.pageSize,
        (options.pageIndex + 1) * options.pageSize,
      ),
      pageCount: Math.ceil(sessions.length / options.pageSize),
    };
  };
  const pagination = useMemo(
    () => ({
      pageIndex,
      pageSize,
    }),
    [pageIndex, pageSize],
  );

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            isChecked={table.getIsAllRowsSelected()}
            isIndeterminate={table.getIsSomeRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            isChecked={row.getIsSelected()}
            isIndeterminate={row.getIsSomeSelected()}
            onChange={row.getToggleSelectedHandler()}
          />
        ),
      }),
      columnHelper.accessor((row) => row.name, {
        cell: (info) => {
          const [isHovered, setIsHovered] = useState(false);
          function EditableControls() {
            const { isEditing, getEditButtonProps } = useEditableControls();
            return (
              isHovered &&
              !isEditing && (
                <Box
                  position="absolute"
                  top="0"
                  right="0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <IconButton
                    aria-label="edit name"
                    size="sm"
                    icon={<EditIcon />}
                    variant="ghost"
                    {...getEditButtonProps()}
                  />
                </Box>
              )
            );
          }

          return (
            <Flex
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              alignItems="center"
              position="relative"
            >
              <Editable
                defaultValue={info.getValue()}
                isPreviewFocusable={false}
                onSubmit={(nextValue) => {
                  const newSession = { ...info.row.original, name: nextValue };
                  setSessions(
                    sessions.map((s) =>
                      s.id === newSession.id ? newSession : s,
                    ),
                  );
                  void updateSession(newSession);
                }}
              >
                <EditablePreview cursor="pointer" />
                <EditableControls />
                <EditableInput onClick={(e) => e.stopPropagation()} />
              </Editable>
            </Flex>
          );
        },
        header: 'Name',
      }),
      columnHelper.accessor((row) => row.createTimestamp, {
        id: 'createTimestamp',
        cell: (info) =>
          new Date(info.getValue()).toLocaleString(undefined, {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          }),
        header: 'Recorded',
        sortDescFirst: true,
      }),
      columnHelper.accessor((row) => row.recorderVersion, {
        cell: (info) => info.getValue(),
        header: 'Recorder',
      }),
    ],
    [sessions],
  );
  const table = useReactTable<Session>({
    columns,
    data: fetchData(fetchDataOptions).rows,
    getCoreRowModel: getCoreRowModel(),
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: {
      pagination,
      sorting,
      rowSelection,
    },
    manualPagination: true,
    pageCount: fetchData(fetchDataOptions).pageCount,
  });

  const updateSessions = async () => {
    const sessions = await getAllSessions();
    setSessions(sessions);
  };

  useEffect(() => {
    void updateSessions();
    channel.on(EventName.SessionUpdated, () => {
      void updateSessions();
    });
  }, []);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content) as {
          session: Session;
          events: eventWithTime[];
        };
        const id = nanoid();
        data.session.id = id;
        await addSession(data.session, data.events);
        toast({
          title: 'Session imported',
          description: 'The session was successfully imported.',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        await updateSessions();
      } catch (error) {
        console.error('Error uploading file:', error);
        toast({
          title: 'Error importing session',
          description: (error as Error).message,
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    };
    reader.readAsText(file);
  };

  const selectedCount = Object.keys(rowSelection).length;
  const selectedSessions = () =>
    table.getSelectedRowModel().flatRows.map((row) => row.original);

  return (
    <>
      <PageHeader
        title="Sessions"
        description="Recordings made with this extension. Open one to replay it, or select several to save them to the log server."
        actions={
          <>
            <Button
              variant="outline"
              leftIcon={<FiUpload />}
              onClick={() => fileInputRef.current?.click()}
            >
              Import session
            </Button>
            <input
              type="file"
              accept="application/json"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
          </>
        }
      />

      {selectedCount > 0 && (
        <Card mb={4} px={4} py={2.5} bg="accent.soft" borderColor="accent.soft">
          <Flex align="center" gap={3} wrap="wrap">
            <Text fontWeight={600} color="accent.default">
              {selectedCount} selected
            </Text>
            <Spacer />
            <Button
              colorScheme="brand"
              leftIcon={<FiUploadCloud />}
              isLoading={saving}
              onClick={() => void saveSelectedToLogServer(selectedSessions())}
            >
              Save to log server
            </Button>
            <Button
              variant="outline"
              leftIcon={<FiDownload />}
              onClick={() =>
                void downloadSessions(selectedSessions().map((s) => s.id))
              }
            >
              Download
            </Button>
            <Button
              variant="outline"
              color="danger.fg"
              leftIcon={<FiTrash2 />}
              onClick={() => {
                const ids = selectedSessions().map((s) => s.id);
                if (!ids.length) return;
                if (
                  !confirm(
                    `Delete ${ids.length} session(s)? This cannot be undone.`,
                  )
                )
                  return;
                void deleteSessions(ids).then(() => {
                  setRowSelection({});
                  void updateSessions();
                  channel.emit(EventName.SessionUpdated, {});
                });
              }}
            >
              Delete
            </Button>
          </Flex>
        </Card>
      )}

      <Card>
        {sessions.length === 0 ? (
          <EmptyState
            icon={FiPlayCircle}
            title="No recordings yet"
            hint="Open the app you are testing, click the rrweb icon and press record."
          />
        ) : (
          <TableContainer>
            <Table variant="simple">
              <Thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <Tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <Th
                        key={header.id}
                        onClick={header.column.getToggleSortingHandler()}
                        userSelect="none"
                        cursor={
                          header.column.getCanSort() ? 'pointer' : undefined
                        }
                        w={header.id === 'select' ? '48px' : undefined}
                      >
                        <Flex align="center" gap={1}>
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          {{
                            asc: (
                              <VscTriangleUp aria-label="sorted ascending" />
                            ),
                            desc: (
                              <VscTriangleDown aria-label="sorted descending" />
                            ),
                          }[header.column.getIsSorted() as string] ?? null}
                        </Flex>
                      </Th>
                    ))}
                  </Tr>
                ))}
              </Thead>
              <Tbody>
                {table.getRowModel().rows.map((row) => (
                  <Tr key={row.id} cursor="pointer">
                    {row.getVisibleCells().map((cell, index) => (
                      <Td
                        key={cell.id}
                        color={index > 1 ? 'text.muted' : undefined}
                        fontFamily={index === 3 ? 'mono' : undefined}
                        fontSize={index === 3 ? '12px' : undefined}
                        onClick={() => {
                          if (index !== 0)
                            navigate(`/session/${row.original.id}`);
                        }}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </Td>
                    ))}
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableContainer>
        )}
        {sessions.length > 0 && (
          <Flex
            align="center"
            gap={3}
            px={4}
            py={2.5}
            borderTopWidth="1px"
            borderColor="border.default"
            wrap="wrap"
          >
            <Text color="text.muted" fontSize="13px">
              {sessions.length} session(s) · page{' '}
              {table.getState().pagination.pageIndex + 1} of{' '}
              {Math.max(1, table.getPageCount())}
            </Text>
            <Spacer />
            <Select
              size="sm"
              w="auto"
              borderRadius="6px"
              value={table.getState().pagination.pageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              aria-label="Sessions per page"
            >
              {[10, 20, 30, 40, 50].map((pageSize) => (
                <option key={pageSize} value={pageSize}>
                  {pageSize} per page
                </option>
              ))}
            </Select>
            <Flex gap={1}>
              <IconButton
                size="sm"
                variant="outline"
                aria-label="First page"
                icon={<FiChevronsLeft />}
                onClick={() => table.setPageIndex(0)}
                isDisabled={!table.getCanPreviousPage()}
              />
              <IconButton
                size="sm"
                variant="outline"
                aria-label="Previous page"
                icon={<FiChevronLeft />}
                onClick={() => table.previousPage()}
                isDisabled={!table.getCanPreviousPage()}
              />
              <IconButton
                size="sm"
                variant="outline"
                aria-label="Next page"
                icon={<FiChevronRight />}
                onClick={() => table.nextPage()}
                isDisabled={!table.getCanNextPage()}
              />
              <IconButton
                size="sm"
                variant="outline"
                aria-label="Last page"
                icon={<FiChevronsRight />}
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                isDisabled={!table.getCanNextPage()}
              />
            </Flex>
          </Flex>
        )}
      </Card>
    </>
  );
}
