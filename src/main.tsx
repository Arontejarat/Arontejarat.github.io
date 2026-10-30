import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import './styles/index.css'
import { StoreProvider } from '@/mock/store'
import { AuthProvider } from '@/auth/auth'
import { ToastProvider } from '@/components/ui'
import { router } from '@/app/router'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <AuthProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthProvider>
    </StoreProvider>
  </StrictMode>,
)
