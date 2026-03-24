import { AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";

interface RemoveStopDialogProps {
  open: boolean;
  stopName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RemoveStopDialog({
  open,
  stopName,
  onConfirm,
  onCancel,
}: RemoveStopDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="size-10 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="size-5 text-red-600" />
            </div>
            <AlertDialogTitle>Remove Delivery Stop?</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-base">
            Are you sure you want to remove <span className="font-semibold text-gray-900">{stopName}</span> from today's delivery route?
            <br /><br />
            This action will remove the stop from the current plan. You'll need to manually reschedule this delivery for another day.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700"
          >
            Remove Stop
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
