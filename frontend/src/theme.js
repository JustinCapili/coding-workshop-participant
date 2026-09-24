import { createTheme } from '@mui/material/styles'

/**
 * ACME theme. Status colours (chips) come from the standard semantic palette slots and are
 * always paired with a text label, never used alone.
 */
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1f4e79' },
    secondary: { main: '#c2410c' },
    background: { default: '#f4f6f8', paper: '#ffffff' },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'].join(','),
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 600 },
  },
  components: {
    MuiCard: {
      defaultProps: { variant: 'outlined' },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { textTransform: 'none', fontWeight: 600 } },
    },
    MuiChip: {
      styleOverrides: { root: { fontWeight: 600 } },
    },
    MuiTextField: {
      defaultProps: { size: 'small', fullWidth: true },
    },
  },
})

export default theme
