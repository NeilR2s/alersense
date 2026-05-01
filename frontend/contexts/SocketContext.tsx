'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import io, { Socket } from 'socket.io-client';


export interface Telemetry {
    device_id: string;
    hr: number;
    skt: number;
    gsr: number;
    gsr_diff: number;
    hr_diff: number;
    status: 'Attentive' | 'Inattentive' | 'Calibrating' | 'Error' | 'No Signal';
}

export interface Detection {
    class_name: string;
    confidence: number;
    bbox: [number, number, number, number];
}

export interface StudentStatus {
    device_id: string;
    wearableStatus: 'Attentive' | 'Inattentive' | 'Calibrating' | 'Error' | 'No Signal';
    cameraStatus: 'Attentive' | 'Inattentive' | 'No Signal';
    finalStatus: 'Attentive' | 'Inattentive';
}

/* YOLO classes that indicate inattentive behaviour */
const INATTENTIVE_CLASSES = new Set([
    'looking_away',
    'phone_use',
    'sleeping',
    'talking',
]);

const HR_INATTENTIVE_THRESHOLD = -3.98;
const GSR_INATTENTIVE_THRESHOLD = -9.49;

function getWearableStatus(telemetry: Telemetry | null): StudentStatus['wearableStatus'] {
    if (!telemetry) {
        return 'No Signal';
    }

    if (telemetry.status === 'Calibrating' || telemetry.status === 'Error' || telemetry.status === 'No Signal') {
        return telemetry.status;
    }

    return telemetry.hr_diff < HR_INATTENTIVE_THRESHOLD && telemetry.gsr_diff < GSR_INATTENTIVE_THRESHOLD
        ? 'Inattentive'
        : 'Attentive';
}

/** Number of spatial zones the camera frame is divided into */
const ZONES = 5;

/** Default frame width that the inference pipeline produces */
const DEFAULT_FRAME_WIDTH = 640;


interface SocketContextProps {
    socket: Socket | null;
    isConnected: boolean;
    telemetryMap: Record<string, Telemetry>;
    detections: Detection[];
    studentStatusMap: Record<string, StudentStatus>;
}

const SocketContext = createContext<SocketContextProps>({
    socket: null,
    isConnected: false,
    telemetryMap: {},
    detections: [],
    studentStatusMap: {},
});


export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [telemetryMap, setTelemetryMap] = useState<Record<string, Telemetry>>({});
    const [detections, setDetections] = useState<Detection[]>([]);

    useEffect(() => {
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

        // Wearable telemetry (biometrics + wearable attention status)
        socketInstance.on('telemetry_update', (newData: Telemetry) => {
            setTelemetryMap((prev) => ({
                ...prev,
                [newData.device_id]: newData,
            }));
        });

        // Camera detections (separated from video frames)
        socketInstance.on('detection_update', (data: { predictions: Detection[] }) => {
            setDetections(data.predictions ?? []);
        });

        return () => {
            socketInstance.disconnect();
        };
    }, []);

    const studentStatusMap = useMemo(() => {
        const statusMap: Record<string, StudentStatus> = {};
        const zoneWidth = DEFAULT_FRAME_WIDTH / ZONES;

        // Sort devices alphabetically for deterministic left-to-right zone assignment
        const sortedDevices = Object.values(telemetryMap).sort((a, b) =>
            a.device_id.localeCompare(b.device_id)
        );

        for (let zoneIndex = 0; zoneIndex < ZONES; zoneIndex++) {
            const telemetry = sortedDevices[zoneIndex] || null;
            const deviceId = telemetry?.device_id || `Student ${zoneIndex + 1}`;

            const bestDetection = detections
                .filter((d) => {
                    const cx = (d.bbox[0] + d.bbox[2]) / 2;
                    return cx >= zoneIndex * zoneWidth && cx < (zoneIndex + 1) * zoneWidth;
                })
                .sort((a, b) => b.confidence - a.confidence)[0] ?? null;

            const wearableStatus = getWearableStatus(telemetry);

            const cameraStatus: StudentStatus['cameraStatus'] = bestDetection
                ? (INATTENTIVE_CLASSES.has(bestDetection.class_name) ? 'Inattentive' : 'Attentive')
                : 'No Signal';

            // Flag inattentiveness when either independent signal detects it.
            const finalStatus: StudentStatus['finalStatus'] =
                wearableStatus === 'Inattentive' || cameraStatus === 'Inattentive'
                    ? 'Inattentive'
                    : 'Attentive';

            statusMap[deviceId] = {
                device_id: deviceId,
                wearableStatus,
                cameraStatus,
                finalStatus,
            };
        }

        return statusMap;
    }, [telemetryMap, detections]);

    return (
        <SocketContext.Provider
            value={{ socket, isConnected, telemetryMap, detections, studentStatusMap }}
        >
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => useContext(SocketContext);
