import { StageStub } from "@/components/shell/stage-stub";

export default function Page() {
  return (
    <StageStub
      stage={3}
      title={"New job order"}
      summary={"Counter intake: customer, device, problem, condition photos, commercials, then a printable claim stub."}
      covers={["Customer autocomplete with inline new customer","IMEI scan field, pattern-grid unlock input","Six photo slots and a condition checklist","Claim stub print at 58mm, 80mm, and A5"]}
    />
  );
}
