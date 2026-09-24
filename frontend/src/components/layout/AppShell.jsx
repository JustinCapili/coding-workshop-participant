import { useState } from 'react'
import { Outlet, useNavigate, Link as RouterLink } from 'react-router-dom'
import AppBar from '@mui/material/AppBar'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Container from '@mui/material/Container'
import Divider from '@mui/material/Divider'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Toolbar from '@mui/material/Toolbar'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import MenuIcon from '@mui/icons-material/Menu'
import LogoutIcon from '@mui/icons-material/Logout'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import ReportProblemIcon from '@mui/icons-material/ReportProblem'
import SettingsIcon from '@mui/icons-material/Settings'
import { useAuth } from '../../auth/useAuth'
import { roleLabel } from '../../domain/roles'
import { USE_MOCKS } from '../../services/config'
import { initials } from '../../utils/format'
import { sectionsFor } from './navItems'
import SidebarNav from './SidebarNav'

const DRAWER_WIDTH = 240

/**
 * Authenticated layout: header (branding, current user, account menu with Settings and logout) +
 * role-aware content area.
 * Every role gets the sidebar (permanent on desktop, a drawer on mobile); navItems decides which
 * entries each role sees.
 */
export default function AppShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [menuAnchor, setMenuAnchor] = useState(null)

  const showSidebar = sectionsFor(user).length > 0

  const handleSettings = () => {
    setMenuAnchor(null)
    navigate('/settings')
  }

  const handleLogout = async () => {
    setMenuAnchor(null)
    await logout()
    navigate('/login', { replace: true })
  }

  // Mock mode only; the store is imported here, on demand, so API mode never loads it.
  const handleResetDemo = async () => {
    setMenuAnchor(null)
    const { resetDb } = await import('../../services/mock/mockStore')
    resetDb()
    window.location.assign('/dashboard')
  }

  const drawer = (
    <Box sx={{ width: DRAWER_WIDTH }} role="presentation">
      <Toolbar />
      <SidebarNav user={user} onNavigate={() => setMobileOpen(false)} />
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar position="fixed" color="primary" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar sx={{ gap: 1 }}>
          {showSidebar && (
            <IconButton
              color="inherit"
              edge="start"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
              sx={{ display: { md: 'none' } }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <ReportProblemIcon sx={{ mr: 0.5 }} />
          <Typography
            variant="h6"
            component={RouterLink}
            to="/dashboard"
            sx={{ color: 'inherit', textDecoration: 'none', fontWeight: 700, flexGrow: 1 }}
          >
            ACME Incident Reports
          </Typography>

          {USE_MOCKS && (
            <Tooltip title="VITE_USE_MOCKS=true: this session uses local mock data, not the backend">
              <Chip label="Mock data" size="small" color="warning" />
            </Tooltip>
          )}
          <Chip
            label={roleLabel(user)}
            size="small"
            sx={{ color: 'inherit', borderColor: 'rgba(255,255,255,0.5)', display: { xs: 'none', sm: 'inline-flex' } }}
            variant="outlined"
          />
          <Tooltip title={`${user.name} (${user.email})`}>
            <IconButton
              onClick={(e) => setMenuAnchor(e.currentTarget)}
              size="small"
              aria-label="Account menu"
              aria-haspopup="menu"
              sx={{ ml: 1 }}
            >
              <Avatar sx={{ width: 34, height: 34, bgcolor: 'secondary.main', fontSize: 14 }}>
                {initials(user.name)}
              </Avatar>
            </IconButton>
          </Tooltip>
          <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
            <Box sx={{ px: 2, py: 1 }}>
              <Typography variant="subtitle2">{user.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {user.email} · {roleLabel(user)}
              </Typography>
              {/* Shown so an employee can give it to a faculty admin, who promotes by id. */}
              <Typography variant="caption" color="text.secondary" display="block">
                Employee ID {user.employeeId}
              </Typography>
            </Box>
            <Divider />
            <MenuItem onClick={handleSettings}>
              <ListItemIcon>
                <SettingsIcon fontSize="small" />
              </ListItemIcon>
              Settings
            </MenuItem>
            {USE_MOCKS && (
              <MenuItem onClick={handleResetDemo}>
                <ListItemIcon>
                  <RestartAltIcon fontSize="small" />
                </ListItemIcon>
                Reset demo data
              </MenuItem>
            )}
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              Log out
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {showSidebar && (
        <Box component="aside" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={() => setMobileOpen(false)}
            ModalProps={{ keepMounted: true }}
            sx={{ display: { xs: 'block', md: 'none' } }}
          >
            {drawer}
          </Drawer>
          <Drawer
            variant="permanent"
            open
            sx={{
              display: { xs: 'none', md: 'block' },
              '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', borderRight: '1px solid', borderColor: 'divider' },
            }}
          >
            {drawer}
          </Drawer>
        </Box>
      )}

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0 }}>
        <Toolbar />
        <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
          <Outlet />
        </Container>
      </Box>
    </Box>
  )
}
