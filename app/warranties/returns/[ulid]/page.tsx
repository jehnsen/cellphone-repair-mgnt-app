import { SupplierReturnView } from "./supplier-return-view";

export default async function Page({
  params,
}: {
  params: Promise<{ ulid: string }>;
}) {
  const { ulid } = await params;
  return <SupplierReturnView ulid={ulid} />;
}
