import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'GOMFLOW - Interactive Demo',
  description: 'Experience the future of group order management',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <div className="fixed top-4 right-4 z-50">
          <div className="bg-orange-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
            🎭 DEMO MODE
          </div>
        </div>
      </body>
    </html>
  )
}