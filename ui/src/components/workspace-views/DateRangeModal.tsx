import { useState, useEffect } from "react";
import { Modal } from "../ui";
import { parseISODateLocal, toISODateLocal } from "../../lib/dateOnly";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatDisplay(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export interface DateRangeModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  after: string | null;
  before: string | null;
  onApply: (after: string, before: string) => void;
}

export function DateRangeModal({
  open,
  onClose,
  title,
  after,
  before,
  onApply,
}: DateRangeModalProps) {
  const now = new Date();
  const defaultStart = after
    ? parseISODateLocal(after)
    : new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const defaultEnd = before
    ? parseISODateLocal(before)
    : new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

  const [startDate, setStartDate] = useState<Date>(defaultStart);
  const [endDate, setEndDate] = useState<Date>(defaultEnd);

  const [leftMonth, setLeftMonth] = useState(now.getMonth());
  const [leftYear, setLeftYear] = useState(now.getFullYear());

  useEffect(() => {
    if (!open) return;
    const now = new Date();
    const start = after
      ? parseISODateLocal(after)
      : new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = before
      ? parseISODateLocal(before)
      : new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
    queueMicrotask(() => {
      setStartDate(start);
      setEndDate(end);
      setLeftMonth(start.getMonth());
      setLeftYear(start.getFullYear());
    });
  }, [open, after, before]);

  const rightMonth = leftMonth === 11 ? 0 : leftMonth + 1;
  const rightYear = leftMonth === 11 ? leftYear + 1 : leftYear;

  const handleApply = () => {
    const a = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate(),
    );
    const b = new Date(
      endDate.getFullYear(),
      endDate.getMonth(),
      endDate.getDate(),
    );
    if (a.getTime() > b.getTime()) {
      setStartDate(b);
      setEndDate(a);
      onApply(toISODateLocal(b), toISODateLocal(a));
    } else {
      onApply(toISODateLocal(a), toISODateLocal(b));
    }
    onClose();
  };

  const daysInMonth = (year: number, month: number) =>
    new Date(year, month + 1, 0).getDate();
  const firstDay = (year: number, month: number) =>
    new Date(year, month, 1).getDay();

  const renderCalendar = (year: number, month: number, isStart: boolean) => {
    const days = daysInMonth(year, month);
    const first = firstDay(year, month);
    const cells: React.ReactNode[] = [];
    for (let i = 0; i < first; i++)
      cells.push(
        <td
          key={`empty-${i}`}
          className="w-[2rem] min-w-[2rem] max-w-[2rem] p-0.5"
        />,
      );
    for (let d = 1; d <= days; d++) {
      const date = new Date(year, month, d);
      const iso = toISODateLocal(date);
      const selected = isStart
        ? toISODateLocal(startDate) === iso
        : toISODateLocal(endDate) === iso;
      const inRange =
        date >=
          new Date(
            startDate.getFullYear(),
            startDate.getMonth(),
            startDate.getDate(),
          ) &&
        date <=
          new Date(
            endDate.getFullYear(),
            endDate.getMonth(),
            endDate.getDate(),
          );
      cells.push(
        <td
          key={d}
          className="w-[2rem] min-w-[2rem] max-w-[2rem] p-0.5 align-middle"
        >
          <button
            type="button"
            onClick={() => (isStart ? setStartDate(date) : setEndDate(date))}
            className={`flex h-8 w-8 min-h-8 min-w-8 shrink-0 items-center justify-center rounded-full text-sm leading-none overflow-hidden ${
              selected
                ? "bg-(--brand-default) text-white"
                : inRange
                  ? "bg-(--brand-200) text-(--brand-default)"
                  : "text-(--txt-primary) hover:bg-(--bg-layer-2)"
            }`}
          >
            <span className="truncate">{d}</span>
          </button>
        </td>,
      );
    }
    const rows: React.ReactNode[] = [];
    let row: React.ReactNode[] = [];
    cells.forEach((c) => {
      row.push(c);
      if (row.length === 7) {
        rows.push(<tr key={rows.length}>{row}</tr>);
        row = [];
      }
    });
    if (row.length) rows.push(<tr key={rows.length}>{row}</tr>);

    return (
      <div className="flex flex-col">
        <div className="flex items-center justify-between pb-2">
          <span className="text-sm font-medium text-(--txt-primary)">
            {MONTHS[month]} ▾ {year}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => {
                if (month === 0) setLeftYear((y) => y - 1);
                setLeftMonth((m) => (m === 0 ? 11 : m - 1));
              }}
              className="rounded p-1 text-(--txt-icon-tertiary) hover:bg-(--bg-layer-2)"
              aria-label="Previous month"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => {
                if (month === 11) setLeftYear((y) => y + 1);
                setLeftMonth((m) => (m === 11 ? 0 : m + 1));
              }}
              className="rounded p-1 text-(--txt-icon-tertiary) hover:bg-(--bg-layer-2)"
              aria-label="Next month"
            >
              →
            </button>
          </div>
        </div>
        <table className="table-fixed w-full min-w-[14rem] text-left text-sm">
          <thead>
            <tr className="text-(--txt-tertiary)">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                <th
                  key={day}
                  className="w-[2rem] min-w-[2rem] max-w-[2rem] p-0.5 text-center font-normal text-xs"
                >
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      className="max-w-[520px]"
      footer={
        <div className="flex justify-end gap-2 border-t border-(--border-subtle) px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-3 py-1.5 text-sm font-medium text-(--txt-primary) hover:bg-(--bg-layer-2-hover)"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="rounded-md bg-(--brand-default) px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            Apply
          </button>
        </div>
      }
    >
      <div className="px-5 py-4">
        <div className="flex gap-6">
          <div className="min-w-[14rem]">
            {renderCalendar(leftYear, leftMonth, true)}
          </div>
          <div className="min-w-[14rem]">
            {renderCalendar(rightYear, rightMonth, false)}
          </div>
        </div>
        <p className="mt-4 text-sm text-(--txt-secondary)">
          After: {formatDisplay(startDate)} Before: {formatDisplay(endDate)}
        </p>
      </div>
    </Modal>
  );
}
