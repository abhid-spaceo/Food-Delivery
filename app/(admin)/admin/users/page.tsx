import { prisma } from "@/lib/db";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/app/(admin)/_components/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/app/(admin)/_components/table";

// Admin Users ("/admin/users", S16). Lists all users; optional ?q= filters by
// email (case-insensitive contains). Search is a plain GET form -> query param.
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const users = await prisma.user.findMany({
    where: query
      ? { email: { contains: query, mode: "insensitive" } }
      : undefined,
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, email: true, role: true },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black tracking-tight">Users</h1>
        <form method="get" className="flex items-center gap-2">
          <Input
            type="search"
            name="q"
            placeholder="Search by email"
            defaultValue={query}
            aria-label="Search by email"
            className="w-56"
          />
          <Button type="submit" size="sm" variant="outline">
            Search
          </Button>
        </form>
      </div>

      {users.length === 0 ? (
        <p className="text-sm text-muted-foreground">No users match this search.</p>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Email</TH>
              <TH>Role</TH>
            </TR>
          </THead>
          <TBody>
            {users.map((u) => (
              <TR key={u.id}>
                <TD className="font-semibold">{u.name ?? "—"}</TD>
                <TD className="text-muted-foreground">{u.email}</TD>
                <TD>
                  <Badge value={u.role} />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
