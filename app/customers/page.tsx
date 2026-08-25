import { StageStub } from "@/components/shell/stage-stub";

export default function Page() {
  return (
    <StageStub
      stage={9}
      title={"Customers"}
      summary={"Directory and history, including every device that has passed through the shop by IMEI."}
      covers={["Repairs grouped by device and IMEI","Purchases, lifetime value, outstanding balances","Active warranties with expiry dates","IMEI lookup across all customers"]}
    />
  );
}
