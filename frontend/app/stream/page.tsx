'use client';

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useEffect, useRef } from 'react';
import { useSocket } from "@/contexts/SocketContext";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

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
            finalStatus: status?.finalStatus ?? 'Attentive',
        };
    });

    const statusColor = (s: string) =>
        s === 'Attentive' ? 'text-emerald-600'
            : s === 'Inattentive' ? 'text-rose-600'
                : 'text-gray-400';

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

                    {/* Student Status Cards */}
                    <div className="grid grid-cols-5 gap-4 w-full max-w-5xl mx-auto">
                        {studentsData.map((student) => (
                            <Card key={student.id} className="text-xs">
                                <CardHeader>
                                    <CardTitle>{student.deviceId}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex justify-between items-center gap-2">
                                        <span>Camera</span>
                                        <span className={`font-medium ${statusColor(student.cameraStatus)}`}>
                                            {student.cameraStatus}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center gap-2">
                                        <span>Wearable</span>
                                        <span className={`font-medium ${statusColor(student.wearableStatus)}`}>
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
