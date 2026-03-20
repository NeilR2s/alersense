'use client';

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useEffect, useRef, useState } from 'react';
import { useSocket } from "@/contexts/SocketContext";

interface Detection {
    class_name: string;
    confidence: number;
    bbox: [number, number, number, number];
}

interface StreamData {
    image: ArrayBuffer;
    predictions: Detection[];
}

export default function Page() {
    const { isConnected, socket, telemetryMap } = useSocket();
    const imageRef = useRef<HTMLImageElement>(null);
    const [predictions, setPredictions] = useState<Detection[]>([]);
    const [imageWidth, setImageWidth] = useState(640);

    useEffect(() => {
        if (!socket) return;

        const onVideoFeed = (data: StreamData) => {
            const blob = new Blob([data.image], { type: "image/jpeg" });
            const url = URL.createObjectURL(blob);

            if (imageRef.current) {
                if (imageRef.current.src) {
                    URL.revokeObjectURL(imageRef.current.src);
                }
                imageRef.current.src = url;

                // Track actual loaded frame width for boundary zone measurements
                if (imageRef.current.naturalWidth) {
                    setImageWidth(imageRef.current.naturalWidth);
                }
            }

            if (data.predictions) {
                setPredictions(data.predictions);
            }
        }

        socket.on('video_feed', onVideoFeed);

        return () => {
            socket.off('video_feed', onVideoFeed);
        };
    }, [socket]);

    const zones = 5;
    const zoneWidth = imageWidth / zones;
    const attentiveClasses = ["looking_forward", "reading_writing", "raising_hand", "standing"];

    // Defensive check mapping for standard telemetry status types
    const getWearableAttentive = (t: any) => {
        if (!t) return false;
        if (typeof t.isAttentive === 'boolean') return t.isAttentive;
        if (typeof t.is_attentive === 'boolean') return t.is_attentive;
        if (typeof t.attention === 'boolean') return t.attention;
        if (typeof t.attention === 'string') return ['attentive', 'focused', 'high'].includes(t.attention.toLowerCase());
        return false;
    };

    // Keep wearable items sorted sequentially so they reliably bind to 1-to-5 left-to-right zones
    const telemetryList = Object.values(telemetryMap || {}).sort((a: any, b: any) => {
        const idA = String(a.id || a.nodeId || a.mac || '');
        const idB = String(b.id || b.nodeId || b.mac || '');
        return idA.localeCompare(idB);
    });

    // Assign students to 5 location zones dynamically
    const studentsData = Array.from({ length: zones }).map((_, i) => {
        // Look for the most confident AI detection intersecting this layout zone
        const detectionsInZone = predictions.filter(d => {
            const cx = (d.bbox[0] + d.bbox[2]) / 2;
            return cx >= i * zoneWidth && cx < (i + 1) * zoneWidth;
        });

        detectionsInZone.sort((a, b) => b.confidence - a.confidence);
        const detection = detectionsInZone[0];

        const cameraAttentive = detection ? attentiveClasses.includes(detection.class_name) : false;
        const telemetry = telemetryList[i];
        const wearableAttentive = getWearableAttentive(telemetry);

        // DUAL CONFIRMATION: The final determinant metric
        const dualConfirmation = cameraAttentive && wearableAttentive;

        return {
            id: i + 1,
            detection,
            cameraAttentive,
            wearableAttentive,
            dualConfirmation,
            telemetry
        };
    });

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
                    <div className="flex flex-col items-center justify-center w-full">
                        <div className="relative aspect-video w-full max-w-5xl overflow-hidden rounded-2xl bg-black shadow-xl ring-1 ring-white/10">
                            {!isConnected && (
                                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80 text-zinc-400 animate-pulse">
                                    <p className="text-sm font-medium tracking-wide">Connecting to Live Feed...</p>
                                </div>
                            )}
                            <img
                                ref={imageRef}
                                alt="Video Stream Feed"
                                className="h-full w-full object-contain"
                            />

                            {/* Zones UI Feedback Overlay */}
                            <div className="absolute inset-0 grid grid-cols-5 pointer-events-none">
                                {studentsData.map((student, i) => (
                                    <div
                                        key={i}
                                        className={`border-r border-white/10 last:border-0 flex flex-col justify-end p-2 transition-colors duration-500 ${student.dualConfirmation ? 'bg-emerald-500/10' : 'bg-rose-500/10'
                                            }`}
                                    >
                                        <div className="bg-zinc-950/80 backdrop-blur-md rounded-lg p-3 text-xs text-zinc-200 border border-white/10 shadow-lg">
                                            <div className="font-semibold text-sm mb-2 text-white flex justify-between items-center">
                                                <span>Student {student.id}</span>
                                            </div>
                                            <div className="space-y-1.5">
                                                <div className="flex justify-between items-center gap-2">
                                                    <span className="text-zinc-400">Camera</span>
                                                    <span className={`font-medium ${student.cameraAttentive ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                        {student.detection ? (student.cameraAttentive ? 'Attentive' : 'Distracted') : 'No Signal'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center gap-2">
                                                    <span className="text-zinc-400">Wearable</span>
                                                    <span className={`font-medium ${student.wearableAttentive ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                        {student.telemetry ? (student.wearableAttentive ? 'Attentive' : 'Distracted') : 'No Signal'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="mt-2 pt-2 border-t border-white/10 flex justify-between items-center">
                                                <span className="text-zinc-300">Dual Sync</span>
                                                <span className={`font-bold ${student.dualConfirmation ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                    {student.dualConfirmation ? 'CONFIRMED' : 'FAILED'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Extended Status Breakdown Bottom Menu */}
                    <div className="grid grid-cols-5 gap-4 w-full max-w-5xl mx-auto">
                        {studentsData.map((student, i) => (
                            <div key={i} className="flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm">
                                <h3 className="text-sm font-semibold mb-3 text-center">Zone {student.id}</h3>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-zinc-500">Pose:</span>
                                        <span className="capitalize">{student.detection ? student.detection.class_name.replace('_', ' ') : 'None'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-zinc-500">Conf:</span>
                                        <span>{student.detection ? `${(student.detection.confidence * 100).toFixed(1)}%` : '0%'}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}