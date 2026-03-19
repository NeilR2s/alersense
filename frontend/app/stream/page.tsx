'use client';

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useEffect, useRef } from 'react';
import { useSocket } from "@/contexts/SocketContext";

interface Detection {
    label: string;
    confidence: number;
    bbox: [number, number, number, number];
}

interface StreamData {
    image: string;
    detections: Detection[];
}

export default function Page() {
    const { isConnected, socket } = useSocket();
    const imageRef = useRef<HTMLImageElement>(null);

    useEffect(() => {
        if (!socket) return;

        const onVideoFeed = (data: StreamData) => {
            const blob = new Blob([data.image], { type: "image/jpeg" });
            const url = URL.createObjectURL(blob);

            if (imageRef.current) {
                if (imageRef.current.src) {
                    URL.revokeObjectURL(imageRef.current.src); // Prevent memory leaks
                }
                imageRef.current.src = url;
            } else {
                console.error("Attempting to mutate a null HTMLImageElement reference")
            }
        }

        // Attach local listener for the video feed
        socket.on('video_feed', onVideoFeed);

        return () => {
            socket.off('video_feed', onVideoFeed);
        };
    }, [socket]); // Re-run if the socket instance changes

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
                <div className="flex flex-1 flex-col">
                    <div className="flex flex-col items-center justify-center p-4">
                        <div className="relative aspect-video w-full max-w-4xl overflow-hidden rounded-2xl bg-black shadow-xl">
                            {!isConnected && (
                                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 text-zinc-500 animate-pulse">
                                    <p className="text-sm font-medium">Connecting to server...</p>
                                </div>
                            )}
                            <img
                                ref={imageRef}
                                alt="Video Stream Feed"
                                className="h-full w-full object-contain"
                            />
                        </div>
                    </div>
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}