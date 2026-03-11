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

interface Telemetry {
    device_id: string;
    hr: number;
    skt: number;
    gsr: number;
    gsr_diff: number;
    hr_diff: number;
    status: string;
    status_yolo: string;
}

export default function Page() {
    const [isConnected, setIsConnected] = useState(false);
    // 1. Change to a Dictionary (Record) to easily replace existing IDs
    const [telemetryMap, setTelemetryMap] = useState<Record<string, Telemetry>>({});
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        // Initialize Socket
        socketRef.current = io(process.env.NEXT_PUBLIC_SERVER_URL!, {
            auth: { token: process.env.NEXT_PUBLIC_VIEWER_TOKEN }
        });

        const onConnect = () => {
            console.log('Connected to Flask Stream');
            setIsConnected(true);
        };

        const onDisconnect = () => {
            console.log('Disconnected from Flask Stream');
            setIsConnected(false);
        };

        const onTelemetryUpdate = (newData: Telemetry) => {
            // 2. Update the dictionary. If the device_id exists, it overwrites. If not, it adds.
            setTelemetryMap((prevMap) => ({
                ...prevMap,
                [newData.device_id]: newData
            }));
        };

        socketRef.current.on('connect', onConnect);
        socketRef.current.on('disconnect', onDisconnect);
        socketRef.current.on('telemetry_update', onTelemetryUpdate);

        return () => {
            if (socketRef.current) {
                socketRef.current.off('connect', onConnect);
                socketRef.current.off('disconnect', onDisconnect);
                socketRef.current.off('telemetry_update', onTelemetryUpdate);
                socketRef.current.disconnect();
            }
        };
    }, []);

    // 3. Convert the dictionary back to an array for the table
    const tableData = Object.values(telemetryMap);

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
                    <div className="@container/main flex flex-1 flex-col">
                        <div className="flex flex-col gap-4 py-6 md:gap-6">
                            <div className="flex items-center justify-between px-4 lg:px-6">
                                <h1 className="text-2xl font-semibold tracking-tight">
                                    Telemetry
                                </h1>
                                <span className={`text-xs ${isConnected ? 'text-green-500' : 'text-red-500'} mr-8`}>
                                    ● {isConnected ? 'Live' : 'Offline'}
                                </span>
                            </div>
                            <div className="px-4 lg:px-6">
                                {/* Pass the array derived from the dictionary */}
                                <DataTable data={tableData} />
                            </div>
                        </div>
                    </div>
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}