"use client";

import { useState, useEffect } from "react";
import {
  Modal,
  Button,
  Input,
  Label,
  TextArea,
  Switch,
  ListBox,
  Select,
  useOverlayState,
} from "@heroui/react";
import { projectEnvironmentApi } from "@/web/api-client";
import { humanizeError } from "@/web/lib/humanize-error";
import type {
  Task,
  CreateTaskInput,
  UpdateTaskInput,
  ProjectEnvironment,
} from "@/web/types/dbt";

interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (
    data: CreateTaskInput | (UpdateTaskInput & { command: Task["command"] }),
  ) => Promise<void>;
  task?: Task | null;
  projectId: number;
}

/**
 * 任务表单。
 *
 * 第一阶段前端锁定 command=run（D1/D5）—— Select 仅展示 run 不可改，
 * 但 POST 体仍带 command: "run"，后端 schema 支持全集。
 */
export default function TaskFormModal({
  isOpen,
  onClose,
  onSubmit,
  task,
  projectId,
}: TaskFormModalProps) {
  const [name, setName] = useState("");
  const [environmentId, setEnvironmentId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [selectArg, setSelectArg] = useState("");
  const [excludeArg, setExcludeArg] = useState("");
  const [fullRefresh, setFullRefresh] = useState(false);
  const [vars, setVars] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bindings, setBindings] = useState<ProjectEnvironment[]>([]);

  const state = useOverlayState({
    isOpen,
    onOpenChange: (open) => {
      if (!open) onClose();
    },
  });

  // 加载项目已绑定的环境（供环境 Select 使用）
  // 使用 cancelled 标志，防止 modal 关闭后 setState（W9）
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    void (async () => {
      try {
        const result = await projectEnvironmentApi.list(projectId, {
          limit: 100,
          offset: 0,
        });
        if (cancelled) return;
        setBindings(result.items);
      } catch {
        if (cancelled) return;
        setBindings([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, projectId]);

  // 编辑态回填
  useEffect(() => {
    if (task) {
      setName(task.name);
      setEnvironmentId(String(task.environmentId));
      setDescription(task.description ?? "");
      setSelectArg(task.select ?? "");
      setExcludeArg(task.exclude ?? "");
      setFullRefresh(task.fullRefresh);
      setVars(task.vars ?? "");
    } else {
      setName("");
      setEnvironmentId(null);
      setDescription("");
      setSelectArg("");
      setExcludeArg("");
      setFullRefresh(false);
      setVars("");
    }
    setError(null);
  }, [task, isOpen]);

  const handleSubmit = async () => {
    if (!name.trim() || !environmentId) {
      setError("任务名称与环境为必填项");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = {
        projectId,
        name: name.trim(),
        environmentId: Number(environmentId),
        description: description.trim() || undefined,
        command: "run" as const,
        select: selectArg.trim() || undefined,
        exclude: excludeArg.trim() || undefined,
        fullRefresh,
        vars: vars.trim() || undefined,
      };
      await onSubmit(payload);
      onClose();
    } catch (err) {
      setError(humanizeError(err));
    } finally {
      setLoading(false);
    }
  };

  const noEnvironment = bindings.length === 0;

  return (
    <Modal state={state}>
      <Modal.Backdrop>
        <Modal.Container size="lg">
          <Modal.Dialog>
            <Modal.Header>{task ? "编辑任务" : "新建任务"}</Modal.Header>
            <Modal.Body className="gap-4">
              {error && (
                <div className="rounded-md bg-danger-50 p-2 text-sm text-danger-600 dark:bg-danger-100/10">
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-1">
                <Label htmlFor="task-name">任务名称 *</Label>
                <Input
                  id="task-name"
                  fullWidth
                  placeholder="如 每日订单模型刷新"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1">
                <Label>运行环境 *</Label>
                {noEnvironment ? (
                  <p className="text-sm text-warning-600 dark:text-warning-400">
                    该项目尚未绑定运行环境，请先在项目详情中绑定环境后再创建任务。
                  </p>
                ) : (
                  <Select
                    fullWidth
                    placeholder="选择已绑定的运行环境"
                    value={environmentId}
                    onChange={(key) => setEnvironmentId(key as string)}
                  >
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {bindings.map((b) => (
                          <ListBox.Item
                            key={String(b.environmentId)}
                            id={String(b.environmentId)}
                            textValue={
                              b.environmentName ?? `环境 #${b.environmentId}`
                            }
                          >
                            {b.environmentName ?? `环境 #${b.environmentId}`}
                            {b.environmentAlias ? `（${b.environmentAlias}）` : ""}
                            {b.databaseType ? ` · ${b.databaseType}` : ""}
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <Label>dbt 命令</Label>
                <Select
                  fullWidth
                  value="run"
                  onChange={() => {
                    /* 第一阶段锁定 run，不可改 */
                  }}
                >
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item id="run" textValue="run">
                        run（运行模型）
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    </ListBox>
                  </Select.Popover>
                </Select>
                <p className="text-xs text-default-400">
                  第一阶段仅支持 run 命令；后续将开放 build / test / compile 等。
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="task-select">--select</Label>
                  <Input
                    id="task-select"
                    fullWidth
                    placeholder="如 my_model+ 或 tag:nightly"
                    value={selectArg}
                    onChange={(e) => setSelectArg(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="task-exclude">--exclude</Label>
                  <Input
                    id="task-exclude"
                    fullWidth
                    placeholder="要排除的 model 选择器"
                    value={excludeArg}
                    onChange={(e) => setExcludeArg(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  isSelected={fullRefresh}
                  onChange={setFullRefresh}
                />
                <Label>--full-refresh（全量刷新增量模型）</Label>
              </div>

              <div className="flex flex-col gap-1">
                <Label htmlFor="task-vars">--vars（JSON 对象）</Label>
                <TextArea
                  id="task-vars"
                  fullWidth
                  rows={2}
                  placeholder='如 {"dt": "2024-01-01"}'
                  value={vars}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setVars(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1">
                <Label htmlFor="task-desc">描述</Label>
                <TextArea
                  id="task-desc"
                  fullWidth
                  rows={2}
                  placeholder="选填"
                  value={description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                />
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" onPress={onClose} isDisabled={loading}>
                取消
              </Button>
              <Button
                variant="primary"
                onPress={handleSubmit}
                isDisabled={loading || !name.trim() || !environmentId}
              >
                {loading ? "保存中..." : task ? "保存" : "创建"}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
