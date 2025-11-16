import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, X } from "lucide-react";

interface BugReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function BugReportModal({ open, onOpenChange }: BugReportModalProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);

  const submitMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; message: string; screenshot?: string }) => {
      return await apiRequest("POST", "/api/support/bug-report", data);
    },
    onSuccess: () => {
      toast({
        title: "Report submitted",
        description: "Thank you for your feedback. We'll get back to you soon!",
      });
      setName("");
      setEmail("");
      setMessage("");
      setScreenshot(null);
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to submit report",
        description: error.message || "Please try again later.",
      });
    },
  });

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          variant: "destructive",
          title: "File too large",
          description: "Screenshot must be less than 5MB",
        });
        return;
      }
      setScreenshot(file);
    }
  };

  const removeScreenshot = () => {
    setScreenshot(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !email.trim() || !message.trim()) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please fill in all required fields",
      });
      return;
    }

    let screenshotBase64: string | undefined;
    if (screenshot) {
      const reader = new FileReader();
      screenshotBase64 = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(screenshot);
      });
    }

    submitMutation.mutate({
      name: name.trim(),
      email: email.trim(),
      message: message.trim(),
      screenshot: screenshotBase64,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="modal-bug-report">
        <DialogHeader>
          <DialogTitle>Report a Bug or Contact Us</DialogTitle>
          <DialogDescription>
            Tell us about any issues you're experiencing or send us a message. We'll get back to you as soon as possible.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              required
              disabled={submitMutation.isPending}
              data-testid="input-bug-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">
              Email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@example.com"
              required
              disabled={submitMutation.isPending}
              data-testid="input-bug-email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">
              Message <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe the issue or tell us what's on your mind..."
              rows={5}
              required
              disabled={submitMutation.isPending}
              data-testid="input-bug-message"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="screenshot">Screenshot (optional)</Label>
            {screenshot ? (
              <div className="flex items-center gap-2 p-3 border rounded-md bg-muted">
                <div className="flex-1 truncate text-sm">{screenshot.name}</div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={removeScreenshot}
                  disabled={submitMutation.isPending}
                  data-testid="button-remove-screenshot"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Input
                  id="screenshot"
                  type="file"
                  accept="image/*"
                  onChange={handleScreenshotChange}
                  disabled={submitMutation.isPending}
                  className="hidden"
                  data-testid="input-bug-screenshot"
                />
                <Label
                  htmlFor="screenshot"
                  className="flex items-center justify-center gap-2 p-3 border-2 border-dashed rounded-md cursor-pointer hover-elevate transition-colors"
                >
                  <Upload className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Upload screenshot (max 5MB)</span>
                </Label>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitMutation.isPending}
              className="flex-1"
              data-testid="button-cancel-bug"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitMutation.isPending}
              className="flex-1"
              data-testid="button-submit-bug"
            >
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Report"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
