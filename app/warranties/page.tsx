import { Suspense } from "react";
import { WarrantiesView } from "./warranties-view";

/* `WarrantiesView` reads `useSearchParams()` for the active tab, so it needs a
   Suspense boundary for static generation — same as the board and release. */
export default function Page() {
  return (
    <Suspense>
      <WarrantiesView />
    </Suspense>
  );
}
