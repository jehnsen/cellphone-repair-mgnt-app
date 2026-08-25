import { StageStub } from "@/components/shell/stage-stub";

export default function Page() {
  return (
    <StageStub
      stage={8}
      title={"Reports"}
      summary={"Sales, margin, technician throughput, inventory valuation, and aging unclaimed units."}
      covers={["Date range picker on every report","Chart plus the table underneath it","Repair versus handset versus accessory breakdown","CSV export, computed in the browser"]}
    />
  );
}
