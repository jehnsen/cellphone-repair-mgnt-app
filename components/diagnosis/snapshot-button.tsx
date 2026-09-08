"use client";

import { useState } from "react";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useShop } from "@/lib/shop/store";
import { toastError } from "@/lib/api/errors";
import type { DiagnosisSnapshot, IssueSource } from "@/lib/types";
import type { PhoneSceneHandle } from "@/components/diagnosis/phone-scene";

/**
 * Freezes what the customer is looking at, and files it against the ticket.
 *
 * Worth being clear about why this exists at all: the live view is rebuilt
 * from the ticket's finding every time it opens, so it moves the moment the
 * finding is revised. That is right for the bench and wrong for a quote
 * somebody already approved — so the snapshot pins the image *and* the exact
 * selection behind it.
 */
export function SnapshotButton({
  ticketId,
  scene,
  source,
  issueKeys,
  partKeys,
  note,
  disabled,
  onSaved,
}: {
  ticketId: string;
  scene: React.RefObject<PhoneSceneHandle | null>;
  source: IssueSource;
  issueKeys: string[];
  partKeys: string[];
  note?: string;
  disabled?: boolean;
  onSaved: (snapshot: DiagnosisSnapshot) => void;
}) {
  const { api } = useShop();
  const [saving, setSaving] = useState(false);

  async function capture() {
    const handle = scene.current;

    if (!handle) {
      toast.error("Nothing to capture", {
        description: "The 3D view has not finished loading.",
      });
      return;
    }

    setSaving(true);
    try {
      const image = await handle.capture();

      /* toBlob resolves with null when the canvas is tainted or the context
         was lost. Saying so beats posting an empty file that looks fine in
         the list until somebody opens the quote. */
      if (!image) {
        toast.error("Could not capture the view", {
          description:
            "The 3D view did not return an image. Try reloading the ticket.",
        });
        return;
      }

      const snapshot = await api.saveDiagnosisSnapshot({
        ticketId,
        image,
        issueSource: source,
        issueKeys,
        partKeys,
        camera: handle.cameraState(),
        note,
      });

      onSaved(snapshot);
      toast.success("Snapshot saved to the ticket");
    } catch (error) {
      toastError(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={capture}
      disabled={disabled || saving}
    >
      <Camera aria-hidden />
      {saving ? "Saving…" : "Save snapshot"}
    </Button>
  );
}
