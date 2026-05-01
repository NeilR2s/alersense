'use client';

import { AppSidebar } from "@/components/app-sidebar"
import { DataTable } from "@/components/table"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useSocket } from "@/contexts/SocketContext";

export default function Page() {
    const { isConnected, telemetryMap, studentStatusMap } = useSocket();

    // Start from computed statuses so camera-only inattentiveness still appears.
    const tableData = Object.values(studentStatusMap).map((status) => {
        const t = telemetryMap[status.device_id];
        return {
            device_id: status.device_id,
            hr: t?.hr,
            skt: t?.skt,
            gsr: t?.gsr,
            gsr_diff: t?.gsr_diff,
            hr_diff: t?.hr_diff,
            wearableStatus: status.wearableStatus,
            cameraStatus: status.cameraStatus,
            finalStatus: status.finalStatus,
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
                                <DataTable data={tableData} />
                            </div>
                        </div>
                    </div>
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}
