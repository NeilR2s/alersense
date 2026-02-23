import { Spinner } from "@/components/ui/spinner";

export default function FullPageLoader() {
    return (
        <div className="flex items-center justify-center h-screen w-screen fixed top-0 left-0 bg-background/80 backdrop-blur-sm z-50">
            <Spinner className="size-16" />
        </div>
    );
}
