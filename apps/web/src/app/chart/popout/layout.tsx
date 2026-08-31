import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GCC Scanner Chart",
  description: "Detached scanner chart window",
};

/** No shell — root layout providers only. */
export default function PopoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
