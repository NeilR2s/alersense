'use client';
import React, { useState, useEffect } from 'react';
import { motion, Variants } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Image from 'next/image';
import { cn } from '@/lib/utils';


// --- Placeholder Components ---

// A shimmer effect placeholder for images
const ImagePlaceholder = ({ className, delay = 0 }: { className?: string; delay?: number }) => (
    <div className={cn("relative flex overflow-hidden bg-zinc-900 items-center justify-center-safe", className)}>
        <motion.div
            className="absolute inset-0 bg-linear-to-r from-transparent via-white/10 to-transparent"
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{
                repeat: Infinity,
                duration: 10,
                ease: "easeInOut",
                delay: delay
            }}
        />
        <Image src="/alersense-mockup.svg" alt="alersense wearable watch" height="600" width="600" className="mt-35 md:mt-20 lg:mt-0 object-scale-down max-w-md max-h-md" />
    </div>
);

// --- Main Landing Page Component ---

export default function HublotLanding() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Animation variants
    const fadeUp: Variants = {
        hidden: { opacity: 0, y: 30 },
        visible: (delay: number) => ({
            opacity: 1,
            y: 0,
            transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: delay * 0.1 }
        })
    };

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-900 font-sans overflow-x-hidden selection:bg-zinc-900 selection:text-white">

            {/* --- Mobile Navigation Overlay --- */}
            <div className={cn(
                "fixed inset-0 z-50 bg-black/95 text-white flex flex-col items-center justify-center space-y-8 transition-all duration-300 lg:hidden",
                isMobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
            )}>
                <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="absolute top-8 right-8 text-sm uppercase tracking-widest"
                >
                    Close
                </button>
                {['Home', 'About Us', 'Products'].map((item) => (
                    <a key={item} href="#" className="text-2xl font-light hover:text-zinc-400 transition-colors">{item}</a>
                ))}
            </div>

            <div className="flex flex-col lg:flex-row min-h-screen w-full relative">

                {/* --- Global Navbar (Absolute) --- */}
                <nav className="absolute top-0 left-0 right-0 z-40 w-full px-6 py-6 lg:px-12 lg:py-8 flex justify-between items-center">
                    {/* Logo Area */}
                    <div className="flex items-center gap-2 text-white">
                        <Image src="/alersense-logo.svg" alt="alersense logo" width="40" height="40" /> <span className="text-xl lg:text-2xl font-medium tracking-widest">Alersense</span>
                    </div>

                    {/* Desktop Links */}
                    <div className="hidden lg:flex items-center gap-8 text-sm font-medium text-white/80 absolute left-1/3 transform -translate-x-1/2">
                        {['Home', 'About Us', 'Products'].map((link) => (
                            <a key={link} href="#" className="hover:text-white transition-colors uppercase tracking-wide text-xs">
                                {link}
                            </a>
                        ))}
                    </div>

                    {/* Right Actions */}
                    <div className="flex items-center gap-4">
                        <button
                            className="lg:hidden text-white uppercase text-xs tracking-widest"
                            onClick={() => setIsMobileMenuOpen(true)}
                        >
                            Menu
                        </button>
                        <div className="hidden lg:flex items-center gap-4">
                            <button className="px-6 py-2 rounded-full bg-black text-white text-sm font-medium hover:bg-zinc-800 transition-all">
                                Sign in
                            </button>
                        </div>
                    </div>
                </nav>

                {/* --- Left Column: Visual/Hero Image --- */}
                <div className="relative w-full lg:w-[55%] h-[50vh] lg:h-screen bg-black overflow-hidden">
                    {/* Simulating the complex mechanical watch background */}
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-800 via-black to-black opacity-80" />

                    <ImagePlaceholder className="w-full h-full opacity-60 " />

                    {/* Overlay gradient to ensure text readability if needed (though mostly graphic here) */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent lg:bg-gradient-to-r lg:from-transparent lg:to-black/20 pointer-events-none" />
                </div>

                {/* --- Right Column: Content --- */}
                {/* The negative margin creates the overlap effect seen in the reference */}
                <div className="w-full lg:w-[45%] bg-white relative z-10 flex flex-col justify-center px-6 py-12 lg:p-16 rounded-t-4xl lg:rounded-t-none lg:rounded-l-4xl shadow-2xl shadow-black/50">

                    <div className="max-w-xl mx-auto lg:mx-0 flex flex-col h-full justify-center">

                        {/* Header Text */}
                        <motion.h1
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true }}
                            custom={1}
                            variants={fadeUp}
                            className="text-4xl lg:text-6xl font-semibold leading-[1.1] tracking-tight mb-6"
                        >
                            Attention is all you need.
                        </motion.h1>

                        {/* Subtext */}
                        <motion.p
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true }}
                            custom={2}
                            variants={fadeUp}
                            className="text-zinc-500 text-sm lg:text-base leading-relaxed mb-10 max-w-md"
                        >
                            Experience the fusion of art and technology on your wrist with a watch that perfectly blends timeless craftsmanship with cutting-edge innovation.
                        </motion.p>

                        {/* CTAs */}
                        <motion.div
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true }}
                            custom={3}
                            variants={fadeUp}
                            className="flex flex-wrap gap-4 mb-16"
                        >
                            <button className="px-8 py-3 rounded-full bg-zinc-200 text-zinc-900 font-medium text-sm hover:bg-zinc-300 transition-colors">
                                See Products
                            </button>
                            <button className="px-8 py-3 rounded-full bg-black text-white font-medium text-sm hover:bg-zinc-800 transition-colors">
                                Explore More
                            </button>
                        </motion.div>

                        {/* Stats Row */}
                        <motion.div
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true }}
                            custom={4}
                            variants={fadeUp}
                            className="flex items-center gap-12 mb-12 border-b border-zinc-100 pb-8"
                        >
                            <div>
                                <div className="text-2xl font-bold text-black">200ms</div>
                                <div className="text-xs text-zinc-500 font-medium mt-1">Dashboard Refresh Rate</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-black">3</div>
                                <div className="text-xs text-zinc-500 font-medium mt-1">Biometric Sensors</div>
                            </div>
                        </motion.div>


                    </div>
                </div>

            </div>
        </div>
    );
}