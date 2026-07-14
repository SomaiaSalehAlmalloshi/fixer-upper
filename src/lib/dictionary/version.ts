/**
 * Data Dictionary versioning.
 *
 * A single version number for the whole Data Dictionary + per-package
 * status. Bump `DICTIONARY_VERSION` whenever the shape of any package
 * changes (new sheet, column added/removed, type change).
 */

export type TemplateStatus = "draft" | "active" | "deprecated";

export interface PackageVersionInfo {
  version: string;
  status: TemplateStatus;
  createdAt: string;      // ISO date
  modifiedAt: string;     // ISO date
  compatibility: string;  // free-text "compatible with schema >= X"
}

/** Global Data Dictionary version — bump on ANY structural change. */
export const DICTIONARY_VERSION = "1.0.0";

/** Per-package metadata. Falls back to defaults for unregistered keys. */
export const PACKAGE_VERSIONS: Record<string, PackageVersionInfo> = {
  master: {
    version: "1.0.0",
    status: "active",
    createdAt: "2026-07-14",
    modifiedAt: "2026-07-14",
    compatibility: "Basel III Compliance DB v1+",
  },
  credit: {
    version: "1.0.0",
    status: "active",
    createdAt: "2026-07-14",
    modifiedAt: "2026-07-14",
    compatibility: "credit_borrowers / credit_loans / credit_collateral v1+",
  },
  capital: {
    version: "1.0.0",
    status: "active",
    createdAt: "2026-07-14",
    modifiedAt: "2026-07-14",
    compatibility: "liq_hqla / liq_cashflows / liq_funding_sources v1+",
  },
  risk: {
    version: "1.0.0",
    status: "active",
    createdAt: "2026-07-14",
    modifiedAt: "2026-07-14",
    compatibility: "rwa_assets / market_positions / op_* v1+",
  },
};

export function getPackageVersion(packageKey: string): PackageVersionInfo {
  return (
    PACKAGE_VERSIONS[packageKey] ?? {
      version: "0.1.0",
      status: "draft",
      createdAt: new Date().toISOString().slice(0, 10),
      modifiedAt: new Date().toISOString().slice(0, 10),
      compatibility: "n/a",
    }
  );
}
