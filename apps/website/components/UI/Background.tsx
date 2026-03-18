export default function Background() {
    return (
        <div className="h-screen-real bg-black fixed inset-0">
            <div className="h-[100px] w-[100px] bg-neutral-yellow/50 absolute top-[40%] blur-[150px] left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"></div>
        </div>
    )
}