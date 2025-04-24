// src/components/meep/Console/SimulationConsole.tsx
"use client";

import React, { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";

interface Props {
  logs: string[];
}
export default function SimulationConsole({ logs }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);

  useEffect(() => {
    if (!termRef.current && ref.current) {
      termRef.current = new Terminal({
        fontSize: 12,
        theme: { background: "#1e1e1e" },
        rows: 10,
      });
      termRef.current.open(ref.current);
    }
    termRef.current?.clear();
    logs.forEach((l) => termRef.current?.writeln(l));
  }, [logs]);

  return <div ref={ref} className="h-40" />;
}