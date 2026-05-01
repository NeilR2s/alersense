"use client"

import * as React from "react"
import {
    IconDashboard,
    IconDatabase,
    IconFileWord,
    IconHelp,
    IconUser,
    IconReport,
    IconSearch,
    IconSettings,
    IconPhotoVideo,
    IconHistory
} from "@tabler/icons-react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar"
import Image from "next/image"
import Link from "next/link"
import { auth } from "@/lib/firebase"
import { generateUserProfile } from "@/lib/utils"


const data = {
    user: {
        name: auth.currentUser?.displayName,
        email: auth.currentUser?.email,
        avatar: auth.currentUser?.photoURL,
    },
    navMain: [
        {
            title: "Home",
            url: "/home",
            icon: IconUser,
        },
        {
            title: "Dashboard",
            url: "/dashboard",
            icon: IconDashboard,
        },
        {
            title: "Snapshots",
            url: "/snapshots",
            icon: IconHistory,
        },
        {
            title: "Video Feed",
            url: "/stream",
            icon: IconPhotoVideo,
        },
    ],
    navSecondary: [
        {
            title: "Settings",
            url: "#",
            icon: IconSettings,
        },
        {
            title: "Get Help",
            url: "#",
            icon: IconHelp,
        },
        {
            title: "Search",
            url: "#",
            icon: IconSearch,
        },
    ],
    documents: [
        {
            name: "Data Library",
            url: "#",
            icon: IconDatabase,
        },
        {
            name: "Reports",
            url: "#",
            icon: IconReport,
        },
        {
            name: "Word Assistant",
            url: "#",
            icon: IconFileWord,
        },
    ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {

    return (
        <Sidebar collapsible="offcanvas" {...props}>
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            asChild
                            className="data-[slot=sidebar-menu-button]:!p-1.5"
                        >
                            <Link href="/">
                                <Image src="/alersense-logo-black.svg" alt="alersense logo" width={35} height={35} />
                                <span className="text-lg font-semibold ">Alersense</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                <NavMain items={data.navMain} />
                <NavSecondary items={data.navSecondary} className="mt-auto" />
            </SidebarContent>
            <SidebarFooter>
                <NavUser user={generateUserProfile(auth)} />
            </SidebarFooter>
        </Sidebar>
    )
}
