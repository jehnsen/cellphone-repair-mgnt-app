import { StageStub } from "@/components/shell/stage-stub";

export default function Page() {
  return (
    <StageStub
      stage={7}
      title={"Point of sale"}
      summary={"Keyboard-first cart that mixes handsets by IMEI, accessories by quantity, and walk-in service charges."}
      covers={["Barcode field focused on load, Enter to add","Senior citizen and PWD discount with ID capture","Split payment, GCash and Maya, trade-in as a payment line","Cash drawer: open, cash in and out, close with variance"]}
    />
  );
}
