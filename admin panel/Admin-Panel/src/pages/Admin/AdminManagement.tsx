import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import {
  Shield,
  Copy,
  Trash2,
  UserPlus,
  Edit2,
  Loader2,
  Users,
  Check,
  AlertCircle,
  Key,
  Clock,
} from "lucide-react";
import { API_ENDPOINTS, buildApiUrl } from "../../config/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../../components/ui/dialog";
import { Label } from "../../components/ui/label";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import PermissionChecklist, {
  ADMIN_PERMISSION_DEFINITIONS,
} from "../../components/Admin/PermissionChecklist";

export interface Admin {
  id: string;
  name: string;
  walletAddress: string;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

const PERMISSION_COLORS: Record<string, string> = {
  FEE_CONFIG: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  CONTRIBUTIONS: "bg-purple-500/10 text-purple-400 border-purple-500/30",
};

function truncateWallet(wallet: string): string {
  if (wallet.length <= 12) return wallet;
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "Just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface AdminManagementProps {
  isSuperAdmin: boolean;
}

const AdminManagement = ({ isSuperAdmin }: AdminManagementProps) => {
  const { publicKey, connected } = useWallet();
  const adminWallet = publicKey?.toBase58() || "";

  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialog, setEditDialog] = useState<{ open: boolean; admin: Admin | null }>({
    open: false,
    admin: null,
  });
  const [removeDialog, setRemoveDialog] = useState<{ open: boolean; admin: Admin | null }>({
    open: false,
    admin: null,
  });

  const [formName, setFormName] = useState("");
  const [formWallet, setFormWallet] = useState("");
  const [formPermissions, setFormPermissions] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchAdmins = useCallback(async () => {
    if (!connected || !adminWallet) return;

    setLoading(true);
    try {
      const res = await fetch(buildApiUrl(API_ENDPOINTS.ADMIN_LIST), {
        headers: { "X-Admin-Wallet": adminWallet },
      });

      if (res.ok) {
        const data = await res.json();
        setAdmins(data.admins || []);
      } else if (res.status === 403) {
        toast.error("Access Denied. Super Admin Only.");
        setAdmins([]);
      } else {
        toast.error("Failed To Fetch Admin List");
        setAdmins([]);
      }
    } catch {
      toast.error("Failed To Fetch Admin List");
    } finally {
      setLoading(false);
    }
  }, [connected, adminWallet]);

  useEffect(() => {
    if (isSuperAdmin) {
      fetchAdmins();
    }
  }, [isSuperAdmin, fetchAdmins]);

  const handleAddAdmin = async () => {
    if (!formName.trim()) {
      toast.error("Admin Name is required");
      return;
    }
    if (formName.trim().length < 2) {
      toast.error("Admin Name must be at least 2 characters");
      return;
    }
    if (formName.trim().length > 50) {
      toast.error("Admin Name must not exceed 50 characters");
      return;
    }

    if (!formWallet.trim()) {
      toast.error("Wallet Address is required");
      return;
    }

    const walletTrimmed = formWallet.trim();
    if (walletTrimmed.length < 32 || walletTrimmed.length > 44) {
      toast.error("Invalid Wallet Address format");
      return;
    }

    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
    if (!base58Regex.test(walletTrimmed)) {
      toast.error("Invalid Wallet Address format (must be base58)");
      return;
    }

    if (formPermissions.length === 0) {
      toast.error("Please select at least one permission");
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(buildApiUrl(API_ENDPOINTS.ADMIN_CREATE), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Wallet": adminWallet,
        },
        body: JSON.stringify({
          name: formName.trim(),
          walletAddress: walletTrimmed,
          permissions: formPermissions,
        }),
      });

