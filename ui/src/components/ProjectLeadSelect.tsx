import type { ChangeEvent } from "react";
import type { WorkspaceMemberApiResponse } from "../api/types";

interface ProjectLeadSelectProps {
  value: string | null;
  members: WorkspaceMemberApiResponse[];
  onChange: (value: string | null) => void;
  disabled?: boolean;
}

const memberLabel = (
  members: WorkspaceMemberApiResponse[],
  memberId: string | null | undefined,
) => {
  if (!memberId) return "—";
  const m = members.find((wm) => wm.member_id === memberId);
  const display = m?.member_display_name?.trim();
  if (display) return display;
  const emailUser = m?.member_email?.split("@")[0]?.trim();
  if (emailUser) return emailUser;
  return "Member";
};

export function ProjectLeadSelect({
  value,
  members,
  onChange,
  disabled,
}: ProjectLeadSelectProps) {
  const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value || null;
    onChange(v);
  };

  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-(--txt-primary)">Project Lead</p>
      <div className="relative min-w-[180px]">
        <select
          value={value ?? ""}
          onChange={handleChange}
          disabled={disabled}
          className="w-full appearance-none rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 pr-8 text-sm text-(--txt-primary) focus:outline-none focus:border-(--border-strong)"
        >
          <option value="">Select</option>
          {members.map((m) => (
            <option key={m.member_id} value={m.member_id ?? ""}>
              {memberLabel(members, m.member_id)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
