import { WarrantyClaimView } from "./warranty-claim-view";

export default async function Page({
  params,
}: {
  params: Promise<{ ulid: string }>;
}) {
  const { ulid } = await params;
  return <WarrantyClaimView ulid={ulid} />;
}
