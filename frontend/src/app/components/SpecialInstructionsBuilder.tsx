import { useState, useEffect } from "react";
import { Plus, X } from "lucide-react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "./ui/accordion";

interface SkipEntry {
  woNumber: string;
}
interface LockEntry {
  nameFragment: string;
  vehicle: string;
}
interface PriorityEntry {
  nameFragment: string;
}
interface WindowEntry {
  woNumber: string;
  openTime: string;
  closeTime: string;
}
interface NoteEntry {
  woNumber: string;
  text: string;
}

interface Props {
  onChange: (text: string) => void;
  disabled?: boolean;
}

export function SpecialInstructionsBuilder({ onChange, disabled }: Props) {
  const [skips, setSkips] = useState<SkipEntry[]>([]);
  const [locks, setLocks] = useState<LockEntry[]>([]);
  const [priorities, setPriorities] = useState<PriorityEntry[]>([]);
  const [windows, setWindows] = useState<WindowEntry[]>([]);
  const [notes, setNotes] = useState<NoteEntry[]>([]);

  useEffect(() => {
    const lines: string[] = [];
    skips.forEach((s) => {
      if (s.woNumber.trim())
        lines.push(`skip: WO#${s.woNumber.trim()}`);
    });
    locks.forEach((l) => {
      if (l.nameFragment.trim() && l.vehicle.trim())
        lines.push(`lock: ${l.nameFragment.trim()} → truck=${l.vehicle.trim()}`);
    });
    priorities.forEach((p) => {
      if (p.nameFragment.trim())
        lines.push(`priority: ${p.nameFragment.trim()}`);
    });
    windows.forEach((w) => {
      if (w.woNumber.trim() && w.openTime && w.closeTime)
        lines.push(`window: WO#${w.woNumber.trim()} → ${w.openTime}-${w.closeTime}`);
    });
    notes.forEach((n) => {
      if (n.woNumber.trim() && n.text.trim())
        lines.push(`note: WO#${n.woNumber.trim()} → ${n.text.trim()}`);
    });
    onChange(lines.join("\n"));
  }, [skips, locks, priorities, windows, notes]);

  const inputClass =
    "w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500";
  const removeBtn =
    "shrink-0 text-gray-400 hover:text-red-500 transition-colors p-0.5";
  const addBtn =
    "flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium mt-2";

  const badgeCount = (n: number) =>
    n > 0 ? (
      <span className="ml-auto text-xs bg-blue-100 text-blue-700 rounded-full px-1.5 py-0.5 font-medium">
        {n}
      </span>
    ) : null;

  return (
    <Accordion type="multiple" className="w-full">
      {/* Skip Orders */}
      <AccordionItem value="skip">
        <AccordionTrigger className="py-2.5 text-xs font-semibold text-gray-700">
          <span className="flex items-center gap-2 w-full">
            Skip orders {badgeCount(skips.filter((s) => s.woNumber.trim()).length)}
          </span>
        </AccordionTrigger>
        <AccordionContent className="pb-2">
          <p className="text-xs text-gray-500 mb-2">
            Enter work order numbers to exclude from routing.
          </p>
          <div className="space-y-2">
            {skips.map((entry, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-gray-400 shrink-0">WO#</span>
                <input
                  className={inputClass}
                  placeholder="e.g. 977187"
                  value={entry.woNumber}
                  disabled={disabled}
                  onChange={(e) => {
                    const next = [...skips];
                    next[i] = { woNumber: e.target.value };
                    setSkips(next);
                  }}
                />
                <button
                  className={removeBtn}
                  disabled={disabled}
                  onClick={() => setSkips(skips.filter((_, j) => j !== i))}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
          <button
            className={addBtn}
            disabled={disabled}
            onClick={() => setSkips([...skips, { woNumber: "" }])}
          >
            <Plus className="size-3.5" /> Add skip
          </button>
        </AccordionContent>
      </AccordionItem>

      {/* Lock to Vehicle */}
      <AccordionItem value="lock">
        <AccordionTrigger className="py-2.5 text-xs font-semibold text-gray-700">
          <span className="flex items-center gap-2 w-full">
            Assign to truck {badgeCount(locks.filter((l) => l.nameFragment.trim() && l.vehicle.trim()).length)}
          </span>
        </AccordionTrigger>
        <AccordionContent className="pb-2">
          <p className="text-xs text-gray-500 mb-2">
            Pin a stop to a specific truck by name.
          </p>
          <div className="space-y-2">
            {locks.map((entry, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  className={inputClass}
                  placeholder="Stop name"
                  value={entry.nameFragment}
                  disabled={disabled}
                  onChange={(e) => {
                    const next = [...locks];
                    next[i] = { ...next[i], nameFragment: e.target.value };
                    setLocks(next);
                  }}
                />
                <input
                  className={`${inputClass} max-w-[90px]`}
                  placeholder="Truck"
                  value={entry.vehicle}
                  disabled={disabled}
                  onChange={(e) => {
                    const next = [...locks];
                    next[i] = { ...next[i], vehicle: e.target.value };
                    setLocks(next);
                  }}
                />
                <button
                  className={removeBtn}
                  disabled={disabled}
                  onClick={() => setLocks(locks.filter((_, j) => j !== i))}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
          <button
            className={addBtn}
            disabled={disabled}
            onClick={() => setLocks([...locks, { nameFragment: "", vehicle: "" }])}
          >
            <Plus className="size-3.5" /> Add assignment
          </button>
        </AccordionContent>
      </AccordionItem>

      {/* Priority */}
      <AccordionItem value="priority">
        <AccordionTrigger className="py-2.5 text-xs font-semibold text-gray-700">
          <span className="flex items-center gap-2 w-full">
            Deliver first {badgeCount(priorities.filter((p) => p.nameFragment.trim()).length)}
          </span>
        </AccordionTrigger>
        <AccordionContent className="pb-2">
          <p className="text-xs text-gray-500 mb-2">
            These stops will be prioritized as early deliveries.
          </p>
          <div className="space-y-2">
            {priorities.map((entry, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  className={inputClass}
                  placeholder="Stop name"
                  value={entry.nameFragment}
                  disabled={disabled}
                  onChange={(e) => {
                    const next = [...priorities];
                    next[i] = { nameFragment: e.target.value };
                    setPriorities(next);
                  }}
                />
                <button
                  className={removeBtn}
                  disabled={disabled}
                  onClick={() => setPriorities(priorities.filter((_, j) => j !== i))}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
          <button
            className={addBtn}
            disabled={disabled}
            onClick={() => setPriorities([...priorities, { nameFragment: "" }])}
          >
            <Plus className="size-3.5" /> Add priority
          </button>
        </AccordionContent>
      </AccordionItem>

      {/* Time Window Override */}
      <AccordionItem value="window">
        <AccordionTrigger className="py-2.5 text-xs font-semibold text-gray-700">
          <span className="flex items-center gap-2 w-full">
            Override time window {badgeCount(windows.filter((w) => w.woNumber.trim() && w.openTime && w.closeTime).length)}
          </span>
        </AccordionTrigger>
        <AccordionContent className="pb-2">
          <p className="text-xs text-gray-500 mb-2">
            Change the delivery window for a specific order.
          </p>
          <div className="space-y-2">
            {windows.map((entry, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 shrink-0">WO#</span>
                  <input
                    className={inputClass}
                    placeholder="e.g. 976054"
                    value={entry.woNumber}
                    disabled={disabled}
                    onChange={(e) => {
                      const next = [...windows];
                      next[i] = { ...next[i], woNumber: e.target.value };
                      setWindows(next);
                    }}
                  />
                  <button
                    className={removeBtn}
                    disabled={disabled}
                    onClick={() => setWindows(windows.filter((_, j) => j !== i))}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-2 pl-7">
                  <input
                    type="time"
                    className={`${inputClass} max-w-[110px]`}
                    value={entry.openTime}
                    disabled={disabled}
                    onChange={(e) => {
                      const next = [...windows];
                      next[i] = { ...next[i], openTime: e.target.value };
                      setWindows(next);
                    }}
                  />
                  <span className="text-xs text-gray-400">to</span>
                  <input
                    type="time"
                    className={`${inputClass} max-w-[110px]`}
                    value={entry.closeTime}
                    disabled={disabled}
                    onChange={(e) => {
                      const next = [...windows];
                      next[i] = { ...next[i], closeTime: e.target.value };
                      setWindows(next);
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <button
            className={addBtn}
            disabled={disabled}
            onClick={() =>
              setWindows([...windows, { woNumber: "", openTime: "", closeTime: "" }])
            }
          >
            <Plus className="size-3.5" /> Add time override
          </button>
        </AccordionContent>
      </AccordionItem>

      {/* Notes */}
      <AccordionItem value="note">
        <AccordionTrigger className="py-2.5 text-xs font-semibold text-gray-700">
          <span className="flex items-center gap-2 w-full">
            Delivery notes {badgeCount(notes.filter((n) => n.woNumber.trim() && n.text.trim()).length)}
          </span>
        </AccordionTrigger>
        <AccordionContent className="pb-2">
          <p className="text-xs text-gray-500 mb-2">
            Attach a note to a specific order (e.g. "call 30min ahead").
          </p>
          <div className="space-y-2">
            {notes.map((entry, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-xs text-gray-400">WO#</span>
                  <input
                    className={`${inputClass} max-w-[80px]`}
                    placeholder="976055"
                    value={entry.woNumber}
                    disabled={disabled}
                    onChange={(e) => {
                      const next = [...notes];
                      next[i] = { ...next[i], woNumber: e.target.value };
                      setNotes(next);
                    }}
                  />
                </div>
                <input
                  className={inputClass}
                  placeholder="Note text"
                  value={entry.text}
                  disabled={disabled}
                  onChange={(e) => {
                    const next = [...notes];
                    next[i] = { ...next[i], text: e.target.value };
                    setNotes(next);
                  }}
                />
                <button
                  className={removeBtn}
                  disabled={disabled}
                  onClick={() => setNotes(notes.filter((_, j) => j !== i))}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
          <button
            className={addBtn}
            disabled={disabled}
            onClick={() => setNotes([...notes, { woNumber: "", text: "" }])}
          >
            <Plus className="size-3.5" /> Add note
          </button>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
