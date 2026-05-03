import React from 'react';
export const Button = React.forwardRef<HTMLButtonElement, any>(({ className, variant, size, ...props }, ref) => (
  <button ref={ref} className={`px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 ${className || ''}`} {...props} />
));
export const Input = React.forwardRef<HTMLInputElement, any>(({ className, ...props }, ref) => (
  <input ref={ref} className={`border px-3 py-2 rounded bg-background w-full ${className || ''}`} {...props} />
));
export const Textarea = React.forwardRef<HTMLTextAreaElement, any>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={`border px-3 py-2 rounded bg-background w-full ${className || ''}`} {...props} />
));
export const Label = React.forwardRef<HTMLLabelElement, any>(({ className, ...props }, ref) => (
  <label ref={ref} className={`text-sm font-medium ${className || ''}`} {...props} />
));
export const Switch = React.forwardRef<HTMLInputElement, any>(({ className, checked, onCheckedChange, ...props }, ref) => (
  <input type="checkbox" ref={ref} checked={checked} onChange={e => onCheckedChange?.(e.target.checked)} className={className} {...props} />
));

// Cards
export const Card = ({ className, ...props }: any) => <div className={`border rounded-lg shadow-sm bg-card text-card-foreground ${className || ''}`} {...props} />;
export const CardHeader = ({ className, ...props }: any) => <div className={`p-6 pb-2 ${className || ''}`} {...props} />;
export const CardTitle = ({ className, ...props }: any) => <h3 className={`font-semibold text-xl leading-none tracking-tight ${className || ''}`} {...props} />;
export const CardDescription = ({ className, ...props }: any) => <p className={`text-sm text-muted-foreground ${className || ''}`} {...props} />;
export const CardContent = ({ className, ...props }: any) => <div className={`p-6 pt-0 ${className || ''}`} {...props} />;
export const CardFooter = ({ className, ...props }: any) => <div className={`flex items-center p-6 pt-0 ${className || ''}`} {...props} />;

export const ScrollArea = ({ className, children, ...props }: any) => (
   <div className={`overflow-y-auto ${className || ''}`} {...props}>{children}</div>
);

// Dialog
export const Dialog = ({ children, open, onOpenChange }: any) => {
   if (!open) return null;
   return (
      <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => onOpenChange?.(false)}>
         <div onClick={e => e.stopPropagation()}>{children}</div>
      </div>
   );
};
export const DialogContent = ({ className, ...props }: any) => <div className={`bg-background border rounded-lg shadow-lg ${className || ''}`} {...props} />;
export const DialogHeader = ({ className, ...props }: any) => <div className={`flex flex-col space-y-1.5 text-center sm:text-left ${className || ''}`} {...props} />;
export const DialogTitle = ({ className, ...props }: any) => <div className={`text-lg font-semibold leading-none tracking-tight ${className || ''}`} {...props} />;
export const DialogDescription = ({ className, ...props }: any) => <div className={`text-sm text-muted-foreground ${className || ''}`} {...props} />;
export const DialogFooter = ({ className, ...props }: any) => <div className={`flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 ${className || ''}`} {...props} />;
