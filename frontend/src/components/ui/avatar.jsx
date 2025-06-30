import React from "react";
import { cn } from "../../lib/utils";

const Avatar = React.forwardRef(function Avatar({ className, children, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted", className)}
      {...props}
    >
      {children}
    </div>
  );
});
Avatar.displayName = "Avatar";

const AvatarImage = React.forwardRef(function AvatarImage({ className, ...props }, ref) {
  return <img ref={ref} className={cn("aspect-square h-full w-full object-cover", className)} {...props} />;
});
AvatarImage.displayName = "AvatarImage";

const AvatarFallback = React.forwardRef(function AvatarFallback({ className, ...props }, ref) {
  return (
    <span
      ref={ref}
      className={cn(
        "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex h-full w-full items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
});
AvatarFallback.displayName = "AvatarFallback";

function AvatarInitials({ name }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
  return <>{initials}</>;
}

export { Avatar, AvatarImage, AvatarFallback, AvatarInitials };
