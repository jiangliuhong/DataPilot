"use client";

import { useState, useEffect } from "react";
import {
  Modal,
  Button,
  Input,
  Label,
  useOverlayState,
} from "@heroui/react";
import { Plus, Trash2 } from "lucide-react";
import type { Version, AdapterPackage, Dependency } from "@/web/types/dbt";

interface VersionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    version: string;
    adapterPackages: AdapterPackage[];
    dependencies: Dependency[];
    status?: "active" | "inactive";
  }) => Promise<void>;
  version?: Version | null;
}

export default function VersionFormModal({
  isOpen,
  onClose,
  onSubmit,
  version,
}: VersionFormModalProps) {
  const [name, setName] = useState("");
  const [ver, setVer] = useState("");
  const [adapters, setAdapters] = useState<AdapterPackage[]>([
    { name: "", version: "", supportedDatabases: [] },
  ]);
  const [deps, setDeps] = useState<Dependency[]>([{ name: "", version: "" }]);
  const [loading, setLoading] = useState(false);

  const state = useOverlayState({
    isOpen,
    onOpenChange: (open) => {
      if (!open) onClose();
    },
  });

  useEffect(() => {
    if (version) {
      setName(version.name);
      setVer(version.version);
      setAdapters(
        version.adapterPackages.length > 0
          ? version.adapterPackages
          : [{ name: "", version: "", supportedDatabases: [] }],
      );
      setDeps(
        version.dependencies.length > 0
          ? version.dependencies
          : [{ name: "", version: "" }],
      );
    } else {
      setName("");
      setVer("");
      setAdapters([{ name: "", version: "", supportedDatabases: [] }]);
      setDeps([{ name: "", version: "" }]);
    }
  }, [version, isOpen]);

  const handleSubmit = async () => {
    if (!name.trim() || !ver.trim()) return;
    setLoading(true);
    try {
      await onSubmit({
        name: name.trim(),
        version: ver.trim(),
        adapterPackages: adapters,
        dependencies: deps,
        ...(version?.status ? { status: version.status } : {}),
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const updateAdapter = (
    index: number,
    field: keyof AdapterPackage,
    value: string | string[],
  ) => {
    setAdapters((prev) =>
      prev.map((a, i) => (i === index ? { ...a, [field]: value } : a)),
    );
  };

  const updateDep = (
    index: number,
    field: keyof Dependency,
    value: string,
  ) => {
    setDeps((prev) =>
      prev.map((d, i) => (i === index ? { ...d, [field]: value } : d)),
    );
  };

  return (
    <Modal state={state}>
      <Modal.Backdrop>
        <Modal.Container size="lg" scroll="inside">
          <Modal.Dialog>
            <Modal.Header>{version ? "编辑版本" : "新建版本"}</Modal.Header>
            <Modal.Body className="gap-4">
              <div className="flex flex-col gap-1">
                <Label htmlFor="ver-name">版本名称 *</Label>
                <Input
                  id="ver-name"
                  fullWidth
                  placeholder="如 dbt-core-1.8"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="ver-number">版本号 *</Label>
                <Input
                  id="ver-number"
                  fullWidth
                  placeholder="如 1.8.0"
                  value={ver}
                  onChange={(e) => setVer(e.target.value)}
                />
              </div>

              {/* Adapter Packages */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">适配器包</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onPress={() =>
                      setAdapters((prev) => [
                        ...prev,
                        { name: "", version: "", supportedDatabases: [] },
                      ])
                    }
                  >
                    <Plus size={14} /> 添加
                  </Button>
                </div>
                {adapters.map((adapter, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <div className="flex flex-col gap-1 flex-1">
                      <Label>包名</Label>
                      <Input
                        fullWidth
                        placeholder="dbt-mysql"
                        value={adapter.name}
                        onChange={(e) => updateAdapter(i, "name", e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1 w-24">
                      <Label>版本</Label>
                      <Input
                        fullWidth
                        placeholder="1.8.0"
                        value={adapter.version}
                        onChange={(e) => updateAdapter(i, "version", e.target.value)}
                      />
                    </div>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="danger"
                      isDisabled={adapters.length <= 1}
                      onPress={() =>
                        setAdapters((prev) => prev.filter((_, idx) => idx !== i))
                      }
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Dependencies */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Python 依赖</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onPress={() =>
                      setDeps((prev) => [...prev, { name: "", version: "" }])
                    }
                  >
                    <Plus size={14} /> 添加
                  </Button>
                </div>
                {deps.map((dep, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <div className="flex flex-col gap-1 flex-1">
                      <Label>包名</Label>
                      <Input
                        fullWidth
                        placeholder="dbt-core"
                        value={dep.name}
                        onChange={(e) => updateDep(i, "name", e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1 w-24">
                      <Label>版本</Label>
                      <Input
                        fullWidth
                        placeholder="1.8.0"
                        value={dep.version}
                        onChange={(e) => updateDep(i, "version", e.target.value)}
                      />
                    </div>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="danger"
                      isDisabled={deps.length <= 1}
                      onPress={() =>
                        setDeps((prev) => prev.filter((_, idx) => idx !== i))
                      }
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" onPress={onClose}>
                取消
              </Button>
              <Button
                variant="primary"
                onPress={handleSubmit}
                isDisabled={!name.trim() || !ver.trim()}
              >
                {version ? "保存" : "创建"}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
