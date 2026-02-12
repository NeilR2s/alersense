'use client';

import { useEffect, useState, useRef } from 'react';
import io, { Socket } from 'socket.io-client';

interface Detection {
    label: string;
    confidence: number;
    bbox: [number, number, number, number]; // x1, y1, x2, y2
}

interface StreamData {
    image: string;
    detections: Detection[];
}

export default function Dashboard() {
    const [frame, setFrame] = useState<string | null>(null);
    const [detections, setDetections] = useState<Detection[]>([]);
    const [isConnected, setIsConnected] = useState(false);

    // Ref to hold the socket instance
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        // 1. Initialize Socket Connection
        socketRef.current = io('http://localhost:8080');

        socketRef.current.on('connect', () => {
            console.log('Connected to Flask Stream');
            setIsConnected(true);
        });

        socketRef.current.on('disconnect', () => {
            console.log('Disconnected');
            setIsConnected(false);
        });

        // 2. Listen for the broadcast event
        socketRef.current.on('stream_update', (data: StreamData) => {
            setFrame(data.image);
            setDetections(data.detections);
        });

        // Cleanup on unmount
        return () => {
            socketRef.current?.disconnect();
        };
    }, []);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
            <h1 className="text-3xl font-bold mb-4">YOLO Real-Time Inference</h1>

            <div className="relative border-2 border-gray-700 rounded-lg overflow-hidden bg-black w-[640px] h-[480px]">
                {!isConnected && (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                        Connecting to server...
                    </div>
                )}

                {/* Video Feed */}
                {frame && (
                    <img
                        src={frame}
                        alt="Live Stream"
                        className="w-full h-full object-contain"
                    />
                )}

                {/* Bounding Box Overlays */}
                {/* Note: This assumes the image is displayed at its native resolution or consistent aspect ratio.
            For production, you may need to scale these coordinates based on the display size vs. native size. */}
                {frame && detections.map((det, index) => {
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

            <div className="mt-4 grid grid-cols-2 gap-4 w-full max-w-2xl">
                <div className="bg-gray-800 p-4 rounded">
                    <h2 className="text-xl font-bold">Status</h2>
                    <p className={isConnected ? "text-green-400" : "text-red-400"}>
                        {isConnected ? "Live" : "Offline"}
                    </p>
                </div>
                <div className="bg-gray-800 p-4 rounded">
                    <h2 className="text-xl font-bold">Objects Detected</h2>
                    <p className="text-2xl">{detections.length}</p>
                </div>
            </div>
        </div>
    );
}