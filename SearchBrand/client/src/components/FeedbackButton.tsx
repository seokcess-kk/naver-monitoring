import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageSquarePlus } from "lucide-react";
import { FeedbackModal } from "./FeedbackModal";

export function FeedbackButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 shadow-lg hover:shadow-xl transition-shadow"
      >
        <MessageSquarePlus className="h-4 w-4 mr-2" />
        피드백
      </Button>
      <FeedbackModal open={open} onOpenChange={setOpen} />
    </>
  );
}
