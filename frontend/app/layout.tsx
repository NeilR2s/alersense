import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Google_Sans } from "next/font/google";
import "./globals.css";


const googleSans = Google_Sans({
    variable: "--font-sans",
    subsets: ["latin"]
});

export const metadata: Metadata = {
    title: "Alersense",
    description: "IoT and AI Student Attention Monitoring System",
    icons: "/alersense-logo.svg"
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body
                className={`${googleSans.className} antialiased`}
            >
                {children}
            </body>
        </html>
    );
}
