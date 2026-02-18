import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { auth } from "./firebase"
import { Auth } from "firebase/auth"

interface UserData {
    name: string;
    email: string;
    avatar: string;
}

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function generateUserProfile(auth:Auth):UserData{
    
    const userData = {
        name: "Anonymous",
        email: "user@anonymous.com",
        avatar: "https://stock.adobe.com/ph/images/default-avatar-profile-icon-social-media-user-image-gray-avatar-icon-blank-profile-silhouette-vector-illustration/703861114"
    };

    if (auth.currentUser?.displayName != undefined && auth.currentUser?.displayName != null){
        userData.name = auth.currentUser?.displayName;
    }
    if (auth.currentUser?.email != undefined && auth.currentUser?.email != null){
        userData.email = auth.currentUser?.email;
    }
    if (auth.currentUser?.photoURL != undefined && auth.currentUser?.photoURL != null){
        userData.avatar = auth.currentUser?.photoURL;
    }

    return userData
}