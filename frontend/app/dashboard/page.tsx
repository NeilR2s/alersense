'use client';

import { AppSidebar } from "@/components/app-sidebar"
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { DataTable } from "@/components/data-table"
import { SectionCards } from "@/components/section-cards"
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
    const [detections, setDetections] = useState<Detection[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    
    const imageRef = useRef<HTMLImageElement>(null);
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        socketRef.current = io('http://localhost:8080');

        socketRef.current.on('connect', () => {
            console.log('Connected to Flask Stream');
            setIsConnected(true);
        });

        socketRef.current.on('disconnect', () => {
            console.log('Disconnected');
            setIsConnected(false);
        });

        socketRef.current.on('video_feed', (arrayBuffer) => {
            console.log(arrayBuffer)
            const blob = new Blob([arrayBuffer], { type: "image/jpeg" });
            const url = URL.createObjectURL(blob);
            if (imageRef.current){
                if (imageRef.current.src) {
                    URL.revokeObjectURL(imageRef.current.src);
                }
                imageRef.current.src = url;
                // console.log(imageRef.current.src)
            } else {
                console.error("Attempting to mutate a null HTMLImageElement reference")
                return;
            }

        });

        socketRef.current.on('inference_data', (data) => {
            const boxes = data.detections;
            setDetections(boxes);
        });

        // Cleanup on unmount
        return () => {
            socketRef.current?.disconnect();
        };
    }, []);
    return (
        <SidebarProvider
            style={
                {
                    "--sidebar-width": "calc(var(--spacing) * 72)",
                    "--header-height": "calc(var(--spacing) * 12)",
                } as React.CSSProperties
            }
        >
            <AppSidebar variant="inset" />
            <SidebarInset>
                <SiteHeader />
                <div className="flex flex-1 flex-col">
                    <div className="flex flex-col items-center justify-center min-h-screen text-white">
                        <div className="relative rounded-lg overflow-hidden bg-black max-w-160 max-h-120 w-full h-full object-scale-down">
                            {!isConnected && (
                                <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                                    Connecting to server...
                                </div>
                            )}

                            <img
                                ref={imageRef}
                                alt="Live Stream"
                                className="w-full h-full w-full h-full object-scale-down"
                            />


                            {/* Bounding Box Overlays */}
                            {/* Note: This assumes the image is displayed at its native resolution or consistent aspect ratio.
                                For production, you may need to scale these coordinates based on the display size vs. native size. */}
                            {detections && detections.map((det, index) => {
                                // Assuming 640x480 resolution coming from python. 
                                // If displayed size differs, you must calculate scale factors.
                                // For this demo, we assume the container matches the capture size (640px wide).
                                const [x1, y1, x2, y2] = det.bbox;
                                const width = x2 - x1;
                                const height = y2 - y1;

                                return (
                                    <div
                                        key={index}
                                        className="absolute border-2 border-green-500"
                                        style={{
                                            left: `${x1}px`,
                                            top: `${y1}px`,
                                            width: `${width}px`,
                                            height: `${height}px`,
                                        }}
                                    >
                                        <span className="absolute -top-6 left-0 bg-green-500 text-black text-xs px-1 font-bold">
                                            {det.label} {Math.round(det.confidence * 100)}%
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="@container/main flex flex-1 flex-col gap-2">
                        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                            <SectionCards />
                            <div className="px-4 lg:px-6">
                                <ChartAreaInteractive />
                            </div>
                            <DataTable data={data} />
                        </div>
                    </div>
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}
