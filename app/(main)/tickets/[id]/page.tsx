import { redirect } from "next/navigation";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { sessionOptions, type SessionDataHelpdesk } from "@/lib/sessionOption";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function isPrivilegedRole(role: string | undefined) {
  const r = (role ?? "").toUpperCase();
  return r === "ADMIN" || r === "IT_STAFF";
}

function PriorityBadge({ priority }: { priority: any }) {
  if (!priority) return <span className="text-slate-500">-</span>;
  const cls =
    priority === "LOW"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200"
      : priority === "MEDIUM"
        ? "border-green-200 bg-green-50 text-green-700 dark:border-green-900/40 dark:bg-green-950/40 dark:text-green-200"
        : priority === "HIGH"
          ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200"
          : "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200";
  return (
    <Badge variant="outline" className={cls}>
      {priority}
    </Badge>
  );
}

function StatusBadge({ status }: { status: any }) {
  const cls =
    status === "PENDING_APPROVAL"
      ? "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200"
      : status === "APPROVED"
        ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-200"
        : status === "IN_PROGRESS"
          ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200"
          : status === "RESOLVED"
            ? "border-green-200 bg-green-50 text-green-700 dark:border-green-900/40 dark:bg-green-950/40 dark:text-green-200"
            : status === "CLOSED"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200"
              : "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200";
  return (
    <Badge variant="outline" className={cls}>
      {status}
    </Badge>
  );
}

export default async function TicketDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getIronSession<SessionDataHelpdesk>(await cookies(), sessionOptions);

  if (!session.isLoggedIn || !session.userId) {
    redirect("/sign-in");
  }

  const backHref = isPrivilegedRole(session.role) ? "/ticket-management" : "/tickets";

  const where: any = { id, isDeleted: false };
  if (!isPrivilegedRole(session.role)) {
    where.OR = [{ createdById: session.userId }, { assignedToId: session.userId }];
  }

  const ticket = await prisma.ticket.findFirst({
    where,
    select: {
      id: true,
      ticketNo: true,
      title: true,
      description: true,
      priority: true,
      status: true,
      createdAt: true,
      category: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
      attachments: { select: { id: true, fileName: true, filePath: true, mimeType: true, uploadedAt: true } },
    },
  });

  if (!ticket) {
    redirect("/unauthorized?route=/tickets");
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Ticket {ticket.ticketNo}</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">Full ticket details</p>
        </div>
        <Button asChild variant="outline">
          <Link href={backHref} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Ticket Management
          </Link>
        </Button>
      </div>

      <Card className="border-0 shadow-lg bg-white dark:bg-slate-950/40">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-xl">{ticket.title}</span>
            <div className="flex items-center gap-2">
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Description</p>
            <p className="mt-2 text-base text-slate-800 dark:text-slate-100 whitespace-pre-wrap break-words">
              {ticket.description}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950/40">
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Category</p>
              <p className="mt-1 text-base font-medium text-slate-900 dark:text-white">{ticket.category.name}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950/40">
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Created By</p>
              <p className="mt-1 text-base font-medium text-slate-900 dark:text-white">{ticket.createdBy.name}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950/40">
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Assigned To</p>
              <p className="mt-1 text-base font-medium text-slate-900 dark:text-white">{ticket.assignedTo?.name ?? "Not assigned"}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950/40">
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Created</p>
              <p className="mt-1 text-base font-medium text-slate-900 dark:text-white">{ticket.createdAt.toLocaleString()}</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950/40">
            <p className="text-lg font-bold text-slate-900 dark:text-white">Attachments</p>
            {ticket.attachments.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">No attachments.</p>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                {ticket.attachments.map((a) => (
                  <a
                    key={a.id}
                    href={a.filePath}
                    target="_blank"
                    rel="noreferrer"
                    className="group rounded-xl border border-slate-200 bg-white p-2 shadow-sm hover:shadow-md dark:border-slate-700 dark:bg-slate-950/40"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.filePath} alt={a.fileName} className="h-36 w-full rounded-lg object-cover" />
                    <p className="mt-2 truncate text-sm text-slate-700 dark:text-slate-200">{a.fileName}</p>
                  </a>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


