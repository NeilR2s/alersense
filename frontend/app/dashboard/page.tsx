'use client';

import { AppSidebar } from "@/components/app-sidebar"
import { DataTable } from "@/components/table"
import { SiteHeader } from "@/components/site-header"
import {
    SidebarInset,
    SidebarProvider,
} from "@/components/ui/sidebar"
import { useEffect, useState, useRef } from 'react';
import io, { Socket } from 'socket.io-client';

import data from "./data.json"



interface Detection {
    label: string;
    confidence: number;
    bbox: [number, number, number, number]; // x1, y1, x2, y2
}

interface StreamData {
    image: string;
    detections: Detection[];
}

export default function Page() {
    const [isConnected, setIsConnected] = useState(false);

    const imageRef = useRef<HTMLImageElement>(null);
    const socketRef = useRef<Socket | null>(null);


    useEffect(() => {
        socketRef.current = io(process.env.NEXT_PUBLIC_SERVER_URL, { auth: { token: process.env.NEXT_PUBLIC_VIEWER_TOKEN } });

        const onConnect = () => {
            console.log('Connected to Flask Stream');
            setIsConnected(true);
        }
        const onDisconnect = () => {
            console.log('Disconnected to Flask Stream');
            setIsConnected(false);
        }

        const onVideoFeed = (data: any) => {
            console.log(data.image)
            const blob = new Blob([data.image], { type: "image/jpeg" });
            const url = URL.createObjectURL(blob);
            if (imageRef.current) {
                if (imageRef.current.src) {
                    URL.revokeObjectURL(imageRef.current.src);
                }
                imageRef.current.src = url;
                // console.log(imageRef.current.src)
            } else {
                console.error("Attempting to mutate a null HTMLImageElement reference")
                return;
            }
        }

        socketRef.current.on('connect', onConnect);
        socketRef.current.on('disconnect', onDisconnect);
        socketRef.current.on('video_feed', onVideoFeed);

        // Cleanup on unmount
        return () => {
            if (socketRef.current) {
                setIsConnected(false);
                socketRef.current.off('connect', onConnect);
                socketRef.current.off('disconnect', onDisconnect);
                socketRef.current.off('video_feed', onVideoFeed);
                socketRef.current.disconnect();
            }
        };
    }, []);
    return (
        <SidebarProvider
            style={{
                "--sidebar-width": "18rem", // 72 * 0.25rem
                "--header-height": "3rem",  // 12 * 0.25rem
            } as React.CSSProperties}
        >
            <AppSidebar variant="inset" />
            <SidebarInset>
                <SiteHeader />
                <div className="flex flex-1 flex-col">
                    {/* Stream Container */}
                    <div className="flex flex-col items-center justify-center  p-4">
                        <div className="relative aspect-video w-full max-w-4xl overflow-hidden rounded-2xl bg-black shadow-xl">
                            {!isConnected && (
                                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 text-zinc-500 animate-pulse">
                                    <p className="text-sm font-medium">Connecting to server...</p>
                                </div>
                            )}
                            <img
                                ref={imageRef}
                                alt="Live Telemetry Feed"
                                className="h-full w-full object-contain"
                            />
                        </div>
                    </div>

                    {/* Data Section */}
                    <div className="@container/main flex flex-1 flex-col">
                        <div className="flex flex-col gap-4 py-6 md:gap-6">
                            {/* Consistent horizontal padding with the table */}
                            <h1 className="px-4 text-2xl font-semibold tracking-tight lg:px-6">
                                Telemetry
                            </h1>
                            <div className="px-4 lg:px-6">
                                <DataTable data={data} />
                            </div>
                        </div>
                    </div>
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}
