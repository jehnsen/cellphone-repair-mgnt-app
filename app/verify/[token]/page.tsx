import { DiagnosisLinkView } from "./diagnosis-link-view";

export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <DiagnosisLinkView token={token} />;
}
