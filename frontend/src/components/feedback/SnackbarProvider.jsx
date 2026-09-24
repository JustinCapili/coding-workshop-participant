import { useCallback, useMemo, useState } from 'react'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import { SnackbarContext } from './snackbarContext'

export default function SnackbarProvider({ children }) {
  const [toast, setToast] = useState(null)

  const notify = useCallback((message, severity = 'success') => {
    setToast({ message, severity, key: Date.now() })
  }, [])

  const value = useMemo(() => ({ notify }), [notify])
  const close = () => setToast(null)

  return (
    <SnackbarContext.Provider value={value}>
      {children}
      <Snackbar
        key={toast?.key}
        open={Boolean(toast)}
        autoHideDuration={4000}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {toast ? (
          <Alert onClose={close} severity={toast.severity} variant="filled" sx={{ width: '100%' }}>
            {toast.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </SnackbarContext.Provider>
  )
}
