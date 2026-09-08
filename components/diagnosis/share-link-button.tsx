"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Copies the customer-facing link for this ticket.
 *
 * The link rides on the ticket's existing verification token — the same one
 * behind the chain-of-custody proof. Reusing it rather than minting a second
 * link type is deliberate: the shop already hands this token out, it is
 * already revocable from one place, and it is already behind the API's strict
 * public rate limiter. A second kind of link would be a second thing to leak
 * and a second thing to remember to revoke.
 */
export function ShareLinkButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = `${window.location.origin}/verify/${token}`;

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      /* The URL goes in the toast as well as the clipboard. A shop tablet on
         an insecure origin has no clipboard API at all, and a technician who
         can read the link can still type it into a message. */
      toast.success("Customer link copied", { description: url });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.info("Copy this link for the customer", {
        description: url,
        duration: 15_000,
      });
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={copy}>
      {copied ? <Check aria-hidden /> : <Link2 aria-hidden />}
      {copied ? "Copied" : "Customer link"}
    </Button>
  );
}
