import { StageStub } from "@/components/shell/stage-stub";

export default function Page() {
  return (
    <StageStub
      stage={4}
      title={"Repair board"}
      summary={"Kanban and table over the same tickets, sorted oldest first, with overdue jobs pulled out of their column."}
      covers={["Status columns with bin-label headers","Aging on the tag strip: paper, amber, hatched, vermilion","Filters by status, technician, brand, date, overdue","Bulk reassign and mark ready for pickup"]}
    />
  );
}
