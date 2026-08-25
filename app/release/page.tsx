import { StageStub } from "@/components/shell/stage-stub";

export default function Page() {
  return (
    <StageStub
      stage={5}
      title={"Release"}
      summary={"Scan a claim code, verify the claimant against intake photos, collect the balance, print the warranty slip."}
      covers={["Claim code or ticket number lookup","Intake versus release condition comparison","Payment with change computation","Warranty slip and release receipt"]}
    />
  );
}
