import * as React from "react";
import { Button, type ButtonProps } from "../Button/Button";

export type IconButtonProps = Omit<ButtonProps, "iconOnly" | "isIconOnly">;

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ size = "sm", variant = "ghost", children, ...props }, ref) => (
    <Button ref={ref} size={size} variant={variant} iconOnly {...props}>
      {children}
    </Button>
  ),
);

IconButton.displayName = "IconButton";
