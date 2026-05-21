'use client';

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useEffect, useRef } from 'react';
import { useSocket } from "@/contexts/SocketContext";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

/* ── Behavior colour & display map (mirrors data-hub palette) ── */
const BEHAVIOR_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
    looking_away: { label: 'Looking Away', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-950/50', dot: 'bg-blue-500' },
    looking_forward: { label: 'Looking Forward', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-950/50', dot: 'bg-emerald-500' },
    phone_use: { label: 'Phone Use', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-950/50', dot: 'bg-orange-500' },
    raising_hand: { label: 'Raising Hand', color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-100 dark:bg-sky-950/50', dot: 'bg-sky-500' },
    reading_writing: { label: 'Reading/Writing', color: 'text-pink-600 dark:text-pink-400', bg: 'bg-pink-100 dark:bg-pink-950/50', dot: 'bg-pink-500' },
    sleeping: { label: 'Sleeping', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-950/50', dot: 'bg-amber-500' },
    standing: { label: 'Standing', color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-950/50', dot: 'bg-violet-500' },
    talking: { label: 'Talking', color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-100 dark:bg-teal-950/50', dot: 'bg-teal-500' },
};

const INATTENTIVE_BEHAVIORS = ['looking_away', 'phone_use', 'sleeping', 'standing', 'talking'];

export default function Page() {
    const { isConnected, socket, studentStatusMap } = useSocket();
    const imageRef = useRef<HTMLImageElement>(null);

    /* Video frame handler (page-specific, not in context) */
    useEffect(() => {
        if (!socket) return;

        const onVideoFeed = (data: { image: ArrayBuffer }) => {
            const blob = new Blob([data.image], { type: "image/jpeg" });
            const url = URL.createObjectURL(blob);

            if (imageRef.current) {
                if (imageRef.current.src) {
                    URL.revokeObjectURL(imageRef.current.src);
                }
                imageRef.current.src = url;
            }
        };

        socket.on('video_feed', onVideoFeed);

        return () => {
            socket.off('video_feed', onVideoFeed);
        };
    }, [socket]);

    /*  Build 5-zone card data from context */
    const sortedStatuses = Object.values(studentStatusMap).sort((a, b) =>
        a.device_id.localeCompare(b.device_id)
    );

    const studentsData = Array.from({ length: 5 }, (_, i) => {
        const status = sortedStatuses[i];
        return {
            id: i + 1,
            deviceId: status?.device_id ?? `Student ${i + 1}`,
            wearableStatus: status?.wearableStatus ?? 'No Signal',
            cameraStatus: status?.cameraStatus ?? 'No Signal',
            cameraBehavior: status?.cameraBehavior ?? null,
            finalStatus: status?.finalStatus ?? 'Attentive',
        };
    });

    const statusColor = (s: string) =>
        s === 'Attentive' ? 'text-emerald-600 dark:text-emerald-400'
            : s === 'Inattentive' ? 'text-rose-600 dark:text-rose-400'
                : 'text-gray-400 dark:text-gray-500';

    const getCameraDisplay = (status: string, behavior: string | null) => {
        if (behavior && BEHAVIOR_CONFIG[behavior]) {
            const cfg = BEHAVIOR_CONFIG[behavior];
            return (
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${cfg.color} ${cfg.bg}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                    {cfg.label}
                </span>
            );
        }
        return <span className={statusColor(status)}>{status}</span>;
    };

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
                <div className="flex flex-1 flex-col p-4 md:p-6 lg:p-8 gap-6">
                    {/* Video Feed */}
                    <div className="flex flex-col items-center justify-center w-full">
                        <div className="relative aspect-video w-full max-w-5xl overflow-hidden rounded-2xl bg-black shadow-xl ring-1 ring-white/10">
                            {!isConnected && (
                                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black">
                                    <p className="text-sm font-normal text-primary-foreground tracking-wide animate-pulse">Connecting to Live Feed...</p>
                                </div>
                            )}
                            <img
                                ref={imageRef}
                                alt="Video Stream Feed"
                                className="h-full w-full object-contain"
                            />
                        </div>
                    </div>

                    {/* ── Behaviour Legend ── */}
                    <Card className="w-full max-w-5xl mx-auto border border-border/60 shadow-sm">
                        <CardHeader className="pt-4 px-5">
                            <CardTitle className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
                                Detection Legend
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-5 pb-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
                                {/* Inattentive */}
                                <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-500 mb-1.5">
                                        Inattentive
                                    </p>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                                        {INATTENTIVE_BEHAVIORS.map((key) => {
                                            const c = BEHAVIOR_CONFIG[key];
                                            return (
                                                <span key={key} className="inline-flex items-center gap-1.5 text-xs">
                                                    <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                                                    {c.label}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                                {/* Attentive */}
                                <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-500 mb-1.5">
                                        Attentive
                                    </p>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                                        {Object.entries(BEHAVIOR_CONFIG)
                                            .filter(([k]) => !INATTENTIVE_BEHAVIORS.includes(k))
                                            .map(([key, c]) => (
                                                <span key={key} className="inline-flex items-center gap-1.5 text-xs">
                                                    <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                                                    {c.label}
                                                </span>
                                            ))}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Student Status Cards */}
                    <div className="grid grid-cols-5 gap-4 w-full max-w-5xl mx-auto">
                        {studentsData.map((student) => (
                            <Card key={student.id} className={`text-xs border-2 transition-shadow duration-300`}>
                                <CardHeader className="pb-1 pt-3 px-3">
                                    <CardTitle className="text-xs font-semibold truncate">{student.deviceId}</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-1.5 px-3 pb-2">
                                    <div className="flex justify-between items-center gap-1">
                                        <span className="text-muted-foreground">Camera</span>
                                        {getCameraDisplay(student.cameraStatus, student.cameraBehavior)}
                                    </div>
                                    <div className="flex justify-between items-center gap-1">
                                        <span className="text-muted-foreground">Wearable</span>
                                        <span className={`font-medium text-[11px] ${statusColor(student.wearableStatus)}`}>
                                            {student.wearableStatus}
                                        </span>
                                    </div>
                                </CardContent>
                                <CardFooter className="flex justify-between items-center">
                                    <span>Overall</span>
                                    <span className={`font-bold ${statusColor(student.finalStatus)}`}>
                                        {student.finalStatus}
                                    </span>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}
