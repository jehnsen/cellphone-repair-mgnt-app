import { Suspense } from "react";
import { ReleaseView } from "./release-view";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ReleaseView />
    </Suspense>
  );
}
