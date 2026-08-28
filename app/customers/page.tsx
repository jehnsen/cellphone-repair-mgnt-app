import { Suspense } from "react";
import { CustomersView } from "./customers-view";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CustomersView />
    </Suspense>
  );
}
