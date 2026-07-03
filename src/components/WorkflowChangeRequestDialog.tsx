import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { WORKFLOW_CHANGE_REASON_EVENT } from "@/lib/changeRequests";

type PendingRequest = {
  resolve: (reason: string | null) => void;
};

export function WorkflowChangeRequestDialog() {
  const [pending, setPending] = useState<PendingRequest | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<PendingRequest>).detail;
      setReason("");
      setPending(detail);
    };
    window.addEventListener(WORKFLOW_CHANGE_REASON_EVENT, listener);
    return () => window.removeEventListener(WORKFLOW_CHANGE_REASON_EVENT, listener);
  }, []);

  const close = (value: string | null) => {
    pending?.resolve(value);
    setPending(null);
    setReason("");
  };

  return (
    <Dialog open={Boolean(pending)} onOpenChange={(open) => !open && close(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit Change Request</DialogTitle>
          <DialogDescription>
            This record was already updated once. Add a reason so an admin can review and approve the proposed change.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={4}
          placeholder="Explain why this correction is needed..."
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => close(null)}>Cancel</Button>
          <Button disabled={reason.trim().length < 5} onClick={() => close(reason.trim())}>Submit Request</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
