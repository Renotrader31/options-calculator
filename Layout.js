import { useState } from 'react'

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  )
}
