'use client';

import { useEffect, useMemo, useState } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

type StudentSnapshot = {
    device_id: string;
    hr?: number | null;
    skt?: number | null;
    gsr?: number | null;
    hr_diff?: number | null;
    gsr_diff?: number | null;
    wearableStatus: string;
    cameraStatus: string;
    finalStatus: string;
};

type AttentionSnapshot = {
    id: string;
    snapshotDate: string;
    capturedAt: string;
    intervalMinutes: number;
    students: StudentSnapshot[];
};

function today() {
    return new Date().toISOString().slice(0, 10);
}

function statusClass(status: string) {
    return status === "Inattentive"
        ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        : status === "Attentive"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
            : "border-muted bg-muted/40 text-muted-foreground";
}

function formatValue(value?: number | null) {
    return value ?? "--";
}

export default function Page() {
    const [date, setDate] = useState(today());
    const [snapshots, setSnapshots] = useState<AttentionSnapshot[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();

        async function loadSnapshots() {
            setIsLoading(true);
            setError(null);

            try {
                const params = new URLSearchParams({ date });
                const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/snapshots?${params}`, {
                    headers: {
                        "X-Viewer-Token": process.env.NEXT_PUBLIC_VIEWER_TOKEN ?? "",
                    },
                    signal: controller.signal,
                });

                if (!response.ok) {
                    const payload = await response.json().catch(() => null);
                    throw new Error(payload?.error ?? "Failed to load snapshots");
                }

                const payload = await response.json();
                const nextSnapshots = payload.snapshots ?? [];
                setSnapshots(nextSnapshots);
                setSelectedId(nextSnapshots[0]?.id ?? null);
            } catch (e) {
                if (e instanceof DOMException && e.name === "AbortError") {
                    return;
                }
                setError(e instanceof Error ? e.message : "Failed to load snapshots");
                setSnapshots([]);
                setSelectedId(null);
            } finally {
                setIsLoading(false);
            }
        }

        loadSnapshots();

        return () => controller.abort();
    }, [date]);

    const selectedSnapshot = useMemo(
        () => snapshots.find((snapshot) => snapshot.id === selectedId) ?? snapshots[0],
        [selectedId, snapshots]
    );

    const inattentiveCount = selectedSnapshot?.students.filter(
        (student) => student.finalStatus === "Inattentive"
    ).length ?? 0;

    return (
        <SidebarProvider
            style={{
                "--sidebar-width": "18rem",
                "--header-height": "3rem",
            } as React.CSSProperties}
        >
            <AppSidebar variant="inset" />
            <SidebarInset>
                <SiteHeader />
                <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
                    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Seven-minute persistence</p>
                            <h1 className="text-2xl font-semibold tracking-tight">Attention Snapshots</h1>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <Input
                                aria-label="Snapshot date"
                                type="date"
                                value={date}
                                onChange={(event) => setDate(event.target.value)}
                                className="w-full sm:w-44"
                            />
                            <Button variant="outline" onClick={() => setDate(today())}>Today</Button>
                        </div>
                    </div>

                    {error && (
                        <Card className="border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                            <CardContent className="pt-6 text-sm">{error}</CardContent>
                        </Card>
                    )}

                    <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
                        <Card>
                            <CardHeader>
                                <CardTitle>Timeline</CardTitle>
                                <CardDescription>
                                    {isLoading ? "Loading snapshots..." : `${snapshots.length} saved snapshots`}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-2 max-h-[calc(100vh-18rem)] overflow-y-auto scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                                {snapshots.length === 0 && !isLoading ? (
                                    <p className="text-sm text-muted-foreground">No snapshots saved for this date.</p>
                                ) : snapshots.map((snapshot) => (
                                    <Button
                                        key={snapshot.id}
                                        variant={snapshot.id === selectedSnapshot?.id ? "default" : "outline"}
                                        className="justify-start"
                                        onClick={() => setSelectedId(snapshot.id)}
                                    >
                                        {new Date(snapshot.capturedAt).toLocaleTimeString([], {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                    </Button>
                                ))}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <CardTitle>
                                        {selectedSnapshot
                                            ? new Date(selectedSnapshot.capturedAt).toLocaleString()
                                            : "No Snapshot Selected"}
                                    </CardTitle>
                                    <CardDescription>
                                        Snapshot interval: {selectedSnapshot?.intervalMinutes ?? 7} minutes
                                    </CardDescription>
                                </div>
                                <Badge variant="outline" className={statusClass(inattentiveCount > 0 ? "Inattentive" : "Attentive")}>
                                    {inattentiveCount} inattentive
                                </Badge>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-hidden rounded-lg border">
                                    <Table>
                                        <TableHeader className="bg-muted">
                                            <TableRow>
                                                <TableHead>Student</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Wearable</TableHead>
                                                <TableHead>Camera</TableHead>
                                                <TableHead>HR</TableHead>
                                                <TableHead>GSR</TableHead>
                                                <TableHead>HR Diff</TableHead>
                                                <TableHead>GSR Diff</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {selectedSnapshot?.students.length ? selectedSnapshot.students.map((student) => (
                                                <TableRow key={student.device_id}>
                                                    <TableCell className="font-medium">{student.device_id}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className={statusClass(student.finalStatus)}>
                                                            {student.finalStatus}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>{student.wearableStatus}</TableCell>
                                                    <TableCell>{student.cameraStatus}</TableCell>
                                                    <TableCell>{formatValue(student.hr)}</TableCell>
                                                    <TableCell>{formatValue(student.gsr)}</TableCell>
                                                    <TableCell>{formatValue(student.hr_diff)}</TableCell>
                                                    <TableCell>{formatValue(student.gsr_diff)}</TableCell>
                                                </TableRow>
                                            )) : (
                                                <TableRow>
                                                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                                                        Select a snapshot to view student attention.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}
