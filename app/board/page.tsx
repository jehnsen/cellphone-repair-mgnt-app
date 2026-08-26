import { Suspense } from "react";
import { BoardView } from "./board-view";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <BoardView />
    </Suspense>
  );
}
