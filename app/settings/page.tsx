import { StageStub } from "@/components/shell/stage-stub";

export default function Page() {
  return (
    <StageStub
      stage={9}
      title={"Settings"}
      summary={"Users and roles, service catalog, warranty templates, shop profile, and notification templates."}
      covers={["Permission matrix by role","Service catalog and price list","Receipt header, footer, and BIR display toggle","Viber and SMS templates with merge fields"]}
    />
  );
}
