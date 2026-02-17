"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { onAuthStateChanged, getRedirectResult, signOut, signInWithRedirect, User } from "firebase/auth" //
import { auth, googleProvider } from "@/lib/firebase"
import { useRouter } from "next/navigation"

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: () => Promise<void>;
}

interface AuthProviderProps {
    children: ReactNode
}


export const AuthContextInstance = createContext<AuthContextType | undefined>(undefined);


export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    // dedicated effect for handling the login redirect result
    useEffect(() => {
        const handleRedirect = async () => {
            try {
                const result = await getRedirectResult(auth);
                if (result?.user) {
                    router.push("/dashboard");
                }
            } catch (error) {
                console.error("Redirect login failed", error);
                await signOut(auth); // Ensure clean state
                router.push("/"); // Back to login/home
                alert("Login failed. Please try again.");
            }
        };

        handleRedirect();
    }, [router]);

    //  tracking auth state changes
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);


    const login = () => signInWithRedirect(auth, googleProvider);
    return (
        <AuthContextInstance.Provider value={{ user, loading, login }
        }>
            {children}
        </AuthContextInstance.Provider>
    );

}

export const useAuth = () => {
    const context = useContext(AuthContextInstance);
    if (context === undefined) {
        throw new Error("useAuth must be used in an AuthContext");
    }
    return context
}
