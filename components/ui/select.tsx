import * as React from "react";

export interface SelectProps extends React.PropsWithChildren {
  value?: string;
  onValueChange?: (value: string) => void;
  [key: string]: any;
}

const Select: React.FC<SelectProps> = ({ children, ...props }) => (
  <div {...props}>{children}</div>
);
Select.displayName = "Select";

const SelectTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, children, ...props }, ref) => (
    <button className={className} ref={ref} {...props}>{children}</button>
  )
);
SelectTrigger.displayName = "SelectTrigger";

const SelectValue: React.FC<{ placeholder?: string }> = ({ placeholder }) => (
  <span>{placeholder}</span>
);
SelectValue.displayName = "SelectValue";

const SelectContent: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div>{children}</div>
);
SelectContent.displayName = "SelectContent";

const SelectItem: React.FC<React.PropsWithChildren<{ value: string }>> = ({ children, value }) => (
  <option value={value}>{children}</option>
);
SelectItem.displayName = "SelectItem";

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
