import { ReportsTabs } from "@/components/tax/ReportsTabs";

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ReportsTabs />
      {children}
    </>
  );
}
