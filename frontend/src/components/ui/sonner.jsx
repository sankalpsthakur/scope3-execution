import { Toaster as Sonner, toast } from "sonner"

const Toaster = ({
  theme = "dark",
  ...props
}) => {
  return (
    <Sonner
      theme={theme}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[#121212] group-[.toaster]:text-white group-[.toaster]:border-white/10 group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-gray-400",
          actionButton:
            "group-[.toast]:bg-[#22C55E] group-[.toast]:text-black",
          cancelButton:
            "group-[.toast]:bg-white/10 group-[.toast]:text-gray-400",
        },
      }}
      {...props} />
  );
}

export { Toaster, toast }
