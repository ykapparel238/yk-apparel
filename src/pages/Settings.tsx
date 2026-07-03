import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { createSettingsUser, fetchSettings, updateDepartment, updateDesktopDevice, updateSettingsUser, updateShift } from "@/lib/services";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pencil, Plus, Shield } from "lucide-react";
import { useState } from "react";
import { type FieldValues, type Path, type UseFormReturn, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const departmentSchema = z.object({
  head: z.string().min(2),
  staff: z.coerce.number().int().min(0),
  lines: z.coerce.number().int().min(0),
});
const shiftSchema = z.object({
  supervisor: z.string().min(2),
  headcount: z.coerce.number().int().min(0),
});
const userSchema = z.object({
  role: z.string().min(1),
  status: z.enum(["ACTIVE", "INACTIVE"]),
  departmentCode: z.string().optional(),
  shiftCode: z.string().optional(),
});
const createUserSchema = userSchema.extend({
  name: z.string().trim().min(2, "Name is required"),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
const desktopDeviceSchema = z.object({
  status: z.enum(["ACTIVE", "RESTRICTED", "LOCKED", "REVOKED"]),
  rebuildRequired: z.boolean().default(false),
});

type EditorState =
  | { kind: "department"; item: { id: string; name: string; head: string; staff: number; lines: number } }
  | { kind: "shift"; item: { id: string; name: string; supervisor: string; headcount: number } }
  | { kind: "user"; item: { id: string; name: string; role: string; status: string; departmentCode?: string | null; shiftCode?: string | null } }
  | { kind: "userCreate"; item: null }
  | { kind: "desktopDevice"; item: { id: string; clientVersion: string; workspaceId: string; status: string; rebuildRequired: boolean; lastSeenAt: string; conflicts: number } }
  | null;

const roleOptions = [
  "ADMIN",
  "FACTORY_MANAGER",
  "PRODUCTION_PLANNER",
  "MERCHANDISER",
  "QA_MANAGER",
  "STORE_MANAGER",
  "LINE_SUPERVISOR",
  "VENDOR_MANAGER",
  "DISPATCH_MANAGER",
];

function getEditorId(editor: EditorState, kind: NonNullable<EditorState>["kind"]) {
  if (!editor || editor.kind !== kind) {
    throw new Error(`No ${kind} selected`);
  }
  return editor.item.id;
}

export default function Settings() {
  const [editor, setEditor] = useState<EditorState>(null);
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
  });

  const departmentForm = useForm<z.infer<typeof departmentSchema>>({
    resolver: zodResolver(departmentSchema),
    defaultValues: { head: "", staff: 0, lines: 0 },
  });
  const shiftForm = useForm<z.infer<typeof shiftSchema>>({
    resolver: zodResolver(shiftSchema),
    defaultValues: { supervisor: "", headcount: 0 },
  });
  const userForm = useForm<z.infer<typeof userSchema>>({
    resolver: zodResolver(userSchema),
    defaultValues: { role: "", status: "ACTIVE", departmentCode: "", shiftCode: "" },
  });
  const createUserForm = useForm<z.infer<typeof createUserSchema>>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { name: "", email: "", password: "", role: "MERCHANDISER", status: "ACTIVE", departmentCode: "", shiftCode: "" },
  });
  const desktopDeviceForm = useForm<z.infer<typeof desktopDeviceSchema>>({
    resolver: zodResolver(desktopDeviceSchema),
    defaultValues: { status: "ACTIVE", rebuildRequired: false },
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["settings"] });
  };

  const departmentMutation = useMutation({
    mutationFn: (values: z.infer<typeof departmentSchema>) => updateDepartment(getEditorId(editor, "department"), values),
    onSuccess: async () => {
      toast.success("Department updated");
      setEditor(null);
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to update department"),
  });
  const shiftMutation = useMutation({
    mutationFn: (values: z.infer<typeof shiftSchema>) => updateShift(getEditorId(editor, "shift"), values),
    onSuccess: async () => {
      toast.success("Shift updated");
      setEditor(null);
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to update shift"),
  });
  const userMutation = useMutation({
    mutationFn: (values: z.infer<typeof userSchema>) =>
      updateSettingsUser(getEditorId(editor, "user"), {
        role: values.role,
        status: values.status,
        departmentCode: values.departmentCode || null,
        shiftCode: values.shiftCode || null,
      }),
    onSuccess: async () => {
      toast.success("User updated");
      setEditor(null);
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to update user"),
  });
  const createUserMutation = useMutation({
    mutationFn: (values: z.infer<typeof createUserSchema>) =>
      createSettingsUser({
        name: values.name,
        email: values.email,
        password: values.password,
        role: values.role,
        status: values.status,
        departmentCode: values.departmentCode || null,
        shiftCode: values.shiftCode || null,
      }),
    onSuccess: async () => {
      toast.success("User created");
      setEditor(null);
      createUserForm.reset({ name: "", email: "", password: "", role: "MERCHANDISER", status: "ACTIVE", departmentCode: "", shiftCode: "" });
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to create user"),
  });
  const desktopDeviceMutation = useMutation({
    mutationFn: (values: z.infer<typeof desktopDeviceSchema>) => updateDesktopDevice(getEditorId(editor, "desktopDevice"), values),
    onSuccess: async () => {
      toast.success("Desktop device updated");
      setEditor(null);
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to update desktop device"),
  });

  if (settingsQuery.isLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading settings...</div>;
  }

  if (settingsQuery.isError || !settingsQuery.data) {
    return <div className="p-8 text-center text-sm text-destructive">Unable to load settings.</div>;
  }

  const { departments, shifts, users, auditLog } = settingsQuery.data;

  const openEditor = (next: EditorState) => {
    setEditor(next);
    if (!next) return;
    if (next.kind === "department") {
      departmentForm.reset({ head: next.item.head, staff: next.item.staff, lines: next.item.lines });
    } else if (next.kind === "shift") {
      shiftForm.reset({ supervisor: next.item.supervisor, headcount: next.item.headcount });
    } else if (next.kind === "user") {
      userForm.reset({
        role: roleOptions.find((role) => role === next.item.role.replaceAll(" ", "_").toUpperCase()) ?? "MERCHANDISER",
        status: next.item.status === "Active" ? "ACTIVE" : "INACTIVE",
        departmentCode: next.item.departmentCode ?? "",
        shiftCode: next.item.shiftCode ?? "",
      });
    } else if (next.kind === "userCreate") {
      createUserForm.reset({ name: "", email: "", password: "", role: "MERCHANDISER", status: "ACTIVE", departmentCode: "", shiftCode: "" });
    } else {
      desktopDeviceForm.reset({
        status: next.item.status as "ACTIVE" | "RESTRICTED" | "LOCKED" | "REVOKED",
        rebuildRequired: next.item.rebuildRequired,
      });
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Configuration"
        title="Settings"
        description="Departments, shifts, users, roles and audit trail"
        actions={
          <Button size="sm" className="h-9" onClick={() => openEditor({ kind: "userCreate", item: null })}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Add User
          </Button>
        }
      />

      <Tabs defaultValue="departments">
        <TabsList className="mb-4">
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="shifts">Shifts</TabsTrigger>
          <TabsTrigger value="users">Users & Roles</TabsTrigger>
          <TabsTrigger value="desktop">Desktop Devices</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="departments">
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr className="text-left">
                  <th className="px-4 py-3 font-semibold">Code</th>
                  <th className="px-4 py-3 font-semibold">Department</th>
                  <th className="px-4 py-3 font-semibold">Head</th>
                  <th className="px-4 py-3 font-semibold text-right">Staff</th>
                  <th className="px-4 py-3 font-semibold text-right">Lines</th>
                  <th className="px-4 py-3 font-semibold w-10"></th>
                </tr>
              </thead>
              <tbody>
                {departments.map((department) => (
                  <tr key={department.id} className="data-table-row">
                    <td className="px-4 py-3 font-mono-num text-xs">{department.id}</td>
                    <td className="px-4 py-3 font-medium">{department.name}</td>
                    <td className="px-4 py-3">{department.head}</td>
                    <td className="px-4 py-3 text-right font-mono-num">{department.staff}</td>
                    <td className="px-4 py-3 text-right font-mono-num">{department.lines}</td>
                    <td className="px-2 py-3 text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditor({ kind: "department", item: department })}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="shifts">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {shifts.map((shift) => (
              <div key={shift.id} className="bg-card border border-border rounded-lg p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono-num">{shift.id}</div>
                    <h3 className="font-semibold mt-1">{shift.name}</h3>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditor({ kind: "shift", item: shift })}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono-num">{shift.start}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="text-2xl font-bold font-mono-num">{shift.end}</span>
                </div>
                <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-muted-foreground text-[10px] uppercase tracking-wider">Supervisor</div>
                    <div className="font-medium mt-0.5">{shift.supervisor}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-[10px] uppercase tracking-wider">Headcount</div>
                    <div className="font-mono-num font-semibold mt-0.5">{shift.headcount}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="users">
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="p-4 border-b border-border flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="h-3.5 w-3.5" /> Role-based access — {users.length} configured users
            </div>
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr className="text-left">
                  <th className="px-4 py-3 font-semibold">User ID</th>
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Last Active</th>
                  <th className="px-4 py-3 font-semibold w-10"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="data-table-row">
                    <td className="px-4 py-3 font-mono-num text-xs">{user.id}</td>
                    <td className="px-4 py-3 font-medium">{user.name}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{user.email}</td>
                    <td className="px-4 py-3"><span className="px-2 py-0.5 text-[11px] font-medium rounded bg-primary-soft text-primary">{user.role}</span></td>
                    <td className="px-4 py-3"><StatusBadge status={user.status} /></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono-num">{user.last}</td>
                    <td className="px-2 py-3 text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditor({ kind: "user", item: user })}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="desktop">
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="p-4 border-b border-border flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="h-3.5 w-3.5" /> Desktop device trust, access state, and rebuild controls
            </div>
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr className="text-left">
                  <th className="px-4 py-3 font-semibold">Device ID</th>
                  <th className="px-4 py-3 font-semibold">Client</th>
                  <th className="px-4 py-3 font-semibold">Workspace</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Rebuild</th>
                  <th className="px-4 py-3 font-semibold text-right">Conflicts</th>
                  <th className="px-4 py-3 font-semibold">Last Seen</th>
                  <th className="px-4 py-3 font-semibold w-10"></th>
                </tr>
              </thead>
              <tbody>
                {(settingsQuery.data.desktopDevices ?? []).map((device) => (
                  <tr key={device.id} className="data-table-row">
                    <td className="px-4 py-3 font-mono-num text-[11px]">{device.id.slice(0, 12)}...</td>
                    <td className="px-4 py-3">{device.clientVersion}</td>
                    <td className="px-4 py-3">{device.workspaceId}</td>
                    <td className="px-4 py-3"><StatusBadge status={device.status} /></td>
                    <td className="px-4 py-3">{device.rebuildRequired ? "Required" : "No"}</td>
                    <td className="px-4 py-3 text-right font-mono-num">{device.conflicts}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{device.lastSeenAt}</td>
                    <td className="px-2 py-3 text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditor({ kind: "desktopDevice", item: device })}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {!(settingsQuery.data.desktopDevices ?? []).length ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No desktop devices registered yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="audit">
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr className="text-left">
                  <th className="px-4 py-3 font-semibold">Timestamp</th>
                  <th className="px-4 py-3 font-semibold">Actor</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                  <th className="px-4 py-3 font-semibold">Target</th>
                  <th className="px-4 py-3 font-semibold">Module</th>
                </tr>
              </thead>
              <tbody>
                {auditLog.map((item) => (
                  <tr key={item.id} className="data-table-row">
                    <td className="px-4 py-3 text-xs font-mono-num text-muted-foreground">{item.ts}</td>
                    <td className="px-4 py-3 font-medium">{item.actor}</td>
                    <td className="px-4 py-3">{item.action}</td>
                    <td className="px-4 py-3 text-xs">{item.target}</td>
                    <td className="px-4 py-3"><span className="px-1.5 py-0.5 bg-muted rounded text-[11px]">{item.module}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(editor)} onOpenChange={(open) => !open && setEditor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editor?.kind === "userCreate" ? "Add User" : "Edit Settings"}</DialogTitle>
            <DialogDescription>
              {editor?.kind === "userCreate" ? "Create a user account and assign role access." : editor ? `Update ${editor.kind} settings.` : "Update settings."}
            </DialogDescription>
          </DialogHeader>
          {editor?.kind === "department" ? (
            <Form {...departmentForm}>
              <form onSubmit={departmentForm.handleSubmit((values) => departmentMutation.mutate(values))} className="space-y-4">
                <SimpleField form={departmentForm} name="head" label="Department Head" disabled={departmentMutation.isPending} />
                <SimpleField form={departmentForm} name="staff" label="Staff Count" type="number" disabled={departmentMutation.isPending} />
                <SimpleField form={departmentForm} name="lines" label="Line Count" type="number" disabled={departmentMutation.isPending} />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setEditor(null)}>Cancel</Button>
                  <Button type="submit" disabled={departmentMutation.isPending}>{departmentMutation.isPending ? "Saving..." : "Save Changes"}</Button>
                </DialogFooter>
              </form>
            </Form>
          ) : editor?.kind === "shift" ? (
            <Form {...shiftForm}>
              <form onSubmit={shiftForm.handleSubmit((values) => shiftMutation.mutate(values))} className="space-y-4">
                <SimpleField form={shiftForm} name="supervisor" label="Supervisor" disabled={shiftMutation.isPending} />
                <SimpleField form={shiftForm} name="headcount" label="Headcount" type="number" disabled={shiftMutation.isPending} />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setEditor(null)}>Cancel</Button>
                  <Button type="submit" disabled={shiftMutation.isPending}>{shiftMutation.isPending ? "Saving..." : "Save Changes"}</Button>
                </DialogFooter>
              </form>
            </Form>
          ) : editor?.kind === "user" ? (
            <Form {...userForm}>
              <form onSubmit={userForm.handleSubmit((values) => userMutation.mutate(values))} className="space-y-4">
                <FormField control={userForm.control} name="role" render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs font-medium">Role</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={userMutation.isPending}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{roleOptions.map((role) => <SelectItem key={role} value={role}>{role.replaceAll("_", " ")}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )} />
                <FormField control={userForm.control} name="status" render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs font-medium">Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={userMutation.isPending}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="INACTIVE">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )} />
                <FormField control={userForm.control} name="departmentCode" render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs font-medium">Department</FormLabel>
                    <Select value={field.value || "__none"} onValueChange={(value) => field.onChange(value === "__none" ? "" : value)} disabled={userMutation.isPending}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="__none">None</SelectItem>
                        {departments.map((department) => <SelectItem key={department.id} value={department.id}>{department.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )} />
                <FormField control={userForm.control} name="shiftCode" render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs font-medium">Shift</FormLabel>
                    <Select value={field.value || "__none"} onValueChange={(value) => field.onChange(value === "__none" ? "" : value)} disabled={userMutation.isPending}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="__none">None</SelectItem>
                        {shifts.map((shift) => <SelectItem key={shift.id} value={shift.id}>{shift.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )} />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setEditor(null)}>Cancel</Button>
                  <Button type="submit" disabled={userMutation.isPending}>{userMutation.isPending ? "Saving..." : "Save Changes"}</Button>
                </DialogFooter>
              </form>
            </Form>
          ) : editor?.kind === "userCreate" ? (
            <Form {...createUserForm}>
              <form onSubmit={createUserForm.handleSubmit((values) => createUserMutation.mutate(values))} className="space-y-4">
                <SimpleField form={createUserForm} name="name" label="Name" disabled={createUserMutation.isPending} />
                <SimpleField form={createUserForm} name="email" label="Email" type="email" disabled={createUserMutation.isPending} />
                <SimpleField form={createUserForm} name="password" label="Temporary Password" type="password" disabled={createUserMutation.isPending} />
                <FormField control={createUserForm.control} name="role" render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs font-medium">Role</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={createUserMutation.isPending}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{roleOptions.map((role) => <SelectItem key={role} value={role}>{role.replaceAll("_", " ")}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )} />
                <FormField control={createUserForm.control} name="status" render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs font-medium">Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={createUserMutation.isPending}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="INACTIVE">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )} />
                <FormField control={createUserForm.control} name="departmentCode" render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs font-medium">Department</FormLabel>
                    <Select value={field.value || "__none"} onValueChange={(value) => field.onChange(value === "__none" ? "" : value)} disabled={createUserMutation.isPending}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="__none">None</SelectItem>
                        {departments.map((department) => <SelectItem key={department.id} value={department.id}>{department.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )} />
                <FormField control={createUserForm.control} name="shiftCode" render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs font-medium">Shift</FormLabel>
                    <Select value={field.value || "__none"} onValueChange={(value) => field.onChange(value === "__none" ? "" : value)} disabled={createUserMutation.isPending}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="__none">None</SelectItem>
                        {shifts.map((shift) => <SelectItem key={shift.id} value={shift.id}>{shift.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )} />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setEditor(null)}>Cancel</Button>
                  <Button type="submit" disabled={createUserMutation.isPending}>{createUserMutation.isPending ? "Creating..." : "Create User"}</Button>
                </DialogFooter>
              </form>
            </Form>
          ) : editor?.kind === "desktopDevice" ? (
            <Form {...desktopDeviceForm}>
              <form onSubmit={desktopDeviceForm.handleSubmit((values) => desktopDeviceMutation.mutate(values))} className="space-y-4">
                <FormField control={desktopDeviceForm.control} name="status" render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs font-medium">Access State</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={desktopDeviceMutation.isPending}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                        <SelectItem value="RESTRICTED">RESTRICTED</SelectItem>
                        <SelectItem value="LOCKED">LOCKED</SelectItem>
                        <SelectItem value="REVOKED">REVOKED</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )} />
                <FormField control={desktopDeviceForm.control} name="rebuildRequired" render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs font-medium">Rebuild Required</FormLabel>
                    <Select value={field.value ? "yes" : "no"} onValueChange={(value) => field.onChange(value === "yes")} disabled={desktopDeviceMutation.isPending}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="no">No</SelectItem>
                        <SelectItem value="yes">Yes</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )} />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setEditor(null)}>Cancel</Button>
                  <Button type="submit" disabled={desktopDeviceMutation.isPending}>{desktopDeviceMutation.isPending ? "Saving..." : "Save Changes"}</Button>
                </DialogFooter>
              </form>
            </Form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SimpleField<TFieldValues extends FieldValues>({
  form,
  name,
  label,
  type = "text",
  disabled = false,
}: {
  form: UseFormReturn<TFieldValues>;
  name: Path<TFieldValues>;
  label: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className="space-y-1.5">
          <FormLabel className="text-xs font-medium">{label}</FormLabel>
          <FormControl>
            <Input type={type} disabled={disabled} {...field} />
          </FormControl>
          <FormMessage className="text-[11px]" />
        </FormItem>
      )}
    />
  );
}
