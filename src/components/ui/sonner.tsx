import { useTheme } from "@/contexts/ThemeContext"
import { CSSProperties } from "react"
import { Toaster as Sonner, ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme()

  return (
    <Sonner
      theme={theme}
      className="toaster group"
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
