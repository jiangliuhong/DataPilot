"use client";

import { useState, useEffect, useCallback } from "react";
import { Chip, ListBox, Select, Table } from "@heroui/react";
import { fileApi } from "@/web/api-client";
import type { PaginatedResponse, ProjectFile } from "@/web/types/dbt";
import Pagination from "@/web/components/shared/pagination";
import EmptyState from "@/web/components/shared/empty-state";

const FILE_TYPES = [
  { value: "__all__", label: "全部类型" },
  { value: "sql", label: "SQL" },
  { value: "yml", label: "YAML" },
  { value: "py", label: "Python" },
  { value: "md", label: "Markdown" },
  { value: "csv", label: "CSV" },
  { value: "json", label: "JSON" },
  { value: "txt", label: "Text" },
];

interface ProjectFileListProps {
  projectId: number;
  directoryId?: number | null;
}

export default function ProjectFileList({
  projectId,
  directoryId,
}: ProjectFileListProps) {
  const [data, setData] = useState<PaginatedResponse<ProjectFile> | null>(null);
  const [loading, setLoading] = useState(true);
  const [fileType, setFileType] = useState("");
  const [offset, setOffset] = useState(0);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fileApi.list(projectId, {
        limit: 20,
        offset,
        fileType: fileType || undefined,
        directoryId: directoryId ?? undefined,
      });
      setData(result);
    } catch {
      // handled silently
    } finally {
      setLoading(false);
    }
  }, [projectId, offset, fileType, directoryId]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Select
          className="w-[160px]"
          placeholder="全部类型"
          selectedKey={fileType || "__all__"}
          onChange={(key) => {
            const val = key as string;
            const next = val === "__all__" ? "" : val;
            setFileType(next);
            setOffset(0);
          }}
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {FILE_TYPES.map((t) => (
                <ListBox.Item key={t.value} id={t.value} textValue={t.label}>
                  {t.label}
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-default-400">加载中...</div>
      ) : !data?.items.length ? (
        <EmptyState message="暂无文件" />
      ) : (
        <>
          <Table>
            <Table.Content aria-label="文件列表">
              <Table.Header>
                <Table.Column isRowHeader>文件名</Table.Column>
                <Table.Column>路径</Table.Column>
                <Table.Column>类型</Table.Column>
                <Table.Column>大小</Table.Column>
                <Table.Column>更新时间</Table.Column>
              </Table.Header>
              <Table.Body>
                {data.items.map((file) => (
                  <Table.Row key={file.id}>
                    <Table.Cell>
                      <span className="font-medium text-sm">{file.name}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-default-400 text-xs">{file.path}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <Chip size="sm" variant="secondary">{file.fileType}</Chip>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-default-400 text-xs">{file.size} B</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-default-400 text-xs">{new Date(file.updatedAt).toLocaleString()}</span>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table>
          <Pagination total={data.total} limit={20} offset={offset} onChange={setOffset} />
        </>
      )}
    </div>
  );
}
