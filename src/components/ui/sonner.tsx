import { useTheme } from "@/contexts/ThemeContext"
import { AlertCircle, AlertTriangle, Check, CircleHelp, RefreshCw, X } from "@/components/brand/Icons"
import { CSSProperties } from "react"
import { Toaster as Sonner, ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme()

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      icons={{
        success: <Check size={16} />,
        info: <CircleHelp size={16} />,
        warning: <AlertTriangle size={16} />,
        error: <AlertCircle size={16} />,
        loading: <RefreshCw size={16} className="motion-safe:animate-spin" />,
        close: <X size={16} />,
      }}
      style={
        {
          "--normal-bg": "var(--m3-inverse-surface)",
          "--normal-text": "var(--m3-inverse-on-surface)",
          "--normal-border": "transparent",
        } as CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
