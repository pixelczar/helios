"use client";

export function HUD({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-10 pointer-events-none">
      <div className="relative w-full h-full">{children}</div>
    </div>
  );
}
