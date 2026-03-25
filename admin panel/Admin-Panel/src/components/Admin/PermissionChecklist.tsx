// import { Checkbox } from "@/components/ui/checkbox";
// import { Label } from "@/components/ui/label";
import { Checkbox } from "../ui/checkbox";
export type AdminPermission = "FEE_CONFIG" | "CONTRIBUTIONS";

export interface PermissionDefinition {
  id: AdminPermission;
  label: string;
  description: string;
}

export const ADMIN_PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  {
    id: "FEE_CONFIG",
    label: "Fee Configuration",
    description: "View and edit platform fee, charity fee, and wallet addresses",
  },
  {
    id: "CONTRIBUTIONS",
    label: "Community Submissions",
    description: "Review, approve, reject community submissions and allocate points manually",
  },
];

interface PermissionChecklistProps {
  value: string[];
  onChange: (permissions: string[]) => void;
}

const PermissionChecklist = ({ value, onChange }: PermissionChecklistProps) => {
  const togglePermission = (permissionId: string) => {
    if (value.includes(permissionId)) {
      onChange(value.filter((id) => id !== permissionId));
      return;
    }

    onChange([...value, permissionId]);
  };

  // return (
  //   <div className="space-y-2">
  //     {ADMIN_PERMISSION_DEFINITIONS.map((permission) => {
  //       const checked = value.includes(permission.id);

  //       return (
  //         <label
  //           key={permission.id}
  //           className="flex items-start gap-3 p-3 bg-muted/20 rounded-lg cursor-pointer hover:bg-muted/30 transition-colors border border-white"
  //         >
  //           <Checkbox
  //             checked={checked}
  //             onCheckedChange={() => togglePermission(permission.id)}
  //             className="mt-0.5"
  //           />
  //           <div className="flex-1">
  //             <Label className="text-foreground text-sm font-medium cursor-pointer">
  //               {permission.label}
  //             </Label>
  //             <p className="text-muted-foreground text-xs mt-0.5">{permission.description}</p>
  //           </div>
  //         </label>
  //       );
  //     })}
  //   </div>
  // );

  return (
    <div className="space-y-2">
      {ADMIN_PERMISSION_DEFINITIONS.map((permission) => {
        const checked = value.includes(permission.id);

        return (
          <div
            key={permission.id}
            onClick={() => togglePermission(permission.id)}
            className="flex items-start gap-3 p-3 bg-muted/20 rounded-lg cursor-pointer hover:bg-muted/30 transition-colors"
          >
            <Checkbox
              checked={checked}
              onClick={(e) => e.stopPropagation()}
              onCheckedChange={(checkedValue) => {
                onChange(
                  checkedValue
                    ? [...value, permission.id]
                    : value.filter((id) => id !== permission.id)
                );
              }}
              className="mt-0.5"
            />

            <div className="flex-1">
              <p className="text-foreground text-sm font-medium">
                {permission.label}
              </p>

              <p className="text-muted-foreground text-xs mt-0.5">
                {permission.description}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );

};

export default PermissionChecklist;
