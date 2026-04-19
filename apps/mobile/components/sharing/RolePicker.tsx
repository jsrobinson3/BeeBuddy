import { SegmentedControl } from "../SegmentedControl";

const ROLE_OPTIONS = ["Editor", "Viewer"];

interface RolePickerProps {
  role: "editor" | "viewer";
  onChange: (role: "editor" | "viewer") => void;
}

export function RolePicker({ role, onChange }: RolePickerProps) {
  const display = role === "editor" ? "Editor" : "Viewer";
  return (
    <SegmentedControl
      options={ROLE_OPTIONS}
      selected={display}
      onChange={(val) => onChange(val.toLowerCase() as "editor" | "viewer")}
    />
  );
}
