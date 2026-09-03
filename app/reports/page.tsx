import { Suspense } from "react";
import { ReportsView } from "./reports-view";

/* `ReportsView` reads `useSearchParams()` for the active report tab, so it
   needs a Suspense boundary for static generation — same as the board,
   release, and warranties. */
export default function Page() {
  return (
    <Suspense>
      <ReportsView />
    </Suspense>
  );
}
