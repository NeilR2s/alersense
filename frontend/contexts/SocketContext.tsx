// context/SocketContext.tsx
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import io, { Socket } from 'socket.io-client';

export interface Telemetry {
    device_id: string;
    hr: number;
    skt: number;
    gsr: number;
    gsr_diff: number;
    hr_diff: number;
    status: string;
    status_yolo: string;
}

interface SocketContextProps {
    socket: Socket | null;
    isConnected: boolean;
    telemetryMap: Record<string, Telemetry>;
}

const SocketContext = createContext<SocketContextProps>({
    socket: null,
    isConnected: false,
    telemetryMap: {},
});

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [telemetryMap, setTelemetryMap] = useState<Record<string, Telemetry>>({});

    useEffect(() => {
        // Initialize socket connection once
        const socketInstance = io(process.env.NEXT_PUBLIC_SERVER_URL!, {
            auth: { token: process.env.NEXT_PUBLIC_VIEWER_TOKEN },
        });

        setSocket(socketInstance);

        socketInstance.on('connect', () => {
            console.log('Global Context: Connected to Flask Stream');
            setIsConnected(true);
        });

        socketInstance.on('disconnect', () => {
            console.log('Global Context: Disconnected from Flask Stream');
            setIsConnected(false);
        });

        socketInstance.on('telemetry_update', (newData: Telemetry) => {
            setTelemetryMap((prevMap) => ({
                ...prevMap,
                [newData.device_id]: newData,
            }));
        });

        return () => {
            // Cleanup on unmount
            socketInstance.disconnect();
        };
    }, []);

    return (
        <SocketContext.Provider value={{ socket, isConnected, telemetryMap }}>
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => useContext(SocketContext);