      if (res.ok) {
        toast.success("Admin Added Successfully");
        setAddDialogOpen(false);
        setFormName("");
        setFormWallet("");
        setFormPermissions([]);
        fetchAdmins();
      } else {
        const err = await res.json();
        toast.error(err.message || "Failed To Add Admin");
      }
    } catch {
      toast.error("Failed To Add Admin");
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditAdmin = async () => {
    if (!editDialog.admin) return;

    if (!formName.trim()) {
      toast.error("Admin Name is required");
      return;
    }
    if (formName.trim().length < 2) {
      toast.error("Admin Name must be at least 2 characters");
      return;
    }
    if (formName.trim().length > 50) {
      toast.error("Admin Name must not exceed 50 characters");
      return;
    }

    if (formPermissions.length === 0) {
      toast.error("Please select at least one permission");
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(buildApiUrl(API_ENDPOINTS.ADMIN_UPDATE(editDialog.admin.id)), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Wallet": adminWallet,
        },
        body: JSON.stringify({
          name: formName.trim(),
          permissions: formPermissions,
        }),
      });

      if (res.ok) {
        toast.success("Admin Updated Successfully");
        setEditDialog({ open: false, admin: null });
        setFormName("");
        setFormPermissions([]);
        fetchAdmins();
      } else {
        const err = await res.json();
        toast.error(err.message || "Failed To Update Admin");
      }
    } catch {
      toast.error("Failed To Update Admin");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveAdmin = async () => {
    if (!removeDialog.admin) return;

    setActionLoading(true);
    try {
      const res = await fetch(buildApiUrl(API_ENDPOINTS.ADMIN_DELETE(removeDialog.admin.id)), {
        method: "DELETE",
        headers: { "X-Admin-Wallet": adminWallet },
      });

      if (res.ok) {
        toast.success("Admin Removed Successfully");
        setRemoveDialog({ open: false, admin: null });
        fetchAdmins();
      } else {
        const err = await res.json();
        toast.error(err.message || "Failed To Remove Admin");
      }
    } catch {
      toast.error("Failed To Remove Admin");
    } finally {
      setActionLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied To Clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openEditDialog = (admin: Admin) => {
    setFormName(admin.name);
    setFormPermissions(admin.permissions);
    setEditDialog({ open: true, admin });
  };

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <>
      <div className="mb-20">
        <div className="mb-8">
          <div className="flex justify-between items-start md:items-center mb-8 gap-4 flex-col md:flex-row md:gap-3">
            {/* <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-2xl font-bold mb-2 gradient-text flex items-center gap-2">
                  <Shield className="w-6 h-6" />
                  Admin Access Management
                </h2>
              </div>
              <p className="text-muted-foreground max-w-2xl">
                Manage admin accounts and control access permissions. Add new administrators, assign specific permissions,
                and monitor admin activities. Only Super Admins can access this section.
              </p>
            </div> */}
            <div>
              <h2 className="text-2xl font-bold mb-2 gradient-text flex items-center gap-2">
                <Shield className="w-6 h-6" />
                Admin Access Management
              </h2>
              <p className="text-muted-foreground max-w-2xl">
                Manage admin accounts and control access permissions. Add new administrators, assign
                specific permissions, and monitor admin activities. Only Super Admins can access this
                section.
              </p>
            </div>
            <button
              onClick={() => setAddDialogOpen(true)}
              className="flex whitespace-nowrap items-center gap-2.5 bg-ocean-cyan text-background font-semibold rounded-lg px-5 py-3 hover:bg-ocean-cyan/90 hover:shadow-[0_0_30px_hsl(185_80%_55%/0.4)] transition-all"
            >
              <UserPlus className="w-5 h-5" />
              <span>Add Admin</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-card border border-border/50 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Admins</p>
                  <p className="text-2xl font-bold text-foreground">{admins.length}</p>
                </div>
                <div className="p-3 bg-ocean-cyan/10 rounded-lg">
                  <Users className="w-6 h-6 text-ocean-cyan" />
                </div>
              </div>
            </div>
            <div className="glass-card border border-border/50 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Active Permissions</p>
                  <p className="text-2xl font-bold text-foreground">
                    {admins.reduce((acc, admin) => acc + admin.permissions.length, 0)}
                  </p>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <Key className="w-6 h-6 text-blue-400" />
                </div>
              </div>
            </div>
            <div className="glass-card border border-border/50 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Last Updated</p>
                  <p className="text-2xl font-bold text-foreground">
                    {admins.length > 0 ? formatDate(admins[0].updatedAt) : "-"}
                  </p>
                </div>
                <div className="p-3 bg-purple-500/10 rounded-lg">
                  <Clock className="w-6 h-6 text-purple-400" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card border border-border/50 rounded-xl overflow-hidden">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-4">
              <Loader2 className="w-10 h-10 text-ocean-cyan animate-spin" />
              <div className="text-center">
                <p className="text-foreground font-medium mb-1">Loading administrators</p>
                <p className="text-sm text-muted-foreground">Please wait...</p>
              </div>
            </div>
          ) : admins.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center gap-4 px-6">
              <div className="p-4 bg-muted/20 rounded-full">
                <Users className="w-10 h-10 text-muted-foreground/50" />
              </div>
              <div className="text-center max-w-md">
                <p className="text-foreground font-semibold mb-2">No administrators yet</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Get started by adding your first admin. They'll be able to manage specific aspects of the platform based on the permissions you assign.
                </p>
                <button
                  onClick={() => setAddDialogOpen(true)}
                  className="inline-flex items-center gap-2 bg-ocean-cyan text-background font-semibold rounded-lg px-4 py-2 hover:bg-ocean-cyan/90 transition-all"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Add First Admin</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Desktop Table (hidden on mobile) */}
              <div className="hidden sm:block overflow-x-auto overflow-y-hidden scrollbar-visible min-w-full pb-2">
                <div className="min-w-[900px]">
                  {/* Table Header */}
                  <div className="bg-muted/20 border-b border-border/50 px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-[280px] flex-shrink-0 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Administrator
                      </div>
                      <div className="w-[200px] flex-shrink-0 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Wallet Address
                      </div>
                      <div className="flex-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Permissions
                      </div>
                      <div className="w-[120px] flex-shrink-0 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">
                        Actions
                      </div>
                    </div>
                  </div>

                  {/* Table Body */}
                  {admins.map((admin, index) => (
                    <div
                      key={admin.id}
                      className={`flex items-center gap-2 px-6 py-4 transition-colors hover:bg-ocean-cyan/5 ${
                        index !== admins.length - 1 ? "border-b border-border/30" : ""
                      }`}
                    >
                      {/* Administrator Name */}
                      <div className="w-[280px] flex-shrink-0">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-ocean-cyan to-ocean-seafoam flex items-center justify-center text-background font-bold text-sm">
                            {admin.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-foreground font-semibold text-sm whitespace-nowrap">{admin.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Added {formatDate(admin.createdAt)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Wallet Address */}
                      <div className="w-[200px] flex-shrink-0">
                        <div className="flex items-center gap-2">
                          <code className="text-sm text-muted-foreground font-mono bg-muted/30 px-2 py-1 rounded">
                            {truncateWallet(admin.walletAddress)}
                          </code>
                          <div className="relative group">
                            <button
                              onClick={() => copyToClipboard(admin.walletAddress, admin.id)}
                              className="p-1.5 rounded-md hover:bg-ocean-cyan/10 transition-all"
                            >
                              {copiedId === admin.id ? (
                                <Check className="w-3.5 h-3.5 text-green-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5 text-muted-foreground group-hover:text-ocean-cyan" />
                              )}
                            </button>
                            <div className="absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-black px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-[9999]">
                              Copy full address
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Permissions */}
                      <div className="flex-1">
                        {admin.permissions.length === 0 ? (
                          <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-yellow-500" />
                            <span className="text-sm text-muted-foreground italic">No permissions assigned</span>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {admin.permissions.map((perm) => {
                              const permInfo = ADMIN_PERMISSION_DEFINITIONS.find((p) => p.id === perm);
                              const permName = permInfo?.label || perm;
                              const colorClass = PERMISSION_COLORS[perm] || "bg-ocean-cyan/10 text-ocean-cyan border-ocean-cyan/30";
                              return (
                                <span
                                  key={perm}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${colorClass}`}
                                >
                                  <span>{permName}</span>
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="w-[120px] flex-shrink-0 flex items-center justify-center gap-1">
                        <div className="relative group">
                          <button
                            onClick={() => openEditDialog(admin)}
                            className="p-2 rounded-md hover:bg-blue-500/10 transition-all"
                          >
                            <Edit2 className="w-4 h-4 text-muted-foreground group-hover:text-blue-400" />
                          </button>
                          <div className="absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-black px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-[9999]">
                            Edit permissions
                          </div>
                        </div>
                        <div className="relative group">
                          <button
                            onClick={() => setRemoveDialog({ open: true, admin })}
                            className="p-2 rounded-md hover:bg-destructive/10 transition-all"
                          >
                            <Trash2 className="w-4 h-4 text-muted-foreground group-hover:text-destructive" />
                          </button>
                          <div className="absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-black px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-[9999]">
                            Remove admin
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mobile Cards (hidden on desktop) */}
              <div className="sm:hidden space-y-3 p-4">
                {admins.map((admin) => (
                  <div
                    key={admin.id}
                    className="border border-border/30 rounded-lg p-4 hover:bg-ocean-cyan/5 hover:border-ocean-cyan/30 transition-all"
                  >
                    {/* Admin Info */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-ocean-cyan to-ocean-seafoam flex items-center justify-center text-background font-bold text-sm">
                        {admin.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="text-foreground font-semibold text-sm">{admin.name}</p>
                        <p className="text-xs text-muted-foreground">Added {formatDate(admin.createdAt)}</p>
                      </div>
                    </div>

                    {/* Wallet Address */}
                    <div className="mb-3">
                      <div className="flex items-center gap-2">
                        <code className="text-xs text-muted-foreground font-mono bg-muted/30 px-2 py-1 rounded flex-1 truncate">
                          {admin.walletAddress}
                        </code>
                        <div className="relative group flex-shrink-0">
                          <button
                            onClick={() => copyToClipboard(admin.walletAddress, admin.id)}
                            className="p-1.5 rounded-md hover:bg-ocean-cyan/10 transition-all"
                          >
                            {copiedId === admin.id ? (
                              <Check className="w-3.5 h-3.5 text-green-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-muted-foreground group-hover:text-ocean-cyan" />
                            )}
                          </button>
                          <div className="absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-black px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-[9999]">
                            Copy full address
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Permissions */}
                    <div className="mb-3">
                      {admin.permissions.length === 0 ? (
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-yellow-500" />
                          <span className="text-xs text-muted-foreground italic">No permissions</span>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {admin.permissions.map((perm) => {
                            const permInfo = ADMIN_PERMISSION_DEFINITIONS.find((p) => p.id === perm);
                            const permName = permInfo?.label || perm;
                            const colorClass = PERMISSION_COLORS[perm] || "bg-ocean-cyan/10 text-ocean-cyan border-ocean-cyan/30";
                            return (
                              <span
                                key={perm}
                                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border ${colorClass}`}
                              >
                                <span>{permName}</span>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-3 border-t border-border/30">
                      <button
                        onClick={() => openEditDialog(admin)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-all text-sm font-medium"
                      >
                        <Edit2 className="w-4 h-4" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => setRemoveDialog({ open: true, admin })}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-destructive/10 hover:bg-destructive/20 text-destructive transition-all text-sm font-medium"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="glass-card border-border/50 max-w-md">
          <DialogHeader>
            <DialogTitle className="gradient-text">Add New Administrator</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Create a new admin account with custom permissions for platform management.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="admin-name">Admin Name *</Label>
                <span
                  className={`text-xs ${
                    formName.length > 50 ? "text-destructive" : "text-muted-foreground"
                  }`}
                >
                  {formName.length}/50
                </span>
              </div>
              <Input
                id="admin-name"
                placeholder="e.g., John Doe"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                maxLength={50}
                className="bg-muted/50 border border-border/50 focus:outline-none focus:border-ocean-cyan/50 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <p className="text-xs text-muted-foreground">Minimum 2 characters required</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wallet-address">Wallet Address *</Label>
              <Input
                id="wallet-address"
                placeholder="Enter Solana wallet address"
                value={formWallet}
                onChange={(e) => setFormWallet(e.target.value)}
                className="bg-muted/50 border border-border/50 font-mono focus:outline-none focus:border-ocean-cyan/50 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <p className="text-xs text-muted-foreground">
                Valid Solana wallet address (base58 format, 32-44 characters)
              </p>
            </div>

            <div className="space-y-2">
              <Label>Assign Permissions *</Label>
              <PermissionChecklist value={formPermissions} onChange={setFormPermissions} />
              <p className="text-xs text-muted-foreground">Select at least one permission</p>
            </div>

            <Button
              onClick={handleAddAdmin}
              disabled={actionLoading || !formName.trim() || !formWallet.trim()}
              className="w-full bg-ocean-cyan text-background hover:bg-ocean-cyan/90"
            >
              {actionLoading ? "Adding..." : "Add Administrator"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editDialog.open}
        onOpenChange={(open) => !open && setEditDialog({ open: false, admin: null })}
      >
        <DialogContent className="glass-card border-border/50 max-w-md">
          <DialogHeader>
            <DialogTitle className="gradient-text">Edit Administrator</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Update admin details and permissions. Changes take effect immediately.
            </DialogDescription>
          </DialogHeader>

          {editDialog.admin && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="edit-admin-name">Admin Name *</Label>
                  <span
                    className={`text-xs ${
                      formName.length > 50 ? "text-destructive" : "text-muted-foreground"
                    }`}
                  >
                    {formName.length}/50
                  </span>
                </div>
                <Input
                  id="edit-admin-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  maxLength={50}
                  className="bg-muted/50 border border-border/50 focus:outline-none focus:border-ocean-cyan/50 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <p className="text-xs text-muted-foreground">Minimum 2 characters required</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-wallet-address">Wallet Address</Label>
                <Input
                  id="edit-wallet-address"
                  value={truncateWallet(editDialog.admin.walletAddress)}
                  disabled
                  className="bg-muted/20 border border-border/30 font-mono text-muted-foreground cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground">
                  Wallet address cannot be changed for security reasons
                </p>
              </div>

              <div className="space-y-2">
                <Label>Update Permissions *</Label>
                <PermissionChecklist value={formPermissions} onChange={setFormPermissions} />
                <p className="text-xs text-muted-foreground">Select at least one permission</p>
              </div>

              <Button
                onClick={handleEditAdmin}
                disabled={actionLoading || !formName.trim()}
                className="w-full bg-ocean-cyan text-background hover:bg-ocean-cyan/90"
              >
                {actionLoading ? "Updating..." : "Save Changes"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={removeDialog.open}
        onOpenChange={(open) => !open && setRemoveDialog({ open: false, admin: null })}
      >
        <DialogContent className="glass-card border-destructive/30 max-w-sm shadow-[0px_4px_4px_0px_rgba(220,38,38,0.20)]">
          <DialogHeader className="text-center space-y-3 pt-2">
            <div className="w-12 h-12 rounded-full bg-destructive/10 border border-destructive/30 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6 text-destructive" />
            </div>
            <DialogTitle className="gradient-text text-center">Remove Administrator?</DialogTitle>
            <DialogDescription className="text-muted-foreground text-center">
              Are you sure you want to remove <span className="text-foreground font-medium">{removeDialog.admin?.name}</span>? They will lose all access to the admin panel.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setRemoveDialog({ open: false, admin: null })}
              className="flex-1 border-border/50"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRemoveAdmin}
              disabled={actionLoading}
              className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading ? "Removing..." : "Remove"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AdminManagement;
