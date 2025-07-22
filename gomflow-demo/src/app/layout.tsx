import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'GOMFLOW - Stop Drowning in Payment Screenshots | K-pop Group Orders',
  description: 'The group order platform built by GOMs, for GOMs. No more spreadsheet hell - automated payment tracking, instant updates, get your weekends back!',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}