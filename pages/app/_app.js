import '../styles/globals.css'
import { useState } from 'react'
import Head from 'next/head'
import { Toaster } from 'react-hot-toast'

function MyApp({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>Options Profit Calculator</title>
        <meta name="description" content="Professional Options Trading Calculator with Real-time Market Data" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Component {...pageProps} />
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            style: {
              background: 'green',
            },
          },
          error: {
            duration: 5000,
            style: {
              background: 'red',
            },
          },
        }}
      />
    </>
  )
}

export default MyApp
