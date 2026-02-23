"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { onAuthStateChanged, signOut, User, signInWithPopup } from "firebase/auth"
import { auth, googleProvider } from "@/lib/firebase"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import FullPageLoader from "@/components/full-page-loader"

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: () => Promise<void>;
    logout: () => Promise<void>;
}

interface AuthProviderProps {
    children: ReactNode
}

const AuthContextInstance = createContext<AuthContextType | undefined>(undefined);


export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const login = async () => {
        const toastId = toast.loading("Logging in...", { position: "top-center" });
        try {
            await signInWithPopup(auth, googleProvider);
            toast.success(`Welcome back, ${auth.currentUser?.displayName || 'User'}!`, {
                id: toastId,
                position: "top-center"
            });
            router.push("/dashboard")
        } catch (error) {
            toast.error("Failed to login. Please try again.", {
                id: toastId,
                position: "top-center"
            });
        }
    }

    const logout = async () => {
        try {
            await signOut(auth);
            setUser(null);
            toast.success("Signed out successfully.", { position: "top-center" });
            router.replace("/");
            router.refresh();
        } catch (error) {
            toast.error("Failed to sign out.", { position: "top-center" });
        }
    }

    return (
        <AuthContextInstance.Provider value={{ user, loading, login, logout }}>
            {loading ? <FullPageLoader /> : children}
        </AuthContextInstance.Provider>
    );
}

export const useAuth = () => {
    const context = useContext(AuthContextInstance);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}