"use client";

import { Chip } from "@heroui/react";
import type { Version } from "@/web/types/dbt";

interface VersionDetailPanelProps {
  version: Version;
}

export default function VersionDetailPanel({
  version,
}: VersionDetailPanelProps) {
  return (
    <div className="p-3 bg-default-50 rounded-lg space-y-3">
      <div>
        <p className="text-xs font-semibold text-default-500 mb-1">
          适配器包
        </p>
        <div className="space-y-1">
          {version.adapterPackages.map((pkg, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="font-medium">{pkg.name}</span>
              <span className="text-default-400">@{pkg.version}</span>
              <div className="flex gap-1">
                {pkg.supportedDatabases.map((db) => (
                  <Chip key={db} size="sm" variant="secondary">
                    {db}
                  </Chip>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold text-default-500 mb-1">
          Python 依赖
        </p>
        <div className="space-y-1">
          {version.dependencies.map((dep, i) => (
            <div key={i} className="text-sm">
              <span className="font-medium">{dep.name}</span>
              <span className="text-default-400 ml-2">@{dep.version}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
