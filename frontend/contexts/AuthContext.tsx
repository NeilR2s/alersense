"use client"

import React,{ createContext, useContext, useState, useEffect, ReactNode } from "react"
import { onAuthStateChanged, getRedirectResult, signOut, signInWithRedirect, User, signInWithPopup } from "firebase/auth" 
import { auth, googleProvider } from "@/lib/firebase"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Provider } from "@radix-ui/react-tooltip"


interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: () => Promise<void>;
    logout: () => void;
}

interface AuthProviderProps {
    children: ReactNode
}


const AuthContextInstance = createContext<AuthContextType | undefined>(undefined);


export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router= useRouter();

    // useEffect(() => {
    //     const handleRedirect = async () => {
    //         try {
    //             const result = await getRedirectResult(auth);
    //             if (result) {
    //                 // setUser(result.user)
    //                 console.log(`user auth object ${user}`)
    //                 setLoading(false)
    //                 router.push("/dashboard");
    //             }
    //         } catch (error) {
    //             console.error("Redirect login failed", error);
    //             await signOut(auth); 
    //             router.push("/"); 
    //             toast("Login failed. Please try again.")
    //         }
    //     };

    //      handleRedirect();
    // }, [auth]);

    useEffect(() => {
        if (!auth.currentUser){
            router.push("/");
        }
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [auth]);


    // const login = async () => { 
    //     await signInWithRedirect(auth, googleProvider);
    // }

    const login = async () => { 
        await signInWithPopup(auth, googleProvider)
        router.push("/dashboard")
    }

    const logout = () => {
        signOut(auth);
        router.push("/")
    }
    return (
        <AuthContextInstance.Provider value={{ user, loading, login, logout }
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
