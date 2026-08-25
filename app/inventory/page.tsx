import { StageStub } from "@/components/shell/stage-stub";

export default function Page() {
  return (
    <StageStub
      stage={6}
      title={"Inventory"}
      summary={"Three item classes that behave differently: serialized handsets, accessories by quantity, spare parts consumed by repairs."}
      covers={["Handset model rows that expand to individual IMEI units","Stock in against a supplier and reference number","Adjustments with a required reason","Low stock, dead stock, and the supplier directory"]}
    />
  );
}
