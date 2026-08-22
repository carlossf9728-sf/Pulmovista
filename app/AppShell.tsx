"use client";

import type { ReactNode } from "react";
import { PatientsProvider, usePatients } from "./providers";
import { Sidebar } from "@/components/layout/Sidebar";
import { patientStatus } from "@/engines/sentinel";

/** Réplica del shell del prototipo original: `.pv-root` (flex) + Sidebar + panel de contenido `.pv-scroll`. */
function ShellInner({ children }: { children: ReactNode }) {
  const { patients } = usePatients();
  const alertCount = patients.filter((p) => patientStatus(p) !== "estable").length;
  return (
    <div className="pv-root" style={{ display: "flex", height: "100%", minHeight: 640 }}>
      <Sidebar alertCount={alertCount} />
      <div className="pv-scroll" style={{ flex: 1, overflowY: "auto", padding: "28px 34px" }}>
        {children}
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <PatientsProvider>
      <ShellInner>{children}</ShellInner>
    </PatientsProvider>
  );
}
